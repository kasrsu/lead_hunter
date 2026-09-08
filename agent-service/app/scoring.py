"""
Lead-scoring rubric — ported from the archived process_leads.py script.

Deterministic, LLM-free 100-point scoring used to rank leads before outreach
and to choose the angle of the outreach email. Runs as the `score` node in
agent.py, right before the LLM draft, so the draft can be tailored to the
lead's classification.

The original script was written against a scraped schema (review_count,
price_range, instagram, facebook...). This port reads the platform's Lead
schema and treats absent fields the way the original treated missing data
(neutral baseline), so it degrades gracefully for the leaner Google Places
search results.
"""


from .whatsapp_sender import verify_whatsapp_status


def score_lead(lead: dict) -> dict:
    """Score a single lead. Returns score, classification, channel, and the
    rubric breakdown — never touches the LLM, so it's fast and reproducible."""
    name = lead.get("name") or "Your Business"
    rating = lead.get("rating")
    review_count = lead.get("reviews") if lead.get("reviews") is not None else lead.get("review_count")
    price_range = lead.get("price_range") or lead.get("priceRange")
    category = lead.get("category")
    website = lead.get("website")
    if website == "" or lead.get("hasWebsite") is False:
        website = None
    email = lead.get("email") or lead.get("contact_email")
    phone = lead.get("phone")
    instagram = lead.get("instagram")
    facebook = lead.get("facebook")

    scores: dict[str, int] = {}
    justifications: dict[str, str] = {}

    # Rating Quality (0-20)
    if rating:
        if rating >= 4.8:
            scores["rating_quality"] = 20
            justifications["rating_quality"] = "Elite rating (4.8+), indicating exceptional customer satisfaction."
        elif rating >= 4.4:
            scores["rating_quality"] = 15
            justifications["rating_quality"] = "Strong rating (4.4+), showing solid market position."
        elif rating >= 4.0:
            scores["rating_quality"] = 10
            justifications["rating_quality"] = "Average rating, acceptable but has room for improvement."
        else:
            scores["rating_quality"] = 5
            justifications["rating_quality"] = "Below average rating, high reputation risk."
    else:
        scores["rating_quality"] = 10
        justifications["rating_quality"] = "No rating data available; assigned neutral baseline."

    # Review Volume (0-15)
    if review_count:
        if review_count >= 1000:
            scores["review_volume"] = 15
            justifications["review_volume"] = "Massive review volume indicating huge foot traffic."
        elif review_count >= 300:
            scores["review_volume"] = 10
            justifications["review_volume"] = "Healthy review volume indicating consistent business."
        elif review_count >= 50:
            scores["review_volume"] = 5
            justifications["review_volume"] = "Moderate review volume, growing but not viral."
        else:
            scores["review_volume"] = 2
            justifications["review_volume"] = "Low review volume, early stage or hidden."
    else:
        scores["review_volume"] = 5
        justifications["review_volume"] = "No review volume data; assigned neutral baseline."

    # Premium Positioning (0-15)
    premium_markers = ["$$$", "$$$$", "Rs 5,000+", "Rs 10,000+"]
    is_fine_dining = bool(category) and "fine dining" in category.lower()
    if is_fine_dining or (price_range and any(m in price_range for m in premium_markers)):
        scores["premium_positioning"] = 15
        justifications["premium_positioning"] = "Clear premium pricing or Fine Dining category."
    elif price_range and ("$$" in price_range or "Rs 3,000" in price_range):
        scores["premium_positioning"] = 10
        justifications["premium_positioning"] = "Mid-tier pricing strategy."
    else:
        scores["premium_positioning"] = 5
        justifications["premium_positioning"] = "Standard or unverified pricing."

    # Digital Presence (0-15)
    has_web = bool(website)
    has_social = bool(instagram or facebook)
    if has_web and has_social:
        scores["digital_presence"] = 15
        justifications["digital_presence"] = "Strong presence: has both website and social links."
    elif has_web or has_social:
        scores["digital_presence"] = 10
        justifications["digital_presence"] = "Partial presence: missing either a website or social link."
    else:
        scores["digital_presence"] = 0
        justifications["digital_presence"] = "Critical gap: no website or social media detected."

    # Contact Availability (0-10)
    has_phone = bool(phone)
    has_email = bool(email)
    if has_phone and has_email:
        scores["contact_availability"] = 10
        justifications["contact_availability"] = "Omnichannel contact: Phone and Email available."
    elif has_phone or has_email:
        scores["contact_availability"] = 5
        justifications["contact_availability"] = "Single channel contact available."
    else:
        scores["contact_availability"] = 0
        justifications["contact_availability"] = "Hard to reach: no direct contact info."

    # Brand Strength (0-10)
    if scores["rating_quality"] >= 15 and scores["review_volume"] >= 10:
        scores["brand_strength"] = 10
        justifications["brand_strength"] = "High ratings at scale indicates a highly defensible brand."
    elif scores["rating_quality"] >= 10 and scores["review_volume"] >= 5:
        scores["brand_strength"] = 5
        justifications["brand_strength"] = "Moderate brand strength with established customer base."
    else:
        scores["brand_strength"] = 2
        justifications["brand_strength"] = "Weak or emerging brand presence."

    # Market Opportunity (0-10)
    if scores["digital_presence"] <= 5 and scores["rating_quality"] >= 15:
        scores["market_opportunity"] = 10
        justifications["market_opportunity"] = "High opportunity: Great physical product but terrible digital strategy."
    else:
        scores["market_opportunity"] = 5
        justifications["market_opportunity"] = "Standard B2B sales opportunity."

    # Weakness Exposure (0-5)
    if not has_web or not has_social:
        scores["weakness_exposure"] = 5
        justifications["weakness_exposure"] = "Exposed: Losing D2C margin to 3rd party aggregators."
    else:
        scores["weakness_exposure"] = 0
        justifications["weakness_exposure"] = "Protected: Owns their digital storefront."

    # Ease of Closing (0-5)
    if has_phone and not is_fine_dining:
        scores["ease_of_closing"] = 5
        justifications["ease_of_closing"] = "High ease: Direct phone line and likely owner-operator."
    else:
        scores["ease_of_closing"] = 2
        justifications["ease_of_closing"] = "Medium/Low ease: Corporate gatekeepers or missing contacts."

    total_score = sum(scores.values())

    # Classification
    classification = "GENERAL_OUTREACH"
    if scores["premium_positioning"] == 15 and scores["rating_quality"] >= 15:
        classification = "LUXURY_PREMIUM"
    elif scores["digital_presence"] == 0 and scores["review_volume"] >= 5:
        classification = "DIGITAL_WEAKNESS_OPPORTUNITY"
    elif rating and rating >= 4.6 and review_count and review_count < 150:
        classification = "HIGH_POTENTIAL_GROWTH"
    elif rating and rating < 4.2:
        classification = "REPUTATION_RISK"
    elif is_fine_dining and not has_social:
        classification = "COMPETITOR_PRESSURE_TARGET"

    # Verify WhatsApp availability
    wa_check = verify_whatsapp_status(phone) if has_phone else {"whatsapp_status": "no_phone", "is_valid": False}
    whatsapp_status = wa_check.get("whatsapp_status", "no_phone")

    # Channel decision (prioritize EMAIL if contact email exists, otherwise WHATSAPP)
    if has_email:
        channel = "EMAIL"
    elif has_phone and wa_check.get("is_valid"):
        channel = "WHATSAPP"
    else:
        channel = "MANUAL"

    # Outreach angle selection
    template_type = "general_ai_pitch"
    if classification == "LUXURY_PREMIUM":
        template_type = "luxury_pitch"
    elif classification == "DIGITAL_WEAKNESS_OPPORTUNITY":
        template_type = "social_media_weakness_pitch"
    elif classification == "HIGH_POTENTIAL_GROWTH":
        template_type = "hidden_growth_pitch"
    elif classification == "REPUTATION_RISK":
        template_type = "reputation_fix_pitch"
    elif classification == "COMPETITOR_PRESSURE_TARGET":
        template_type = "competitor_pressure_pitch"

    return {
        "lead_score": total_score,
        "classification": classification,
        "channel": channel,
        "whatsapp_status": whatsapp_status,
        "template_type": template_type,
        "rubric_scores": scores,
        "rubric_justification": justifications,
        "reasoning_summary": (
            f"Lead scored {total_score}/100. Classified as {classification}. "
            f"WhatsApp Status: {whatsapp_status}. Routed to {channel}."
        ),
    }


# One-line outreach angle per classification, fed to the LLM draft prompt so
# the email message matches why this lead is worth pursuing.
ANGLES: dict[str, str] = {
    "luxury_pitch": (
        "premium positioning — how similar high-end venues protect high-margin "
        "revenue with better digital infrastructure"
    ),
    "social_media_weakness_pitch": (
        "the missing direct digital channel — how businesses lose ~20% margin to "
        "third-party aggregators when they don't own their own storefront"
    ),
    "hidden_growth_pitch": (
        "growth-stage scaling — how venues scale hospitality without manual table "
        "management and menu updates slowing operations down"
    ),
    "reputation_fix_pitch": (
        "recent mixed feedback — how the friction behind wait times and operations "
        "usually comes from disconnected POS and table systems"
    ),
    "competitor_pressure_pitch": (
        "standing out online — how digital-invisible premium venues lose customers "
        "to competitors who show up on Google"
    ),
    "general_ai_pitch": (
        "efficiency and margins — streamlining menu operations and digital infrastructure"
    ),
}
