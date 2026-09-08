"""Unit tests for the deterministic lead-scoring rubric (no LLM involved).

The rubric (agent-service/app/scoring.py) is the scorecard the agent generates
for every lead, so its totals and classifications are the contract the rest of
the product relies on. These tests pin that contract down.
"""

import sys
from pathlib import Path

# Allow `from app.scoring import ...`
agent_service_dir = Path(__file__).resolve().parents[1]
if str(agent_service_dir) not in sys.path:
    sys.path.insert(0, str(agent_service_dir))

from app.scoring import score_lead  # noqa: E402


def test_digital_weakness_opportunity():
    """High-traffic business with no website/social → the flagship target."""
    lead = {
        "name": "Cafe X",
        "rating": 4.8,
        "reviews": 500,
        "category": "cafe",
        "website": None,
        "phone": None,
        "email": None,
    }
    result = score_lead(lead)

    assert result["lead_score"] == 62
    assert result["classification"] == "DIGITAL_WEAKNESS_OPPORTUNITY"
    assert result["channel"] == "MANUAL"
    assert result["rubric_scores"]["digital_presence"] == 0
    assert result["rubric_scores"]["rating_quality"] == 20


def test_luxury_premium():
    """Fine dining with a phone line → premium angle, WhatsApp channel."""
    lead = {
        "name": "Le Blanc",
        "rating": 4.9,
        "reviews": 2000,
        "category": "Fine dining",
        "price_range": "$$$$",
        "website": None,
        "phone": "+1 555 0100",
    }
    result = score_lead(lead)

    assert result["lead_score"] == 82
    assert result["classification"] == "LUXURY_PREMIUM"
    assert result["channel"] == "WHATSAPP"
    assert result["template_type"] == "luxury_pitch"


def test_reputation_risk():
    """Below-average rating → reputation-fix pitch, low total."""
    lead = {
        "name": "Diner",
        "rating": 3.9,
        "reviews": 30,
        "category": "diner",
        "phone": "+1 555 0101",
    }
    result = score_lead(lead)

    assert result["lead_score"] == 34
    assert result["classification"] == "REPUTATION_RISK"
    assert result["template_type"] == "reputation_fix_pitch"


def test_score_is_never_outside_0_100():
    """Robustness: every rubric dimension sums into a valid 0-100 total."""
    leads = [
        {"name": "A", "rating": 5.0, "reviews": 5000, "category": "Fine dining", "phone": "1"},
        {"name": "B"},  # minimal lead, everything neutral
        {"name": "C", "rating": 1.0, "reviews": 1},
    ]
    for lead in leads:
        result = score_lead(lead)
        assert 0 <= result["lead_score"] <= 100
        assert sum(result["rubric_scores"].values()) == result["lead_score"]
        assert result["rubric_scores"]
