"""Manager tools for LLM agent interaction."""
from __future__ import annotations
import asyncio
from typing import Any
from ..db import get_db
from .targets import check_targets


def get_pipeline_summary() -> dict[str, int]:
    """Get the current count of leads across all pipeline stages (new, scored, drafted, ready, sent, archived).
    Use this whenever the user asks about sales, pipeline overview, lead statistics, or overall performance.
    """
    conn = get_db()
    rows = conn.execute("SELECT pipeline_stage, COUNT(*) AS n FROM leads GROUP BY pipeline_stage").fetchall()
    return {r["pipeline_stage"]: r["n"] for r in rows}


def get_pending_approvals() -> list[dict[str, Any]]:
    """Get all leads currently waiting for human approval in Telegram before email dispatch.
    Use this when asked about pending approvals, waiting items, or blocked dispatches.
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT id, lead_id, telegram_chat_id, created_at FROM pending_approvals WHERE status = 'pending'"
    ).fetchall()
    return [dict(r) for r in rows]


def get_target_progress() -> list[dict[str, Any]]:
    """Get real-time target progress and pace metrics (expected vs actual lead counts, deadlines, behind/overdue status).
    Use this whenever the user asks about sales targets, weekly goals, progress towards deadlines, or pacing.
    """
    return check_targets()


def set_target(
    label: str,
    target_stage: str,
    target_count: int,
    period_start: str,
    deadline: str,
) -> dict[str, Any]:
    """Create and set a new outreach/sales target goal for the pipeline.
    
    Args:
        label: Description of target (e.g. '50 sent emails by Friday')
        target_stage: Lead stage to count (e.g. 'sent', 'ready')
        target_count: Target number to reach
        period_start: ISO start date (YYYY-MM-DD)
        deadline: ISO deadline date (YYYY-MM-DD)
    """
    conn = get_db()
    conn.execute(
        "INSERT INTO targets (label, target_stage, target_count, period_start, deadline) "
        "VALUES (?, ?, ?, ?, ?)",
        (label, target_stage, target_count, period_start, deadline),
    )
    conn.commit()
    return {"created": label, "target_stage": target_stage, "target_count": target_count, "deadline": deadline}


def trigger_enrich(lead_id: str) -> dict[str, Any]:
    """Kick off enrichment for a lead that hasn't been scored/drafted yet (stage must be 'new')."""
    conn = get_db()
    row = conn.execute("SELECT pipeline_stage FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if row is None:
        return {"error": f"No lead found with ID '{lead_id}'"}
    
    stage = row["pipeline_stage"]
    if stage not in ("new",):
        return {"error": f"Lead is already at stage '{stage}' — refusing to re-enrich"}

    from ..graphs.enrichment_graph import enrich_lead

    lead_row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    lead_dict = dict(lead_row) if lead_row else {"id": lead_id}
    sender_info = {
        "senderName": "EVO Solutions Outreach",
        "senderCompany": "EVO Solutions",
        "offerDescription": "Digital storefront optimization & lead intelligence",
        "senderEmail": "outreach@evosolutions.com",
    }

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(enrich_lead(lead_dict, sender_info))
    except RuntimeError:
        asyncio.run(enrich_lead(lead_dict, sender_info))

    return {"lead_id": lead_id, "status": "enrichment started"}


def trigger_dispatch(lead_id: str) -> dict[str, Any]:
    """Kick off the review & dispatch flow for a lead that's ready (stage must be 'ready' or 'drafted')."""
    conn = get_db()
    row = conn.execute("SELECT pipeline_stage FROM leads WHERE id = ?", (lead_id,)).fetchone()
    if row is None:
        return {"error": f"No lead found with ID '{lead_id}'"}
    
    stage = row["pipeline_stage"]
    if stage not in ("ready", "drafted"):
        return {"error": f"Lead is at stage '{stage}' — not safe to dispatch again"}

    from ..graphs.dispatch_graph import build_dispatch_agent, run_dispatch
    dispatch_graph = build_dispatch_agent()

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(run_dispatch(lead_id, dispatch_graph))
    except RuntimeError:
        asyncio.run(run_dispatch(lead_id, dispatch_graph))

    return {"lead_id": lead_id, "status": "dispatch started"}


def trigger_start_target(target_id: Optional[int] = None, count: Optional[int] = None) -> dict[str, Any]:
    """Start and deploy target outreach dispatches in batch across target leads."""
    from ..nodes.dispatch.start_target import execute_target_batch

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(execute_target_batch(target_id=target_id, max_count=count))
    except RuntimeError:
        asyncio.run(execute_target_batch(target_id=target_id, max_count=count))

    return {
        "status": "target_execution_started",
        "message": "🚀 Target outreach agent deployed! Dispatching batch to hit target goals.",
        "target_id": target_id,
        "requested_count": count or 15,
    }



