import sys
from pathlib import Path
from datetime import date

agent_service_dir = Path(__file__).resolve().parents[1]
if str(agent_service_dir) not in sys.path:
    sys.path.insert(0, str(agent_service_dir))

import pytest
from app.db import get_db
from app.manager.targets import check_targets
from app.manager.tools import (
    set_target,
    get_pipeline_summary,
    get_pending_approvals,
    get_target_progress,
    trigger_enrich,
    trigger_dispatch,
)
from app.manager.scheduler import start_scheduler, stop_scheduler, tick


@pytest.fixture(autouse=True)
def setup_db():
    conn = get_db()
    # Ensure tables exist and clear test data
    conn.execute("DELETE FROM targets")
    conn.execute("DELETE FROM pending_approvals")
    conn.execute("DELETE FROM leads")
    conn.execute("DELETE FROM campaigns")
    conn.commit()
    yield
    conn.execute("DELETE FROM targets")
    conn.execute("DELETE FROM pending_approvals")
    conn.execute("DELETE FROM leads")
    conn.execute("DELETE FROM campaigns")
    conn.commit()


def test_set_target_and_check_targets():
    # Set a target: 10 sent by 10 days from period start
    set_target(
        label="Send 10 emails",
        target_stage="sent",
        target_count=10,
        period_start="2026-08-01",
        deadline="2026-08-11",
    )

    # Mock evaluation date on 2026-08-06 (5 days elapsed out of 10 total -> expected = 5)
    today = date(2026, 8, 6)
    results = check_targets(today=today)

    assert len(results) == 1
    t = results[0]
    assert t["label"] == "Send 10 emails"
    assert t["target_count"] == 10
    assert t["expected_by_now"] == 5
    assert t["actual"] == 0
    assert t["behind"] is True
    assert t["overdue"] is False


def test_check_targets_on_track():
    set_target(
        label="Send 10 emails",
        target_stage="sent",
        target_count=10,
        period_start="2026-08-01",
        deadline="2026-08-11",
    )

    conn = get_db()
    conn.execute(
        "INSERT INTO campaigns (id, name, keyword, location) VALUES ('c1', 'Camp 1', 'kw', 'loc')"
    )
    for i in range(6):
        conn.execute(
            """INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage, updated_at)
               VALUES (?, 'c1', ?, ?, 'sent', '2026-08-05T10:00:00')""",
            (f"lead_{i}", f"place_{i}", f"Lead {i}"),
        )
    conn.commit()

    today = date(2026, 8, 6)  # expected = 5
    results = check_targets(today=today)

    assert len(results) == 1
    t = results[0]
    assert t["actual"] == 6
    assert t["expected_by_now"] == 5
    assert t["behind"] is False


def test_pipeline_summary_and_pending_approvals():
    conn = get_db()
    conn.execute(
        "INSERT INTO campaigns (id, name, keyword, location) VALUES ('c1', 'Camp 1', 'kw', 'loc')"
    )
    conn.execute(
        "INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage) VALUES ('l1', 'c1', 'p1', 'Lead 1', 'new')"
    )
    conn.execute(
        "INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage) VALUES ('l2', 'c1', 'p2', 'Lead 2', 'ready')"
    )
    conn.execute(
        "INSERT INTO pending_approvals (id, lead_id, telegram_chat_id, status) VALUES ('app_1', 'l2', 12345, 'pending')"
    )
    conn.commit()

    summary = get_pipeline_summary()
    assert summary.get("new") == 1
    assert summary.get("ready") == 1

    pending = get_pending_approvals()
    assert len(pending) == 1
    assert pending[0]["lead_id"] == "l2"


def test_trigger_enrich_validation():
    conn = get_db()
    conn.execute(
        "INSERT INTO campaigns (id, name, keyword, location) VALUES ('c1', 'Camp 1', 'kw', 'loc')"
    )
    conn.execute(
        "INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage) VALUES ('l_ready', 'c1', 'p1', 'Lead', 'ready')"
    )
    conn.commit()

    res = trigger_enrich("l_ready")
    assert "error" in res
    assert "refusing to re-enrich" in res["error"]


def test_trigger_dispatch_validation():
    conn = get_db()
    conn.execute(
        "INSERT INTO campaigns (id, name, keyword, location) VALUES ('c1', 'Camp 1', 'kw', 'loc')"
    )
    conn.execute(
        "INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage) VALUES ('l_new', 'c1', 'p1', 'Lead', 'new')"
    )
    conn.commit()

    res = trigger_dispatch("l_new")
    assert "error" in res
    assert "not safe to dispatch" in res["error"]


def test_scheduler_lifecycle():
    sched = start_scheduler()
    assert sched is not None
    stop_scheduler()


