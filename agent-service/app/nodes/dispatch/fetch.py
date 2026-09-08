"""Fetch context node for dispatch agent graph."""
import logging
from ...state.dispatch_state import DispatchState
from ...db import get_lead

logger = logging.getLogger(__name__)


async def fetch_context_node(state: DispatchState) -> dict:
    """Fetch lead record from SQLite DB and populate state."""
    lead_id = state["lead_id"]
    lead = get_lead(lead_id)
    if not lead:
        logger.error("Lead %s not found in DB", lead_id)
        return {
            "dispatch_status": "error",
            "eval_critique": f"Lead {lead_id} not found",
        }

    return {
        "lead_info": lead,
        "lead_score": {
            "lead_score": lead.get("lead_score"),
            "opportunity_score": lead.get("opportunity_score"),
            "priority_tier": lead.get("priority_tier"),
            "classification": lead.get("classification"),
            "template_type": lead.get("template_type"),
        },
        "email_subject": lead.get("email_subject") or "",
        "email_body": lead.get("email_body") or "",
        "regen_count": state.get("regen_count", 0),
    }
