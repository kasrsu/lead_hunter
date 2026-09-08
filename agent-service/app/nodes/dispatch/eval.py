"""Evaluation node for dispatch agent graph."""
import logging
from ...state.dispatch_state import DispatchState
from ...prompts.dispatch_prompts import EVAL_PROMPT_TEMPLATE
from ...llm import call_ollama

logger = logging.getLogger(__name__)


async def eval_draft_node(state: DispatchState) -> dict:
    """LLM Thinking pass: Evaluate current email draft against quality criteria."""
    lead = state.get("lead_info", {})
    subject = state.get("email_subject", "")
    body = state.get("email_body", "")

    if not body:
        return {
            "is_good_draft": False,
            "eval_critique": "No email draft exists.",
        }

    prompt = EVAL_PROMPT_TEMPLATE.format(
        name=lead.get("name", "Unknown"),
        category=lead.get("category", "Business"),
        rating=lead.get("rating", 0),
        reviews=lead.get("reviews", 0),
        address=lead.get("address", ""),
        classification=lead.get("classification", "N/A"),
        subject=subject,
        body=body,
    )

    try:
        content = await call_ollama(prompt, temperature=0.3, timeout=120.0)
        is_good = "DECISION: GOOD" in content.upper()
        return {
            "is_good_draft": is_good,
            "eval_critique": content,
        }
    except Exception as e:
        logger.warning("LLM evaluation failed (%s). Defaulting to pass.", e)
        return {
            "is_good_draft": True,
            "eval_critique": f"Evaluation skipped due to LLM error: {e}",
        }
