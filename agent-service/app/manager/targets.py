"""Deterministic target-progress checks. No LLM calls in this file."""
from __future__ import annotations
from datetime import date, datetime
from typing import Any
from ..db import get_db


def _parse(d: str) -> date:
    if "T" in d:
        d = d.split("T")[0]
    return datetime.strptime(d.strip(), "%Y-%m-%d").date()


def check_targets(today: date | None = None) -> list[dict[str, Any]]:
    """Returns one entry per active target, with pace status.

    behind = actual count is under the linearly-expected count for how much
    of the period has elapsed.
    """
    today = today or date.today()
    conn = get_db()
    cur = conn.execute("SELECT * FROM targets WHERE status = 'active'")
    results = []

    for row in cur.fetchall():
        row_dict = dict(row)
        start = _parse(row_dict["period_start"])
        end = _parse(row_dict["deadline"])
        total_days = max((end - start).days, 1)
        elapsed_days = max((today - start).days, 0)
        pace = min(elapsed_days / total_days, 1.0)
        expected = round(row_dict["target_count"] * pace)

        period_start_str = row_dict["period_start"]
        actual_row = conn.execute(
            "SELECT COUNT(*) AS n FROM leads WHERE pipeline_stage = ? AND (updated_at >= ? OR created_at >= ?)",
            (row_dict["target_stage"], period_start_str, period_start_str),
        ).fetchone()
        actual = actual_row["n"] if actual_row else 0

        days_left = (end - today).days

        results.append({
            "id": row_dict["id"],
            "label": row_dict["label"],
            "target_stage": row_dict["target_stage"],
            "target_count": row_dict["target_count"],
            "actual": actual,
            "expected_by_now": expected,
            "deadline": row_dict["deadline"],
            "days_left": days_left,
            "behind": actual < expected,
            "overdue": today > end and actual < row_dict["target_count"],
        })
    return results