def test_manager_chat_greeting():
    from app.manager.agent import chat, clear_chat_history
    clear_chat_history("test_user_1")
    reply = chat("Hello! Who are you?", "test_user_1")
    assert reply is not None
    assert len(reply) > 0
    assert ("EVO Lead Operations Manager" in reply or "outreach" in reply.lower() or "pipeline" in reply.lower())


def test_manager_chat_pipeline_stats():
    from app.manager.agent import chat, clear_chat_history
    clear_chat_history("test_user_2")

    conn = get_db()
    conn.execute(
        "INSERT INTO campaigns (id, name, keyword, location) VALUES ('c1', 'Camp 1', 'kw', 'loc')"
    )
    conn.execute(
        "INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage) VALUES ('l1', 'c1', 'p1', 'Lead 1', 'new')"
    )
    conn.execute(
        "INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage) VALUES ('l2', 'c1', 'p2', 'Lead 2', 'ready')"
    )
    conn.commit()

    reply = chat("Can you show me the pipeline summary and stats?", "test_user_2")
    assert reply is not None
    assert "Pipeline Overview" in reply or "new" in reply.lower() or "ready" in reply.lower()


def test_manager_chat_set_target():
    from app.manager.agent import chat, clear_chat_history
    clear_chat_history("test_user_3")

    reply = chat("set target 25 sent by 2026-08-30", "test_user_3")
    assert reply is not None
    assert "Target" in reply or "25" in reply

    conn = get_db()
    cur = conn.execute("SELECT * FROM targets")
    rows = cur.fetchall()
    assert len(rows) == 1
    assert rows[0]["target_count"] == 25


def test_manager_chat_sequential_turns_and_memory():
    from app.manager.agent import chat, clear_chat_history
    clear_chat_history("test_user_4")

    r1 = chat("Hello", "test_user_4")
    r2 = chat("Show pipeline summary", "test_user_4")
    r3 = chat("Check target progress", "test_user_4")

    assert r1 != r2 or "Pipeline" in r2
    assert r2 != r3 or "Target" in r3


def test_manager_agent_wrapper_invoke():
    from app.manager.agent import manager_agent, clear_chat_history
    clear_chat_history("wrapper_test")

    res = manager_agent.invoke(
        {"messages": [{"role": "user", "content": "What is the status of our leads?"}]},
        config={"configurable": {"thread_id": "manager-wrapper_test"}},
    )
    assert "messages" in res
    assert len(res["messages"]) == 1
    last_msg = res["messages"][0]
    assert hasattr(last_msg, "content")
    assert len(last_msg.content) > 0


def test_trigger_start_target_tool():
    from unittest.mock import patch, AsyncMock
    from app.manager.tools import trigger_start_target
    with patch("app.nodes.dispatch.start_target.execute_target_batch", new_callable=AsyncMock):
        res = trigger_start_target(count=5)
        assert res.get("status") == "target_execution_started"
        assert res.get("requested_count") == 5


def test_execute_target_batch_node():
    import asyncio
    from unittest.mock import AsyncMock, patch
    from app.nodes.dispatch.start_target import execute_target_batch

    conn = get_db()
    conn.execute(
        "INSERT INTO campaigns (id, name, keyword, location) VALUES ('c1', 'Camp 1', 'kw', 'loc')"
    )
    conn.execute(
        "INSERT INTO leads (id, campaign_id, place_id, name, pipeline_stage, contact_email, email_subject, email_body) "
        "VALUES ('l_t1', 'c1', 'p1', 'Lead 1', 'ready', 'test1@example.com', 'Subject', 'Body')"
    )
    conn.commit()

    async def _run():
        with patch("app.graphs.dispatch_graph.run_dispatch", new_callable=AsyncMock) as mock_dispatch, \
             patch("app.graphs.enrichment_graph.enrich_lead", new_callable=AsyncMock) as mock_enrich, \
             patch("httpx.AsyncClient", new_callable=AsyncMock):
            mock_dispatch.return_value = {"dispatch_status": "sent"}
            mock_enrich.return_value = {}
            res = await execute_target_batch(max_count=2)
            assert res.get("status") == "success"
            assert res.get("processed_count") >= 1

    asyncio.run(_run())


def test_manager_chat_start_now_intent():
    from unittest.mock import patch, AsyncMock
    from app.manager.agent import _detect_intent_and_run_tools, _format_fallback_response

    with patch("app.nodes.dispatch.start_target.execute_target_batch", new_callable=AsyncMock):
        intent = _detect_intent_and_run_tools("Start now then !")
        assert "trigger_start_target" in intent["tools_executed"]

        report = _format_fallback_response(intent, "Start now then !")
        assert "TARGET OUTREACH DEPLOYED" in report




