"""Approval nodes for dispatch agent graph (Telegram integration)."""
import os
import logging
from ...state.dispatch_state import DispatchState
from ...db import create_pending_approval
from ...telegram.approval_store import approval_store, ApprovalResult
from ...telegram.bot import send_approval_request

logger = logging.getLogger(__name__)

_telegram_app = None


def set_telegram_app(app):
    global _telegram_app
    _telegram_app = app


async def submit_approval_node(state: DispatchState) -> dict:
    """Send Telegram approval request asynchronously without blocking HTTP response."""
    lead_id = state["lead_id"]
    chat_id_str = os.getenv("TELEGRAM_CHAT_ID", "0")
    try:
        chat_id = int(chat_id_str)
    except ValueError:
        chat_id = 0

    logger.info("📩 Entering submit_approval_node for lead %s (chat_id: %s)", lead_id, chat_id)

    if not _telegram_app:
        logger.error("❌ Telegram bot application is NOT initialized! Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.")
        return {
            "approval_status": "error",
            "dispatch_status": "error_telegram_not_initialized",
        }

    approval = approval_store.create(lead_id)
    create_pending_approval(approval.id, lead_id, chat_id)

    try:
        logger.info("📲 Sending approval request to Telegram for approval_id %s...", approval.id)
        await send_approval_request(_telegram_app, lead_id, approval.id)
        logger.info("✅ Telegram approval request dispatched successfully!")

        return {
            "approval_status": "pending",
            "dispatch_status": "telegram_approval_sent",
        }
    except Exception as e:
        logger.exception("❌ Failed in submit_approval_node for lead %s: %s", lead_id, e)
        return {
            "approval_status": "error",
            "dispatch_status": f"telegram_error: {e}",
        }


async def handle_rejection_node(state: DispatchState) -> dict:
    """Prepares state after a Telegram rejection before routing to regenerate_node."""
    return {
        "is_good_draft": False,
    }
