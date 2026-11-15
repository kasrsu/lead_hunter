"""Telegram bot service using python-telegram-bot v20+.
Runs as an async background task alongside FastAPI.
"""
import os
import asyncio
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

from .approval_store import approval_store, ApprovalResult
from .formatters import format_approval_message
from ..db import get_lead, resolve_pending_approval, update_pending_approval_message

logger = logging.getLogger("telegram_bot")
logger.setLevel(logging.INFO)

_bot_app: Application | None = None


def get_target_chat_id() -> int:

    val = os.getenv("TELEGRAM_CHAT_ID", "0")
    try:
        return int(val)
    except ValueError:
        logger.error("Invalid TELEGRAM_CHAT_ID: %s", val)
        return 0


def build_keyboard(
    approval_id: str,
    lead_id: str,
    lead: dict | None = None,
    email_sent: bool = False,
    wa_sent: bool = False,
) -> InlineKeyboardMarkup:
    email = lead.get("contact_email") or lead.get("contactEmail") if lead else None
    phone = lead.get("phone") if lead else None

    actions = []
    if email:
        if email_sent:
            actions.append(InlineKeyboardButton("✅ Email Sent", callback_data="done"))
        else:
            actions.append(InlineKeyboardButton("📧 Send Email (Resend)", callback_data=f"approve_email:{lead_id}:{approval_id}"))

    if phone:
        if wa_sent:
            actions.append(InlineKeyboardButton("✅ WhatsApp Ready", callback_data="done"))
        else:
            actions.append(InlineKeyboardButton("💬 Send via WhatsApp", callback_data=f"approve_wa:{lead_id}:{approval_id}"))

    if not actions:
        actions.append(InlineKeyboardButton("✅ Approve", callback_data=f"approve:{lead_id}:{approval_id}"))

    return InlineKeyboardMarkup([
        actions,
        [
            InlineKeyboardButton("🔄 Regenerate Draft", callback_data=f"regen:{lead_id}:{approval_id}"),
        ],
    ])


