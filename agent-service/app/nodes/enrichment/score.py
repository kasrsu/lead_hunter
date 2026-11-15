"""Score node for lead enrichment graph."""
from typing import Any
from ...state.enrichment_state import EnrichmentState
from ...scoring import score_lead


async def score_node(state: EnrichmentState) -> dict[str, Any]:
    """Score the lead using the deterministic rubric (no LLM call)."""
    return score_lead(state["lead"])
