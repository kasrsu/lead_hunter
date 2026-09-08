"""Critique node for lead enrichment graph."""
from typing import Any
from ...state.enrichment_state import EnrichmentState
from ...prompts.enrichment_prompts import CRITIQUE_PROMPT_TEMPLATE
from ...llm import call_ollama


async def critique_node(state: EnrichmentState) -> dict[str, Any]:
    """Judge email draft against a 4-point rubric; approve or request changes."""
    lead = state.get("lead", {})
    business_name = lead.get("name") or "Your Business"
    rating = lead.get("rating") if lead.get("rating") is not None else "N/A"
    reviews_count = lead.get("reviews") or lead.get("review_count") or "N/A"

    prompt = CRITIQUE_PROMPT_TEMPLATE.format(
        business_name=business_name,
        rating=rating,
        reviews_count=reviews_count,
        subject=state.get("email_subject", ""),
        body=state.get("email_body", ""),
    )

    text = (await call_ollama(prompt, temperature=0.3)).strip()
    return {"review_notes": text, "approved": text.upper().startswith("APPROVE")}
