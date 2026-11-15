import sys
from pathlib import Path

# Add root of agent-service so `app.*` imports resolve cleanly
agent_service_dir = Path(__file__).resolve().parents[1]
if str(agent_service_dir) not in sys.path:
    sys.path.insert(0, str(agent_service_dir))

from app.nodes.enrichment.draft import _ensure_email_body, EXACT_SIGNATURE
from app.email_sender import POSTFIX_SIGNATURE


def test_exact_signature_formatting():
    assert EXACT_SIGNATURE == POSTFIX_SIGNATURE
    assert "attached our full partnership proposal PDF" in EXACT_SIGNATURE
    assert "0751800804" in EXACT_SIGNATURE
    assert "evosolutions.lk" in EXACT_SIGNATURE


def test_ensure_email_body_strips_llm_outro_and_appends_postfix():
    raw_llm_body = """Dear Cafe Deluxe Team,

We noticed your fantastic 4.9 rating in Colombo. We can help you expand your online orders.

Please visit evosolutions.lk to learn more.

Best Regards,
Anusara Sugeeshwara,
Marketing Team at EvoSolutions"""

    formatted = _ensure_email_body(raw_llm_body, "Cafe Deluxe")

    # Should preserve body and CTA
    assert "Dear Cafe Deluxe Team," in formatted
    assert "We noticed your fantastic 4.9 rating" in formatted
    assert "evosolutions.lk" in formatted
    
    # Must end with exact signature postfix
    assert formatted.endswith(EXACT_SIGNATURE)
    # Should not double signatures
    assert formatted.count("Best Regards,") == 1
    assert formatted.count("Anusara Sugeeshwara") == 1


def test_ensure_email_body_preserves_custom_personalized_content():
    raw_llm_body = """I wanted to congratulate test bistro on 300+ reviews. Our digital storefront solution can boost your direct takeout margins.

Check out evosolutions.lk for details."""

    formatted = _ensure_email_body(raw_llm_body, "Test Bistro")

    assert formatted.startswith("Dear Test Bistro Team,")
    assert "congratulate test bistro on 300+ reviews" in formatted
    assert formatted.endswith(EXACT_SIGNATURE)


def test_ensure_email_body_preserves_greetings_from_evosolutions():
    raw_llm_body = """Greetings from EvoSolutions! I'm Anusara Sugeeshwara from our marketing team, and I'm reaching out because we've been following Ministry of Crab's 4.8/5 rating across 1,250 reviews.

We build local restaurant technology designed to eliminate friction.

- Real-time kitchen display sync"""

    formatted = _ensure_email_body(raw_llm_body, "Ministry of Crab")

    assert formatted.startswith("Dear Ministry of Crab Team,")
    assert "Greetings from EvoSolutions!" in formatted
    assert "Ministry of Crab's 4.8/5 rating across 1,250 reviews" in formatted
    assert formatted.endswith(EXACT_SIGNATURE)


def test_default_attachment_configuration():
    from app.email_sender import DEFAULT_ATTACHMENT_PATH
    assert DEFAULT_ATTACHMENT_PATH.endswith(".pdf")
    assert "EvoDine_Restaurant_Management" in DEFAULT_ATTACHMENT_PATH


def test_critique_and_revise_prompt_formatting():
    from app.prompts.enrichment_prompts import CRITIQUE_PROMPT_TEMPLATE, REVISE_PROMPT_TEMPLATE
    
    critique_prompt = CRITIQUE_PROMPT_TEMPLATE.format(
        business_name="Test Venue",
        rating="4.8",
        reviews_count="150",
        subject="Outreach - Test Venue",
        body="Dear Test Venue Team,\n\nTest body",
    )
    assert "Test Venue" in critique_prompt

    revise_prompt = REVISE_PROMPT_TEMPLATE.format(
        business_name="Test Venue",
        rating="4.8",
        reviews_count="150",
        address="Colombo 03",
        subject="Outreach - Test Venue",
        body="Dear Test Venue Team,\n\nTest body",
        review_notes="Add details",
    )
    assert "Colombo 03" in revise_prompt

