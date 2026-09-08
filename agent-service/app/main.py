"""FastAPI HTTP wrapper around the LangGraph agents.

Next.js POSTs to /enrich for email drafting, and to /dispatch for review, Telegram approval, and email sending.
"""

import os
import asyncio
import logging
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

# Load .env file explicitly from agent-service directory or root
env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
# Suppress verbose HTTP long-polling logs from httpx/httpcore
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger("agent_main")

try:
    from app.graphs import enrich_lead, build_dispatch_agent, run_dispatch
    from app.nodes.dispatch import set_telegram_app, execute_target_batch
    from app.telegram.bot import create_bot_application, run_bot_polling
    from app.manager.scheduler import start_scheduler, stop_scheduler
except ImportError:
    from .graphs import enrich_lead, build_dispatch_agent, run_dispatch
    from .nodes.dispatch import set_telegram_app, execute_target_batch
    from .telegram.bot import create_bot_application, run_bot_polling
    from .manager.scheduler import start_scheduler, stop_scheduler


# ── Pydantic Schemas ──────────────────────────────────────────

class SenderIn(BaseModel):
    senderName: str = "EVO Solutions Outreach"
    senderCompany: str = "EVO Solutions"
    offerDescription: str = "Digital storefront optimization, dynamic menu pricing & lead intelligence"
    senderEmail: str = "outreach@evosolutions.com"


class LeadIn(BaseModel):
    placeId: str = "lead_id"
    name: str = "Business Lead"
    address: str = ""
    phone: str = ""
    rating: float = 0.0
    reviews: int = 0
    mapsUrl: str = ""
    category: str = ""


class EnrichRequest(BaseModel):
    lead: LeadIn
    sender: SenderIn


class DispatchRequest(BaseModel):
    lead_id: str


class DispatchResponse(BaseModel):
    lead_id: str
    dispatch_status: str
    approval_status: str
    regen_count: int
    eval_critique: str


class TargetStartRequest(BaseModel):
    target_id: Optional[int] = None
    count: Optional[int] = 15


# ── Lifespan Setup ─────────────────────────────────────────────

telegram_app = None
dispatch_graph = None
bot_polling_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global telegram_app, dispatch_graph, bot_polling_task

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    logger.info("=== Starting Lead Hunter Agent Service ===")
    logger.info("Ollama Base URL: %s", ollama_url)
    logger.info("Telegram Bot Token: %s", "CONFIGURED" if bot_token else "MISSING")
    logger.info("Telegram Chat ID: %s", chat_id if chat_id else "MISSING")
    logger.info("Resend API Key: %s", "CONFIGURED" if resend_key else "MISSING")

    # Build the multi-node dispatch agent graph
    dispatch_graph = build_dispatch_agent()

    # Initialize Telegram bot if environment variables exist
    if bot_token and chat_id:
        try:
            telegram_app = create_bot_application(bot_token)
            set_telegram_app(telegram_app)
            bot_polling_task = asyncio.create_task(run_bot_polling(telegram_app))
            logger.info("✅ Telegram bot initialized & listening for chat_id: %s", chat_id)
        except Exception as e:
            logger.error("❌ Failed to initialize Telegram bot: %s", e)
    else:
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured — Telegram approval bot disabled")

    # Start target tracking scheduler
    try:
        start_scheduler()
    except Exception as e:
        logger.error("❌ Failed to start target checker scheduler: %s", e)

    yield

    stop_scheduler()

    if bot_polling_task and not bot_polling_task.done():
        bot_polling_task.cancel()
        try:
            await bot_polling_task
        except asyncio.CancelledError:
            pass

    if telegram_app:
        try:
            await telegram_app.updater.stop()
            await telegram_app.stop()
            await telegram_app.shutdown()
            logger.info("Telegram bot stopped cleanly")
        except Exception as e:
            logger.error("Error shutting down Telegram bot: %s", e)



app = FastAPI(title="Lead Hunter Agent Service", version="0.2.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "telegram_enabled": telegram_app is not None,
        "chat_id": os.getenv("TELEGRAM_CHAT_ID", ""),
    }


@app.post("/enrich")
async def enrich(req: EnrichRequest) -> dict:
    try:
        enriched = await enrich_lead(req.lead.model_dump(), req.sender.model_dump())
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"lead": enriched}


@app.post("/dispatch", response_model=DispatchResponse)
async def dispatch(req: DispatchRequest):
    logger.info("🚀 Received POST /dispatch for lead_id: %s", req.lead_id)

    if not dispatch_graph:
        raise HTTPException(status_code=503, detail="Dispatch agent graph not initialized")

    try:
        result = await run_dispatch(req.lead_id, dispatch_graph)
        logger.info("✨ Completed dispatch execution for lead %s. Result: %s", req.lead_id, result)
        return DispatchResponse(**result)
    except Exception as err:
        logger.exception("❌ Dispatch execution failed for lead %s: %s", req.lead_id, err)
        raise HTTPException(status_code=500, detail=str(err)) from err


@app.post("/start-target")
async def start_target_endpoint(req: TargetStartRequest = TargetStartRequest()) -> dict:
    logger.info("🎯 Received POST /start-target request: target_id=%s, count=%s", req.target_id, req.count)
    try:
        asyncio.create_task(execute_target_batch(target_id=req.target_id, max_count=req.count))
        return {
            "status": "target_execution_launched",
            "message": "Target outreach agent deployment launched in background.",
            "target_id": req.target_id,
            "count": req.count or 15,
        }
    except Exception as err:
        logger.exception("❌ Failed to launch target execution: %s", err)
        raise HTTPException(status_code=500, detail=str(err)) from err
