"""Scheduler tick service for proactive target tracking reminders."""
import os
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .targets import check_targets
from .agent import manager_agent

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def tick() -> None:
    """Check targets and send proactive reminder if any are behind or overdue."""
    try:
        behind = [t for t in check_targets() if t["behind"] or t["overdue"]]
        if not behind:
            logger.info("Target check completed: all targets on schedule.")
            return

        logger.info("Target check: %d target(s) behind or overdue. Generating reminder...", len(behind))

        user_prompt = (
            f"Write a short, direct Telegram reminder about these targets that are behind schedule: {behind}. "
            f"Include what's blocking progress if you can check pending approvals."
        )

        result = await asyncio.to_thread(
            manager_agent.invoke,
            {"messages": [{"role": "user", "content": user_prompt}]},
            {"configurable": {"thread_id": "manager-scheduler"}},
        )

        last_msg = result["messages"][-1]
        reminder_text = getattr(last_msg, "content", str(last_msg))

        chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
        if chat_id:
            from ..telegram.bot import send_message
            await send_message(chat_id, reminder_text)
            logger.info("Proactive target reminder sent to Telegram chat %s", chat_id)
        else:
            logger.warning("TELEGRAM_CHAT_ID not set; skipping sending proactive reminder.")
    except Exception as e:
        logger.exception("Error during scheduler tick: %s", e)


def start_scheduler() -> AsyncIOScheduler:
    """Start the background target checker scheduler."""
    global _scheduler
    if _scheduler is None or not _scheduler.running:
        _scheduler = AsyncIOScheduler()
        _scheduler.add_job(tick, "interval", hours=4, id="target_checker_tick")
        try:
            _scheduler.start()
            logger.info("✅ Target checker AsyncIOScheduler started (interval: 4 hours).")
        except RuntimeError:
            logger.warning("AsyncIOScheduler deferred start (no running asyncio event loop in current context).")
    return _scheduler



def stop_scheduler() -> None:
    """Stop the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Target checker scheduler stopped.")
        _scheduler = None
