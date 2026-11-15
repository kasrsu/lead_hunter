"""State definition for the Review & Dispatch LangGraph Agent."""
from typing import Any, TypedDict

# pyrefly: ignore [missing-import]
from langchain_core.messages import BaseMessage


class DispatchState(TypedDict, total=False):
    lead_id: str
    lead_info: dict[str, Any]
    lead_score: dict[str, Any]
    email_subject: str
    email_body: str
    eval_critique: str
    is_good_draft: bool
    regen_count: int
    approval_status: str  # "pending" | "approved" | "rejected" | "expired"
    dispatch_status: str  # "in_progress" | "sent" | "archived" | "timed_out"
    rejection_reason: str
    messages: list[BaseMessage]
