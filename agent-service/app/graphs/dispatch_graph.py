"""Review & Dispatch Agent — LangGraph StateGraph construction and execution."""
import logging
from langgraph.graph import StateGraph, END
from ..state.dispatch_state import DispatchState
from ..nodes.dispatch import (
    fetch_context_node,
    eval_draft_node,
    regenerate_node,
    submit_approval_node,
    handle_rejection_node,
    send_email_node,
    send_whatsapp_node,
    move_to_sent_node,
    archive_node,
    move_to_ready_node,
)

logger = logging.getLogger(__name__)


# ── ROUTING LOGIC ──────────────────────────────────────────────

def route_after_fetch(state: DispatchState) -> str:
    """Route lead based on contact email or phone availability."""
    lead_info = state.get("lead_info", {})
    has_email = bool(lead_info.get("contact_email"))
    has_phone = bool(lead_info.get("phone") or lead_info.get("contact_phone"))
    if not has_email and not has_phone:
        logger.info("Lead %s has neither contact_email nor phone. Routing to archive.", state.get("lead_id"))
        return "archive"
    return "eval_draft"


def route_after_eval(state: DispatchState) -> str:
    """Route draft to Telegram for human approval."""
    regen_count = state.get("regen_count", 0)
    logger.info("Email draft ready (attempt %d). Routing to submit_approval for Telegram notification.", regen_count)
    return "submit_approval"


def route_after_approval(state: DispatchState) -> str:
    """Route execution based on human approval status and channel preference."""
    status = state.get("approval_status", "")
    if status == "approved":
        lead_info = state.get("lead_info", {})
        channel = lead_info.get("channel", "").upper()
        has_email = bool(lead_info.get("contact_email"))
        has_phone = bool(lead_info.get("phone") or lead_info.get("contact_phone"))

        if has_email:
            logger.info("Lead %s approved for Email dispatch via Resend.", state.get("lead_id"))
            return "send_email"
        elif has_phone:
            logger.info("Lead %s approved for WhatsApp dispatch.", state.get("lead_id"))
            return "send_whatsapp"
        return "send_email"
    elif status == "rejected":
        return "handle_rejection"
    else:  # "expired", "error", or timeout
        return "move_to_ready"


# ── GRAPH BUILDER ──────────────────────────────────────────────

def build_dispatch_agent() -> StateGraph:
    """Build and compile the multi-node Review & Dispatch LangGraph Agent."""
    builder = StateGraph(DispatchState)

    # Add Nodes
    builder.add_node("fetch_context", fetch_context_node)
    builder.add_node("eval_draft", eval_draft_node)
    builder.add_node("regenerate", regenerate_node)
    builder.add_node("submit_approval", submit_approval_node)
    builder.add_node("handle_rejection", handle_rejection_node)
    builder.add_node("send_email", send_email_node)
    builder.add_node("send_whatsapp", send_whatsapp_node)
    builder.add_node("move_to_sent", move_to_sent_node)
    builder.add_node("archive", archive_node)
    builder.add_node("move_to_ready", move_to_ready_node)

    # Entry point
    builder.set_entry_point("fetch_context")

    # Conditional edges
    builder.add_conditional_edges("fetch_context", route_after_fetch, {
        "archive": "archive",
        "eval_draft": "eval_draft",
    })

    builder.add_conditional_edges("eval_draft", route_after_eval, {
        "submit_approval": "submit_approval",
        "regenerate": "regenerate",
        "archive": "archive",
    })

    builder.add_edge("regenerate", "eval_draft")

    builder.add_conditional_edges("submit_approval", route_after_approval, {
        "send_email": "send_email",
        "send_whatsapp": "send_whatsapp",
        "handle_rejection": "handle_rejection",
        "move_to_ready": "move_to_ready",
    })

    builder.add_edge("handle_rejection", "regenerate")
    builder.add_edge("send_email", "move_to_sent")
    builder.add_edge("send_whatsapp", "move_to_sent")
    builder.add_edge("move_to_sent", END)
    builder.add_edge("archive", END)
    builder.add_edge("move_to_ready", END)

    return builder.compile()


async def run_dispatch(lead_id: str, graph) -> dict:
    """Execute the Review & Dispatch agent for a single lead."""
    initial_state = DispatchState(
        lead_id=lead_id,
        regen_count=0,
    )

    final_state = await graph.ainvoke(initial_state)

    return {
        "lead_id": lead_id,
        "dispatch_status": final_state.get("dispatch_status", "completed"),
        "approval_status": final_state.get("approval_status", "n/a"),
        "regen_count": final_state.get("regen_count", 0),
        "eval_critique": final_state.get("eval_critique", ""),
    }
