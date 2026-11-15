"""Research node for lead enrichment graph."""
from typing import Any
# pyrefly: ignore [missing-import]
from ...state.enrichment_state import EnrichmentState


async def research_node(state: EnrichmentState) -> dict[str, Any]:
    """Format what's known about the target business into a structured research brief."""
    lead = state["lead"]
    return {
        "research_brief": "\n".join(
            [
                f"Business: {lead.get('name', '')}",
                f"Category: {lead.get('category', '')}",
                f"Address: {lead.get('address', '')}",
                f"Google rating: {lead.get('rating', 0)} from {lead.get('reviews', 0)} reviews",
                "Website: none listed on their Google Business Profile",
            ]
        )
    }
