"""Regeneration node for dispatch agent graph."""
import json
import logging
from ...state.dispatch_state import DispatchState
from ...prompts.dispatch_prompts import REGEN_PROMPT_TEMPLATE
from ...db import update_lead_email_draft
from ...llm import call_ollama

logger = logging.getLogger(__name__)


async def regenerate_node(state: DispatchState) -> dict:
    """Rewrite email draft using local Ollama model based on evaluation critique or human rejection."""
    lead = state.get("lead_info", {})
    lead_id = state["lead_id"]
    current_subject = state.get("email_subject", "")
    current_body = state.get("email_body", "")

    critique = state.get("rejection_reason") or state.get("eval_critique") or "Improve specificity and CTA."

    prompt = REGEN_PROMPT_TEMPLATE.format(
        name=lead.get("name", "Unknown"),
        category=lead.get("category", "Business"),
        rating=lead.get("rating", 0),
        reviews=lead.get("reviews", 0),
        classification=lead.get("classification", "N/A"),
        template_type=lead.get("template_type", "general_ai_pitch"),
        current_subject=current_subject,
        current_body=current_body,
        feedback=critique,
    )

    try:
        content = await call_ollama(prompt, temperature=0.7, format_json=True, timeout=120.0)
        parsed = json.loads(content)

        raw_name = lead.get("name", "Unknown")
        new_subject = f"Outreach & Partnership Proposal - {raw_name}"
        
        from ..enrichment.draft import _ensure_email_body
        new_body = _ensure_email_body(parsed.get("body", current_body), raw_name)

        # Save regenerated draft to DB
        update_lead_email_draft(lead_id, new_subject, new_body)

        new_regen_count = state.get("regen_count", 0) + 1
        return {
            "email_subject": new_subject,
            "email_body": new_body,
            "regen_count": new_regen_count,
            "rejection_reason": "",
        }

    except Exception as e:
        logger.exception("Regeneration node failed")
        return {
            "regen_count": state.get("regen_count", 0) + 1,
            "eval_critique": f"Regeneration error: {e}",
        }
