"""State definition for the Lead Enrichment Agent."""
from typing import Any, TypedDict


class EnrichmentState(TypedDict, total=False):
    lead: dict[str, Any]
    sender: dict[str, Any]
    research_brief: str
    lead_score: int
    classification: str
    channel: str
    template_type: str
    rubric_scores: dict[str, int]
    rubric_justification: dict[str, str]
    reasoning_summary: str
    email_subject: str
    email_body: str
    review_notes: str
    approved: bool
    iterations: int


# Backward compatibility alias
AgentState = EnrichmentState
