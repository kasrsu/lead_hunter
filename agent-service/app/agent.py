"""Agentic email-drafting graph (Python agent service).

Re-exports state definitions, nodes, and graph execution runner from modular app package.
"""

from .state.enrichment_state import EnrichmentState, AgentState
from .nodes.enrichment import (
    research_node,
    score_node,
    draft_node,
    critique_node,
    revise_node,
)
from .graphs.enrichment_graph import (
    build_enrichment_graph,
    enrichment_graph as graph,
    enrich_lead,
    route_after_critique,
    MAX_ITERATIONS,
)

__all__ = [
    "EnrichmentState",
    "AgentState",
    "research_node",
    "score_node",
    "draft_node",
    "critique_node",
    "revise_node",
    "build_enrichment_graph",
    "graph",
    "enrich_lead",
    "route_after_critique",
    "MAX_ITERATIONS",
]