async def send_approval_request(
    application: Application,
    lead_id: str,
    approval_id: str,
) -> int:
    """Send the formatted approval message. Returns the Telegram message_id."""
    lead = get_lead(lead_id)
    if not lead:
        logger.error("Lead %s not found in database", lead_id)
        raise ValueError(f"Lead {lead_id} not found")

    chat_id = get_target_chat_id()
    if not chat_id:
        logger.error("TELEGRAM_CHAT_ID environment variable is missing or invalid (%s)", os.getenv("TELEGRAM_CHAT_ID"))
        raise ValueError("TELEGRAM_CHAT_ID is missing or 0")

    text = format_approval_message(lead)
    keyboard = build_keyboard(approval_id, lead_id, lead)

    logger.info("📲 Sending Telegram message for lead '%s' to chat_id %s...", lead.get("name"), chat_id)

    msg = await application.bot.send_message(
        chat_id=chat_id,
        text=text,
        parse_mode="HTML",
        reply_markup=keyboard,
        disable_web_page_preview=True,
    )

    logger.info("✅ Telegram approval message sent successfully! Message ID: %s", msg.message_id)
    update_pending_approval_message(approval_id, msg.message_id)
    return msg.message_id


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle inline button presses."""
    query = update.callback_query
    if not query:
        return

    await query.answer()

    data = query.data or ""  # "approve_email:LEAD_ID:APPROVAL_ID" or "approve_wa:..." or "regen:..."
    if data == "done":
        return

    logger.info("🔘 Received Telegram callback button press: %s", data)
    parts = data.split(":")
    if len(parts) < 2:
        if query.message:
            await query.edit_message_reply_markup(reply_markup=None)
        return

    action = parts[0]
    lead_id = parts[1]
    approval_id = parts[2] if len(parts) >= 3 else ""

    if action in ["approve", "approve_email"]:
        logger.info("✅ Human approved email outreach for lead %s via Telegram", lead_id)
        if approval_id:
            approval_store.resolve(approval_id, ApprovalResult.APPROVED)
            resolve_pending_approval(approval_id, "approved")

        lead = get_lead(lead_id)
        to_email = lead.get("contact_email") or lead.get("contactEmail") if lead else None
        to_phone = lead.get("phone") if lead else None

        if lead and to_email:
            try:
                from ..email_sender import send_email
                from ..db import update_lead_sent

                subject = lead.get("email_subject") or lead.get("emailSubject") or "Outreach"
                body = lead.get("email_body") or lead.get("emailBody") or ""

                send_email(to=to_email, subject=subject, body=body)
                update_lead_sent(lead_id)
                logger.info("📬 Email dispatched via Resend API to %s for lead %s!", to_email, lead_id)

                if query.message:
                    # Update keyboard so WhatsApp is still clickable if phone exists
                    updated_keyboard = build_keyboard(approval_id, lead_id, lead, email_sent=True, wa_sent=False)
                    await query.edit_message_text(
                        query.message.text + f"\n\n✅ <b>APPROVED & DISPATCHED VIA RESEND EMAIL!</b>\nSent to: <code>{to_email}</code>",
                        parse_mode="HTML",
                        reply_markup=updated_keyboard if to_phone else None,
                    )
            except Exception as send_err:
                logger.exception("Failed to send email via Resend for lead %s: %s", lead_id, send_err)
                if query.message:
                    await query.edit_message_text(
                        query.message.text + f"\n\n⚠️ <b>APPROVED (Resend Dispatch Error)</b>: {send_err}",
                        parse_mode="HTML",
                        reply_markup=None,
                    )
        else:
            if query.message:
                await query.edit_message_text(
                    query.message.text + "\n\n⚠️ <b>APPROVED</b> — Missing contact email in DB.",
                    parse_mode="HTML",
                    reply_markup=None,
                )

    elif action == "approve_wa":
        logger.info("💬 Human approved WhatsApp outreach for lead %s via Telegram", lead_id)
        if approval_id:
            approval_store.resolve(approval_id, ApprovalResult.APPROVED)
            resolve_pending_approval(approval_id, "approved")

        lead = get_lead(lead_id)
        to_email = lead.get("contact_email") or lead.get("contactEmail") if lead else None
        to_phone = lead.get("phone") if lead else None

        if lead and to_phone:
            try:
                from ..whatsapp_sender import send_whatsapp_message
                from ..db import update_lead_sent

                body = lead.get("email_body") or lead.get("emailBody") or ""
                res = send_whatsapp_message(to_phone=to_phone, text=body)
                update_lead_sent(lead_id)

                if res.get("status") == "sent":
                    logger.info("💬 WhatsApp message dispatched via %s to %s for lead %s!", res.get("provider"), to_phone, lead_id)
                    status_text = f"✅ <b>APPROVED & DISPATCHED VIA WHATSAPP!</b>\nSent to: <code>{to_phone}</code>"
                else:
                    wa_url = res.get("url", "#")
                    logger.info("💬 WhatsApp click link created for %s for lead %s", to_phone, lead_id)
                    status_text = f"✅ <b>APPROVED & READY FOR WHATSAPP!</b>\nPhone: <code>{to_phone}</code>\n🔗 <a href='{wa_url}'>Click to open chat in WhatsApp</a>"

                if query.message:
                    # Update keyboard so Email is still clickable if email exists
                    updated_keyboard = build_keyboard(approval_id, lead_id, lead, email_sent=False, wa_sent=True)
                    await query.edit_message_text(
                        query.message.text + f"\n\n{status_text}",
                        parse_mode="HTML",
                        reply_markup=updated_keyboard if to_email else None,
                        disable_web_page_preview=True,
                    )
            except Exception as wa_err:
                logger.exception("Failed to send WhatsApp message for lead %s: %s", lead_id, wa_err)
                if query.message:
                    await query.edit_message_text(
                        query.message.text + f"\n\n⚠️ <b>APPROVED (WhatsApp Dispatch Error)</b>: {wa_err}",
                        parse_mode="HTML",
                        reply_markup=None,
                    )
        else:
            if query.message:
                await query.edit_message_text(
                    query.message.text + "\n\n⚠️ <b>APPROVED</b> — Missing phone number in DB.",
                    parse_mode="HTML",
                    reply_markup=None,
                )

    elif action == "reject":
        logger.info("❌ Human rejected email for lead %s via Telegram", lead_id)
        if approval_id:
            approval_store.resolve(approval_id, ApprovalResult.REJECTED)
            resolve_pending_approval(approval_id, "rejected")
        if query.message:
            await query.edit_message_text(
                query.message.text + "\n\n❌ <b>REJECTED</b> — Agent will regenerate.",
                parse_mode="HTML",
                reply_markup=None,
            )

    elif action == "regen":
        logger.info("🔄 Human requested regeneration for lead %s via Telegram", lead_id)
        if approval_id:
            approval_store.resolve(approval_id, ApprovalResult.REJECTED)
            resolve_pending_approval(approval_id, "rejected")
        if query.message:
            await query.edit_message_text(
                query.message.text + "\n\n🔄 <b>REGENERATE</b> — Agent will rewrite the email.",
                parse_mode="HTML",
                reply_markup=None,
            )


async def send_message(chat_id: int | str, text: str) -> None:
    """Send a plain text proactive message via the Telegram bot application."""
    if not _bot_app:
        logger.warning("Cannot send Telegram message: bot application is not initialized.")
        return
    logger.info("📤 Proactive Telegram message sent to chat_id %s: %s", chat_id, text)
    await _bot_app.bot.send_message(chat_id=chat_id, text=text, parse_mode="HTML")


async def free_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle free-text messages by routing to the Manager Agent."""
    if update.message and update.message.text:
        user_text = update.message.text
        chat_id = str(update.message.chat_id)
        logger.info("💬 Free text message received from chat_id %s: %s", chat_id, user_text)

        try:
            from ..manager.agent import chat as manager_chat
            reply = await asyncio.to_thread(manager_chat, user_text, chat_id)
            logger.info("📤 Free text reply sent to chat_id %s: %s", chat_id, reply)
            try:
                await update.message.reply_text(reply, parse_mode="HTML")
            except Exception:
                await update.message.reply_text(reply)
        except Exception as e:
            logger.exception("Error processing free text via manager agent: %s", e)
            await update.message.reply_text(f"⚠️ Error chatting with Manager Agent: {e}")



