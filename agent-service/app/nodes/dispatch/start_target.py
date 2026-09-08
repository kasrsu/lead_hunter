"""Target runner node for starting target outreach and automatically deploying dispatches."""
import os
import json
import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from ...db import get_db, get_lead

logger = logging.getLogger(__name__)

DEFAULT_SENDER = {
    "senderName": "EVO Solutions Outreach",
    "senderCompany": "EVO Solutions",
    "offerDescription": "Digital storefront optimization, dynamic menu pricing & lead intelligence",
    "senderEmail": "outreach@evosolutions.com",
}


def _auto_seed_leads_if_empty(conn) -> List[Dict[str, Any]]:
    """Auto-seed database from archived_programming/lead_details.json if DB has 0 leads."""
    count_row = conn.execute("SELECT COUNT(*) AS n FROM leads").fetchone()
    if count_row and count_row["n"] > 0:
        return []

    project_root = Path(__file__).resolve().parents[4]
    details_path = project_root / "archived_programming" / "lead_details.json"
    if not details_path.exists():
        logger.warning("No lead_details.json found for auto-seeding at %s", details_path)
        return []

    try:
        with open(details_path, "r", encoding="utf-8") as f:
            lead_details = json.load(f)

        # Create default campaign if needed
        conn.execute(
            "INSERT OR IGNORE INTO campaigns (id, name, keyword, location, min_rating, min_reviews, created_at) "
            "VALUES ('c_archived', 'Archived Hospitality Leads', 'Fine Dining', 'Colombo', 4.0, 10, datetime('now'))"
        )

        inserted_leads = []
        for idx, lead in enumerate(lead_details):
            lead_id = f"lead_arch_{idx + 1}"
            place_id = lead.get("place_id") or f"place_arch_{idx + 1}"
            name = lead.get("name") or f"Target Lead {idx + 1}"
            phone = lead.get("phone") or ""
            email = lead.get("email") or ""
            category = lead.get("category") or "Fine Dining"
            address = lead.get("address") or ""
            rating = float(lead.get("rating") or 4.5)
            reviews = int(lead.get("review_count") or 50)
            maps_url = lead.get("maps_url") or ""

            conn.execute(
                "INSERT OR IGNORE INTO leads "
                "(id, campaign_id, place_id, name, category, address, phone, contact_email, rating, reviews, maps_url, pipeline_stage, created_at, updated_at) "
                "VALUES (?, 'c_archived', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'))",
                (lead_id, place_id, name, category, address, phone, email, rating, reviews, maps_url),
            )
            inserted_leads.append(lead_id)

        conn.commit()
        logger.info("🌱 Auto-seeded %d leads into SQLite database for target execution", len(inserted_leads))
        return inserted_leads
    except Exception as err:
        logger.exception("Failed to auto-seed leads from JSON: %s", err)
        return []


async def execute_target_batch(
    target_id: Optional[int] = None,
    max_count: Optional[int] = None,
) -> Dict[str, Any]:
    """Fetch active targets, pick eligible leads, and deploy dispatches automatically."""
    conn = get_db()

    # 1. Determine target parameters
    target_row = None
    if target_id is not None:
        target_row = conn.execute("SELECT * FROM targets WHERE id = ?", (target_id,)).fetchone()
    else:
        target_row = conn.execute("SELECT * FROM targets WHERE status = 'active' ORDER BY id DESC LIMIT 1").fetchone()

    target_label = "Daily Email Outreach Target"
    target_count = max_count or 15

    if target_row:
        t_dict = dict(target_row)
        target_label = t_dict.get("label", target_label)
        t_count = t_dict.get("target_count", 15)
        t_stage = t_dict.get("target_stage", "sent")

        # Count actual completed
        actual_row = conn.execute("SELECT COUNT(*) AS n FROM leads WHERE pipeline_stage = ?", (t_stage,)).fetchone()
        actual = actual_row["n"] if actual_row else 0

        needed = max(t_count - actual, 1)
        target_count = min(needed, max_count) if max_count else needed

    # 2. Auto-seed if database is empty
    _auto_seed_leads_if_empty(conn)

    # 3. Query ready/drafted leads first, then new/scored leads
    ready_leads = conn.execute(
        "SELECT id, pipeline_stage, name FROM leads WHERE pipeline_stage IN ('ready', 'drafted') LIMIT ?",
        (target_count,),
    ).fetchall()

    selected_lead_ids = [r["id"] for r in ready_leads]
    remaining_needed = target_count - len(selected_lead_ids)

    if remaining_needed > 0:
        new_leads = conn.execute(
            "SELECT id, pipeline_stage, name FROM leads WHERE pipeline_stage IN ('new', 'scored') AND id NOT IN ({}) LIMIT ?".format(
                ",".join("?" for _ in selected_lead_ids) if selected_lead_ids else "'none'"
            ),
            (*selected_lead_ids, remaining_needed) if selected_lead_ids else (remaining_needed,),
        ).fetchall()
        selected_lead_ids.extend([r["id"] for r in new_leads])

    if not selected_lead_ids:
        logger.warning("No leads available in DB to execute target batch")
        return {
            "status": "warning",
            "target_label": target_label,
            "target_count": target_count,
            "processed_count": 0,
            "lead_ids": [],
            "message": "No leads found in database. Add leads or check pipeline stages.",
        }

    logger.info("🚀 Launching target batch deployment over %d lead(s) for '%s'...", len(selected_lead_ids), target_label)

    from ...graphs.dispatch_graph import build_dispatch_agent, run_dispatch
    from ...graphs.enrichment_graph import enrich_lead

    # Build dispatch graph
    dispatch_graph = build_dispatch_agent()

    processed_ids = []
    failed_ids = []

    for lead_id in selected_lead_ids:
        lead = get_lead(lead_id)
        if not lead:
            continue

        # If lead needs enrichment (email subject/body not yet generated), run enrichment graph first
        stage = lead.get("pipeline_stage", "new")
        if stage in ("new", "scored") or not (lead.get("email_body") or lead.get("emailBody")):
            try:
                logger.info("📝 Enriching lead %s before dispatch...", lead_id)
                await enrich_lead(lead, DEFAULT_SENDER)
            except Exception as e:
                logger.exception("Failed enrichment during target batch for lead %s: %s", lead_id, e)

        # Launch dispatch execution
        try:
            logger.info("📤 Running dispatch pipeline for lead %s...", lead_id)
            res = await run_dispatch(lead_id, dispatch_graph)
            logger.info("✅ Target dispatch completed for lead %s: %s", lead_id, res.get("dispatch_status"))
            processed_ids.append(lead_id)
        except Exception as err:
            logger.exception("❌ Target dispatch failed for lead %s: %s", lead_id, err)
            failed_ids.append(lead_id)

    # Optional: Ping Next.js deploy runner API if running locally
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post("http://localhost:3000/api/agent/deploy", json={"autoSend": False})
    except Exception:
        pass  # Best-effort notification

    return {
        "status": "success",
        "target_label": target_label,
        "target_count": target_count,
        "processed_count": len(processed_ids),
        "lead_ids": processed_ids,
        "failed_count": len(failed_ids),
        "message": f"Target deployment launched! Processed {len(processed_ids)} of {len(selected_lead_ids)} target dispatches.",
    }
