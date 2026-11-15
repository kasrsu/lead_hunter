"""Revise node for lead enrichment graph."""
from typing import Any
from ...state.enrichment_state import EnrichmentState
from ...prompts.enrichment_prompts import REVISE_PROMPT_TEMPLATE
from ...llm import call_ollama
from .draft import _parse_email


async def revise_node(state: EnrichmentState) -> dict[str, Any]:
    """Rewrite draft based on critique notes."""
    lead = state.get("lead", {})
    business_name = lead.get("name") or state.get("research_brief", "").split("\n")[0].replace("Business:", "").strip() or "Your Business"
    rating = lead.get("rating") if lead.get("rating") is not None else "N/A"
    reviews_count = lead.get("reviews") or lead.get("review_count") or "N/A"
    address = lead.get("address") or lead.get("location") or "N/A"

    prompt = REVISE_PROMPT_TEMPLATE.format(
        business_name=business_name,
        rating=rating,
        reviews_count=reviews_count,
        address=address,
        subject=state.get("email_subject", ""),
        body=state.get("email_body", ""),
        review_notes=state.get("review_notes", ""),
    )

    raw_response = await call_ollama(prompt, temperature=0.6)
    subject, body = _parse_email(raw_response, business_name)

    return {
        "email_subject": subject,
        "email_body": body,
        "iterations": state.get("iterations", 0) + 1,
    }

