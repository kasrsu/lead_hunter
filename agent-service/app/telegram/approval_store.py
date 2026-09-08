"""In-memory store that bridges the LangGraph agent (async) and Telegram callbacks.

Each pending approval gets a UUID key and an asyncio.Event.
The submit_approval node creates an entry and awaits the event.
The Telegram callback handler resolves the event.
"""
import asyncio
import uuid
from dataclasses import dataclass, field
from enum import Enum


class ApprovalResult(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "expired"


@dataclass
class PendingApproval:
    id: str
    lead_id: str
    event: asyncio.Event = field(default_factory=asyncio.Event)
    result: ApprovalResult | None = None
    telegram_message_id: int | None = None
    telegram_chat_id: int | None = None


class ApprovalStore:
    """Singleton store. One instance shared between FastAPI and Telegram bot."""

    def __init__(self):
        self._approvals: dict[str, PendingApproval] = {}

    def create(self, lead_id: str) -> PendingApproval:
        approval_id = uuid.uuid4().hex[:12]
        approval = PendingApproval(id=approval_id, lead_id=lead_id)
        self._approvals[approval_id] = approval
        return approval

    def get(self, approval_id: str) -> PendingApproval | None:
        return self._approvals.get(approval_id)

    async def wait(self, approval: PendingApproval, timeout: float = 3600) -> ApprovalResult:
        """Block until resolved. Returns TIMEOUT if deadline passes."""
        try:
            await asyncio.wait_for(approval.event.wait(), timeout=timeout)
            return approval.result or ApprovalResult.TIMEOUT
        except asyncio.TimeoutError:
            approval.result = ApprovalResult.TIMEOUT
            return ApprovalResult.TIMEOUT
        finally:
            self._approvals.pop(approval.id, None)

    def resolve(self, approval_id: str, result: ApprovalResult) -> PendingApproval | None:
        approval = self._approvals.get(approval_id)
        if approval:
            approval.result = result
            approval.event.set()
        return approval


# Singleton instance
approval_store = ApprovalStore()
