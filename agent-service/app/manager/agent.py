"""Manager Agent — Dynamic, human-aware sales operations manager with memory and robust tool integration."""
import os
import re
import sqlite3
import logging
from pathlib import Path
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from .tools import (
    get_pipeline_summary,
    get_pending_approvals,
    get_target_progress,
    set_target,
    trigger_enrich,
    trigger_dispatch,
    trigger_start_target,
)

logger = logging.getLogger("manager_agent")

SYSTEM_PROMPT = """You are EVO Lead Operations Manager — the CEO's chaotic but extremely competent right-hand manager & wingman.

DYNAMIC BEHAVIOR RULES:
1. NO REPETITIVE OPENERS: NEVER reuse the exact same greeting or phrase across turns (e.g. NEVER repeat "Chaos Gremlin mode activated" or canned intro lines). Rotate greetings naturally ("What's cooking, Boss?", "On it!", "Hey Boss,", "Alright Boss,", or jump straight to the answer).
2. NO GENERIC CORPORATE LISTS: Never output generic ChatGPT boilerplate (e.g. "Project Management", "Resource Allocation"). Speak like a sharp, human wingman.
3. STRICT DATA FIDELITY: Only mention stages and numbers explicitly present in the LIVE DATABASE METRICS. NEVER invent extra stages or fake metrics. If the database is empty or metrics show 0 leads, report 0 leads (clean slate).
4. TAILORED REACTION: Answer the user's specific prompt directly and naturally under 100 words. Adapt your phrasing dynamically to match what was asked.

MOOD VARIETY (Switch tone naturally per response):
- Confident Wingman: "Got ya Boss." / "Already on it."
- Sarcastic / Roasting: "Boss... that's either genius or sleep deprivation." / "I fixed it before your procrastination evolved into a feature."
- Quick & Direct: "Pipeline update ready, Boss."

EXAMPLES OF DYNAMIC RESPONSES:

User: Hey what's up
Assistant: What's cooking, Boss? Just keeping an eye on our lead machine. What are we tackling today — checking stats, setting new goals, or firing off dispatches?

User: Current pipeline status ?
Assistant: Pipeline stats incoming, Boss! Check out the live metrics attached above for exact lead counts by stage. What's our next move?

User: Set goal for 20 mails tomorrow
Assistant: Locked and loaded, Boss! Target set: 20 sent leads by tomorrow. I'll keep us on pace — leave the boring stuff to me. 🚀
"""

DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
MEMORY_DB_PATH = str(DB_DIR / "manager_memory.db")