async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Simple /start command to verify bot is alive."""
    if update.message:
        user_id = update.message.from_user.id if update.message.from_user else "unknown"
        logger.info("Received /start command from user_id: %s", user_id)
        await update.message.reply_text(
            f"🤖 Lead Hunter Bot is connected!\nYour Chat ID is: `{user_id}`\n\nI will send you lead outreach emails to approve.",
            parse_mode="Markdown",
        )


async def reset_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Clear chat history memory for this chat."""
    if update.message:
        chat_id = str(update.message.chat_id)
        from ..manager.agent import clear_chat_history
        clear_chat_history(chat_id)
        logger.info("🧹 Memory reset triggered for chat_id: %s", chat_id)
        await update.message.reply_text("🧹 Memory cleared, Boss! Fresh slate ready for action. 🚀")


def create_bot_application(token: str) -> Application:
    """Build and configure the telegram Application."""
    global _bot_app
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("reset", reset_handler))
    app.add_handler(CommandHandler("clear", reset_handler))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, free_text_handler))
    _bot_app = app
    return app



async def run_bot_polling(application: Application) -> None:
    """Long-polling loop. Run as an asyncio background task with conflict resilience."""
    token = getattr(application.bot, "token", "")
    if token:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(f"https://api.telegram.org/bot{token}/deleteWebhook?drop_pending_updates=true")
        except Exception:
            pass

    logger.info("🚀 Starting Telegram bot polling listener...")
    try:
        await application.initialize()
        await application.start()
        await application.updater.start_polling(drop_pending_updates=True, poll_interval=1.0)
        logger.info("✅ Telegram bot polling active and listening for events.")
        await asyncio.Event().wait()
    except Exception as err:
        err_str = str(err)
        if "Conflict" in err_str or "terminated by other getUpdates" in err_str:
            logger.warning("⚠️ Telegram 409 Conflict detected from previous reload session. Cleaning up...")
            try:
                if application.updater and application.updater.is_running:
                    await application.updater.stop()
            except Exception:
                pass
        else:
            logger.error("Error in Telegram bot polling loop: %s", err)
