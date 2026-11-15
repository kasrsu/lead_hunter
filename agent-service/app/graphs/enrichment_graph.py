"""Lead Enrichment Agent — LangGraph StateGraph construction and execution."""
from typing import Any
from langgraph.graph import StateGraph, START, END
from ..state.enrichment_state import EnrichmentState
from ..nodes.enrichment import (
    research_node,
    score_node,
    draft_node,
    critique_node,
    revise_node,
)

MAX_ITERATIONS = 3


def route_after_critique(state: EnrichmentState) -> str:
    """Determine whether draft is approved or needs revision."""
    if state.get("approved") or state.get("iterations", 0) >= MAX_ITERATIONS:
        return "end"
    return "revise"


def build_enrichment_graph() -> StateGraph:
    """Build and compile the lead enrichment graph."""
    builder = StateGraph(EnrichmentState)

    builder.add_node("research", research_node)
    builder.add_node("score", score_node)
    builder.add_node("draft", draft_node)
    builder.add_node("critique", critique_node)
    builder.add_node("revise", revise_node)

    builder.add_edge(START, "research")
    builder.add_edge("research", "score")
    builder.add_edge("score", "draft")
    builder.add_edge("draft", "critique")
    builder.add_conditional_edges("critique", route_after_critique, {"end": END, "revise": "revise"})
    builder.add_edge("revise", "critique")

    return builder.compile()


enrichment_graph = build_enrichment_graph()


async def enrich_lead(lead: dict[str, Any], sender: dict[str, Any]) -> dict[str, Any]:
    """Run the enrichment graph and return a camelCase enriched lead dictionary for Next.js."""
    result = await enrichment_graph.ainvoke(
        {
            "lead": lead,
            "sender": sender,
            "research_brief": "",
            "email_subject": "",
            "email_body": "",
            "review_notes": "",
            "approved": False,
            "iterations": 0,
        }
    )
    return {
        **lead,
        "researchBrief": result.get("research_brief", ""),
        "leadScore": result.get("lead_score", 0),
        "classification": result.get("classification", "GENERAL_OUTREACH"),
        "channel": result.get("channel", "MANUAL"),
        "whatsappStatus": result.get("whatsapp_status", "unverified"),
        "templateType": result.get("template_type", "general_ai_pitch"),
        "rubricScores": result.get("rubric_scores", {}),
        "rubricJustification": result.get("rubric_justification", {}),
        "reasoningSummary": result.get("reasoning_summary", ""),
        "emailSubject": result.get("email_subject", ""),
        "emailBody": result.get("email_body", ""),
        "reviewNotes": result.get("review_notes", ""),
        "iterations": result.get("iterations", 0),
    }