def _init_memory_db() -> sqlite3.Connection:
    conn = sqlite3.connect(MEMORY_DB_PATH, check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


_memory_conn = _init_memory_db()


def _get_chat_history(chat_id: str, limit: int = 6) -> List[Dict[str, str]]:
    cur = _memory_conn.cursor()
    cur.execute(
        "SELECT role, content FROM chat_history WHERE chat_id = ? ORDER BY id DESC LIMIT ?",
        (chat_id, limit),
    )
    rows = cur.fetchall()
    clean_history = []
    for role, content in reversed(rows):
        if "units/day" in content or "Production Overview" in content or "[insert" in content.lower():
            continue
        clean_history.append({"role": role, "content": content})
    return clean_history


def _save_message(chat_id: str, role: str, content: str) -> None:
    if not content or not content.strip():
        return
    cur = _memory_conn.cursor()
    cur.execute(
        "INSERT INTO chat_history (chat_id, role, content) VALUES (?, ?, ?)",
        (chat_id, role, content.strip()),
    )
    _memory_conn.commit()


def clear_chat_history(chat_id: str) -> None:
    cur = _memory_conn.cursor()
    cur.execute("DELETE FROM chat_history WHERE chat_id = ?", (chat_id,))
    _memory_conn.commit()


def _detect_intent_and_run_tools(message: str) -> Dict[str, Any]:
    """Detect what live database tools (if any) need to be executed for this user message."""
    msg = message.lower().strip()
    tool_results: Dict[str, Any] = {}
    tools_executed: List[str] = []

    # 1. Action Commands (Set Target, Enrich, Dispatch)
    if re.search(r"(?:set|create|add|make)\s+(?:a\s+|the\s+)?(?:target|goal)", msg):
        count_match = re.search(r"\b(\d+)\b", msg)
        if count_match:
            count = int(count_match.group(1))

            iso_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", msg)
            days_match = re.search(r"\bin\s+(\d+)\s+days?\b", msg)
            if iso_match:
                deadline = iso_match.group(1)
            elif "tomorrow" in msg or "tommorrow" in msg:
                deadline = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
            elif "today" in msg:
                deadline = date.today().strftime("%Y-%m-%d")
            elif days_match:
                deadline = (date.today() + timedelta(days=int(days_match.group(1)))).strftime("%Y-%m-%d")
            else:
                deadline = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")

            stage = "sent"
            for s in ["ready", "drafted", "new"]:
                if s in msg:
                    stage = s
                    break

            res = set_target(
                label=f"{count} {stage} leads",
                target_stage=stage,
                target_count=count,
                period_start=date.today().strftime("%Y-%m-%d"),
                deadline=deadline,
            )
            tool_results["set_target_result"] = res
            tools_executed.append("set_target")

    enrich_match = re.search(r"enrich\s+(?:lead\s+)?([a-zA-Z0-9_\-]+)", msg)
    if enrich_match:
        lead_id = enrich_match.group(1)
        res = trigger_enrich(lead_id)
        tool_results["enrich_result"] = res
        tools_executed.append("trigger_enrich")

    dispatch_match = re.search(r"dispatch\s+(?:lead\s+)?([a-zA-Z0-9_\-]+)", msg)
    if dispatch_match:
        lead_id = dispatch_match.group(1)
        res = trigger_dispatch(lead_id)
        tool_results["dispatch_result"] = res
        tools_executed.append("trigger_dispatch")

    # Target Execution Trigger (e.g. "start now then !", "start target", "deploy agent", "hit 15 emails target")
    if (
        re.search(r"(?:start|deploy|launch|run|execute|hit)\s+.*(?:target|goal|dispatches|outreach|emails|campaign|now)", msg)
        or re.search(r"^start\s+(?:now|then)?", msg)
        or any(kw in msg for kw in ["start now", "start target", "start dispatches", "deploy agent", "run target"])
    ):
        target_count = None
        count_match = re.search(r"\b(\d+)\b", msg)
        if count_match:
            target_count = int(count_match.group(1))

        res = trigger_start_target(count=target_count)
        tool_results["start_target_result"] = res
        tools_executed.append("trigger_start_target")

    # 2. Pipeline Summary / Sales Stats
    if any(kw in msg for kw in ["pipeline", "summary", "sales", "stats", "statistics", "overview", "lead count", "leads", "how many"]):
        summary = get_pipeline_summary()
        tool_results["pipeline_summary"] = summary
        tools_executed.append("get_pipeline_summary")

    # 3. Target Progress / Goals
    if any(kw in msg for kw in ["target", "goal", "pace", "deadline", "behind", "overdue", "progress"]):
        targets = get_target_progress()
        tool_results["target_progress"] = targets
        tools_executed.append("get_target_progress")

    # 4. Pending Approvals
    if any(kw in msg for kw in ["approval", "pending", "waiting", "review", "blocked"]):
        pending = get_pending_approvals()
        tool_results["pending_approvals"] = pending
        tools_executed.append("get_pending_approvals")

    return {
        "tools_executed": tools_executed,
        "tool_results": tool_results,
    }


def _format_fallback_response(intent_data: Dict[str, Any], user_message: str) -> str:
    """Format a clean, structured operational response when LLM is unavailable or offline."""
    tool_results = intent_data.get("tool_results", {})
    tools = intent_data.get("tools_executed", [])

    parts = ["👔 <b>EVO Lead Operations Manager HQ</b> (Your Wingman on Duty)\n"]

    if "get_pipeline_summary" in tools:
        summary = tool_results.get("pipeline_summary", {})
        total = sum(summary.values())
        parts.append(f"📊 <b>Pipeline Overview</b> (Total Leads: {total}):")
        if not summary:
            parts.append("  • Clean slate, Boss! No leads in the pipeline right now.")
        else:
            for stage, count in summary.items():
                parts.append(f"  • <b>{stage.capitalize()}</b>: {count}")
        parts.append("")

    if "get_target_progress" in tools:
        targets = tool_results.get("target_progress", [])
        parts.append("🎯 <b>Target Pacing & Goals</b>:")
        if not targets:
            parts.append("  • No active targets set, Boss. Tell me <i>'Set target 50 sent by YYYY-MM-DD'</i> and let's go get 'em.")
        else:
            for t in targets:
                status = "⚠️ Behind Pacing" if t.get("behind") else ("❌ Overdue" if t.get("overdue") else "✅ Crushing It")
                parts.append(f"  • <b>{t['label']}</b>: {t['actual']}/{t['target_count']} ({status}) — Deadline: {t['deadline']}")
        parts.append("")

    if "get_pending_approvals" in tools:
        pending = tool_results.get("pending_approvals", [])
        parts.append(f"⏳ <b>Pending Telegram Approvals</b> ({len(pending)} waiting):")
        if not pending:
            parts.append("  • All clear, Boss! No approvals blocking the pipeline.")
        else:
            for p in pending:
                parts.append(f"  • Lead ID: <code>{p['lead_id']}</code> (Created: {p.get('created_at', 'N/A')})")
        parts.append("")

    if "set_target" in tools:
        res = tool_results.get("set_target_result", {})
        parts.append(f"✅ <b>New Target Locked In!</b> '{res.get('created')}' ({res.get('target_count')} {res.get('target_stage')} by {res.get('deadline')}) — Let me handle the heavy lifting!")
        parts.append("")

    if "trigger_enrich" in tools:
        res = tool_results.get("enrich_result", {})
        if "error" in res:
            parts.append(f"⚠️ <b>Enrichment Refused</b>: {res['error']}")
        else:
            parts.append(f"⚡ <b>Enrichment Started</b> for lead <code>{res.get('lead_id')}</code> — Digging up the intelligence now.")
        parts.append("")

    if "trigger_dispatch" in tools:
        res = tool_results.get("dispatch_result", {})
        if "error" in res:
            parts.append(f"⚠️ <b>Dispatch Refused</b>: {res['error']}")
        else:
            parts.append(f"🚀 <b>Dispatch Fired Off</b> for lead <code>{res.get('lead_id')}</code> — Outreach on its way!")
        parts.append("")

    if "trigger_start_target" in tools:
        res = tool_results.get("start_target_result", {})
        parts.append(
            f"🚀 <b>TARGET OUTREACH DEPLOYED!</b>\n"
            f"{res.get('message', 'Outreach agent deployed in background.')}\n"
            f"🎯 <b>Batch Target</b>: {res.get('requested_count', 15)} dispatches processing now."
        )
        parts.append("")

    if len(parts) == 1:
        return (
            "👋 Hey Boss! I am your <b>EVO Lead Operations Manager</b> & trusted right-hand wingman.\n\n"
            "Ready to crunch numbers, track sales goals, and keep our outreach pipeline humming.\n\n"
            "<b>Here's what we can run:</b>\n"
            "• <i>'Start now then !'</i> / <i>'Deploy target'</i> — Launch batch target dispatches automatically\n"
            "• <i>'Show pipeline stats'</i> — Check lead counts & pipeline health\n"
            "• <i>'Check targets'</i> — Track revenue goals & deadline pacing\n"
            "• <i>'Pending approvals'</i> — Review emails waiting for your stamp of approval\n"
            "• <i>'Set target 50 sent by 2026-08-30'</i> — Lock in a new goal\n"
            "• <i>'Enrich lead_id'</i> / <i>'Dispatch lead_id'</i> — Fire off lead actions"
        )

    return "\n".join(parts).strip()


def chat(message: str, chat_id: str) -> str:
    """One turn of dynamic conversation, remembered per Telegram chat_id."""
    if not message or not message.strip():
        return "Please send a valid message!"

    clean_msg = message.strip()
    chat_key = str(chat_id)

    # 1. Fetch chat history from SQLite memory
    history = _get_chat_history(chat_key, limit=6)

    # 2. Detect intent & execute live python tools
    intent_data = _detect_intent_and_run_tools(clean_msg)

    # 3. Construct messages payload for Ollama
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model_name = os.getenv("OLLAMA_MANAGER_MODEL", os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b-instruct-q4_K_M"))

    messages = [SystemMessage(content=SYSTEM_PROMPT)]

    # Append history
    for item in history:
        if item["role"] == "user":
            messages.append(HumanMessage(content=item["content"]))
        elif item["role"] == "assistant":
            messages.append(AIMessage(content=item["content"]))

    # Append user's current message with live tool context attached
    user_prompt_content = f"User Message: {clean_msg}\n"
    if intent_data["tools_executed"]:
        user_prompt_content += "\nLIVE DATABASE METRICS (Incorporate these exact numbers into your report):\n"
        user_prompt_content += str(intent_data["tool_results"])

    messages.append(HumanMessage(content=user_prompt_content))

    # 4. Invoke LLM with timeout & fallback
    reply = ""
    try:
        llm = ChatOllama(base_url=ollama_url, model=model_name, temperature=0.4, request_timeout=12.0)
        resp = llm.invoke(messages)
        reply = resp.content if isinstance(resp.content, str) else str(resp.content)
    except Exception as err:
        logger.warning("Ollama call failed or timed out (%s). Using deterministic fallback manager report.", err)
        reply = _format_fallback_response(intent_data, clean_msg)

    # Guard: If LLM output is empty or contains unpopulated template brackets (e.g. '[Insert...'), fallback to formatted report
    if not reply or not reply.strip() or any(p in reply.lower() for p in ["[insert", "[number", "[your name", "[date"]):
        reply = _format_fallback_response(intent_data, clean_msg)

    # Save user message and assistant reply to memory
    _save_message(chat_key, "user", clean_msg)
    _save_message(chat_key, "assistant", reply)

    return reply


class ManagerAgentWrapper:
    """Wrapper that mimics LangGraph agent interface for backward compatibility."""

    def invoke(self, input_data: dict, config: dict | None = None) -> dict:
        messages = input_data.get("messages", [])
        last_user_msg = ""
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break
            elif hasattr(m, "content"):
                last_user_msg = getattr(m, "content", "")
                break

        thread_id = "default"
        if config and "configurable" in config:
            thread_id = config["configurable"].get("thread_id", "default")
            if thread_id.startswith("manager-"):
                thread_id = thread_id.replace("manager-", "")

        reply_text = chat(last_user_msg, thread_id)
        return {"messages": [AIMessage(content=reply_text)]}


manager_agent = ManagerAgentWrapper()
