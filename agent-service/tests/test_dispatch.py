import sys
from pathlib import Path

# Insert root of agent-service so `app.*` imports resolve
agent_service_dir = Path(__file__).resolve().parents[1]
if str(agent_service_dir) not in sys.path:
    sys.path.insert(0, str(agent_service_dir))

# pyrefly: ignore [missing-import]
import pytest

from app.dispatch_state import DispatchState
from app.dispatch_graph import route_after_fetch, route_after_eval, route_after_approval


def test_route_after_fetch_no_email():
    state: DispatchState = {"lead_info": {"name": "Test Co", "contact_email": ""}}
    assert route_after_fetch(state) == "archive"


def test_route_after_fetch_has_email():
    state: DispatchState = {"lead_info": {"name": "Test Co", "contact_email": "test@example.com"}}
    assert route_after_fetch(state) == "eval_draft"


def test_route_after_eval_good_draft():
    state: DispatchState = {"is_good_draft": True, "regen_count": 0}
    assert route_after_eval(state) == "submit_approval"


def test_route_after_eval_bad_draft_first_try():
    state: DispatchState = {"is_good_draft": False, "regen_count": 0}
    assert route_after_eval(state) == "regenerate"


def test_route_after_eval_good_draft_after_regen():
    state: DispatchState = {"is_good_draft": True, "regen_count": 1}
    assert route_after_eval(state) == "submit_approval"


def test_route_after_eval_bad_draft_second_try():
    state: DispatchState = {"is_good_draft": False, "regen_count": 1}
    assert route_after_eval(state) == "regenerate"


def test_route_after_eval_bad_draft_max_attempts():
    state: DispatchState = {"is_good_draft": False, "regen_count": 2}
    assert route_after_eval(state) == "archive"


def test_route_after_approval():
    assert route_after_approval({"approval_status": "approved"}) == "send_email"
    assert route_after_approval({"approval_status": "rejected"}) == "handle_rejection"
    assert route_after_approval({"approval_status": "expired"}) == "move_to_ready"

