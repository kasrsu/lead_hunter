"""Dispatch terminal nodes for dispatch agent graph (email sending, stage updates, archiving)."""
import logging
from ...state.dispatch_state import DispatchState
from ...db import update_lead_stage, update_lead_sent, archive_lead_db
from ...email_sender import send_email as resend_send
from ...whatsapp_sender import send_whatsapp_message

logger = logging.getLogger(__name__)


async def send_email_node(state: DispatchState) -> dict:
    """Send the approved email via Resend API."""
    lead_id = state["lead_id"]
    lead = state.get("lead_info", {})
    to_email = lead.get("contact_email")
    subject = state.get("email_subject") or lead.get("email_subject", "")
    body = state.get("email_body") or lead.get("email_body", "")

    if not to_email:
        logger.error("Lead %s missing contact_email during send_email_node", lead_id)
        return {"dispatch_status": "failed_no_email"}

    try:
        resend_send(to=to_email, subject=subject, body=body)
        return {"dispatch_status": "email_sent"}
    except Exception as e:
        logger.exception("Resend email dispatch failed for lead %s", lead_id)
        return {"dispatch_status": f"send_failed: {e}"}


async def send_whatsapp_node(state: DispatchState) -> dict:
    """Send the approved message via WhatsApp API or generate click-to-chat URL."""
    lead_id = state["lead_id"]
    lead = state.get("lead_info", {})
    phone = lead.get("phone") or lead.get("contact_phone", "")
    body = state.get("email_body") or lead.get("email_body", "")

    if not phone:
        logger.error("Lead %s missing phone number during send_whatsapp_node", lead_id)
        return {"dispatch_status": "failed_no_phone"}

    try:
        res = send_whatsapp_message(to_phone=phone, text=body)
        if res.get("status") == "sent":
            return {"dispatch_status": "whatsapp_sent"}
        else:
            return {"dispatch_status": "whatsapp_link_generated", "whatsapp_url": res.get("url")}
    except Exception as e:
        logger.exception("WhatsApp dispatch failed for lead %s", lead_id)
        return {"dispatch_status": f"send_failed: {e}"}


async def move_to_sent_node(state: DispatchState) -> dict:
    """Update lead stage to 'sent' in SQLite DB."""
    lead_id = state["lead_id"]
    update_lead_sent(lead_id)
    return {"dispatch_status": "sent"}


async def archive_node(state: DispatchState) -> dict:
    """Archive lead in SQLite DB with reason."""
    lead_id = state["lead_id"]
    lead_info = state.get("lead_info", {})

    if not lead_info.get("contact_email"):
        reason = "No contact email address"
    elif state.get("regen_count", 0) >= 2:
        reason = "Exceeded maximum email regeneration attempts (2)"
    else:
        reason = state.get("eval_critique") or "Archived by dispatch agent"

    archive_lead_db(lead_id, reason)
    return {"dispatch_status": "archived"}


async def move_to_ready_node(state: DispatchState) -> dict:
    """Update lead stage to 'ready' (e.g. on approval timeout)."""
    lead_id = state["lead_id"]
    update_lead_stage(lead_id, "ready")
    return {"dispatch_status": "timed_out"}
