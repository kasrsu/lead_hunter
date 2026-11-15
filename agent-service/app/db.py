"""Direct SQLite access for the Python agent service.
Shares the same WAL-mode database file as the Next.js app.
"""
import sqlite3
import json
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "leadhunt.db"

_connection: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _connection = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode=WAL")
        _connection.execute("PRAGMA foreign_keys=ON")
        # Ensure pending_approvals table exists in case DB hasn't migrated from Next.js yet
        _connection.execute("""
            CREATE TABLE IF NOT EXISTS pending_approvals (
                id                  TEXT PRIMARY KEY,
                lead_id             TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
                telegram_message_id INTEGER,
                telegram_chat_id    INTEGER NOT NULL,
                status              TEXT NOT NULL DEFAULT 'pending'
                                    CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
                created_at          TEXT NOT NULL DEFAULT (datetime('now')),
                resolved_at         TEXT
            );
        """)
        # Ensure targets table exists for manager agent goal tracking
        _connection.execute("""
            CREATE TABLE IF NOT EXISTS targets (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                label         TEXT NOT NULL,
                target_stage  TEXT NOT NULL,
                target_count  INTEGER NOT NULL,
                period_start  TEXT NOT NULL,
                deadline      TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'active',
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        _connection.commit()
    return _connection


def dict_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


# ── Lead queries ──────────────────────────────────────────────

def get_lead(lead_id: str) -> dict[str, Any] | None:
    row = get_db().execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    return dict_from_row(row) if row else None


def update_lead_email_draft(lead_id: str, subject: str, body: str) -> None:
    get_db().execute(
        "UPDATE leads SET email_subject = ?, email_body = ?, updated_at = datetime('now') WHERE id = ?",
        (subject, body, lead_id),
    )
    get_db().commit()


def update_lead_stage(lead_id: str, stage: str) -> None:
    get_db().execute(
        "UPDATE leads SET pipeline_stage = ?, updated_at = datetime('now') WHERE id = ?",
        (stage, lead_id),
    )
    get_db().commit()


def update_lead_sent(lead_id: str) -> None:
    get_db().execute(
        "UPDATE leads SET pipeline_stage = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
        (lead_id,),
    )
    get_db().commit()


def archive_lead_db(lead_id: str, reason: str) -> None:
    get_db().execute(
        "UPDATE leads SET pipeline_stage = 'archived', review_notes = ?, updated_at = datetime('now') WHERE id = ?",
        (reason, lead_id),
    )
    get_db().commit()


# ── Pending approvals ─────────────────────────────────────────

def create_pending_approval(approval_id: str, lead_id: str, chat_id: int) -> None:
    get_db().execute(
        "INSERT INTO pending_approvals (id, lead_id, telegram_chat_id, status) VALUES (?, ?, ?, 'pending')",
        (approval_id, lead_id, chat_id),
    )
    get_db().commit()


def resolve_pending_approval(approval_id: str, status: str) -> None:
    get_db().execute(
        "UPDATE pending_approvals SET status = ?, resolved_at = datetime('now') WHERE id = ?",
        (status, approval_id),
    )
    get_db().commit()


def update_pending_approval_message(approval_id: str, message_id: int) -> None:
    get_db().execute(
        "UPDATE pending_approvals SET telegram_message_id = ? WHERE id = ?",
        (message_id, approval_id),
    )
    get_db().commit()
