"""
scoring_agent.py
────────────────
Evaluates lead metrics using a deterministic 9-factor rubric (0-100),
classifies sales potential, selects outreach channels (EMAIL/WHATSAPP/MANUAL),
and generates personalized 3-sentence outreach email drafts.
"""

def evaluate_and_score_lead(lead_dict):
    name = lead_dict.get("name") or "Your Business"
    rating = lead_dict.get("rating")
    review_count = int(lead_dict.get("reviews") or lead_dict.get("review_count") or 0)
    price_range = lead_dict.get("priceRange") or lead_dict.get("price_range")
    category = lead_dict.get("category")
    website = lead_dict.get("website")
    email = lead_dict.get("email")
    phone = lead_dict.get("phone")
    instagram = lead_dict.get("instagram")
    facebook = lead_dict.get("facebook")

    scores = {}
    justifications = {}

    # 1. Rating Quality (0-20)
    if rating and rating > 0:
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

    # 2. Review Volume (0-15)
    if review_count and review_count > 0:
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

    # 3. Premium Positioning (0-15)
    premium_markers = ["$$$", "$$$$", "Rs 5,000+", "Rs 10,000+", "Rs 6,000"]
    is_fine_dining = category and ("fine dining" in category.lower() or "luxury" in category.lower())
    if is_fine_dining or (price_range and any(m in price_range for m in premium_markers)):
        scores["premium_positioning"] = 15
        justifications["premium_positioning"] = "Clear premium pricing or Fine Dining category."
    elif price_range and ("$$" in price_range or "Rs 3,000" in price_range or "Rs 2,000" in price_range):
        scores["premium_positioning"] = 10
        justifications["premium_positioning"] = "Mid-tier pricing strategy."
    else:
        scores["premium_positioning"] = 5
        justifications["premium_positioning"] = "Standard or unverified pricing."

    # 4. Digital Presence (0-15)
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

    # 5. Contact Availability (0-10)
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

    # 6. Brand Strength (0-10)
    if scores["rating_quality"] >= 15 and scores["review_volume"] >= 10:
        scores["brand_strength"] = 10
        justifications["brand_strength"] = "High ratings at scale indicates a highly defensible brand."
    elif scores["rating_quality"] >= 10 and scores["review_volume"] >= 5:
        scores["brand_strength"] = 5
        justifications["brand_strength"] = "Moderate brand strength with established customer base."
    else:
        scores["brand_strength"] = 2
        justifications["brand_strength"] = "Weak or emerging brand presence."

    # 7. Market Opportunity (0-10)
    if scores["digital_presence"] <= 5 and scores["rating_quality"] >= 15:
        scores["market_opportunity"] = 10
        justifications["market_opportunity"] = "High opportunity: Great physical product but weak digital strategy."
    else:
        scores["market_opportunity"] = 5
        justifications["market_opportunity"] = "Standard B2B sales opportunity."

    # 8. Weakness Exposure (0-5)
    if not has_web or not has_social:
        scores["weakness_exposure"] = 5
        justifications["weakness_exposure"] = "Exposed: Losing D2C margin to 3rd party aggregators."
    else:
        scores["weakness_exposure"] = 0
        justifications["weakness_exposure"] = "Protected: Owns their digital storefront."

    # 9. Ease of Closing (0-5)
    if has_phone and not is_fine_dining:
        scores["ease_of_closing"] = 5
        justifications["ease_of_closing"] = "High ease: Direct phone line and likely owner-operator."
    else:
        scores["ease_of_closing"] = 2
        justifications["ease_of_closing"] = "Medium/Low ease: Corporate gatekeepers or missing contacts."

    total_score = sum(scores.values())

    # Lead Classification
    classification = "GENERAL_OUTREACH"
    if scores["premium_positioning"] == 15 and scores["rating_quality"] >= 15:
        classification = "LUXURY_PREMIUM"
    elif scores["digital_presence"] == 0 and scores["review_volume"] >= 5:
        classification = "DIGITAL_WEAKNESS_OPPORTUNITY"
    elif rating and rating >= 4.6 and review_count and review_count < 150:
        classification = "HIGH_POTENTIAL_GROWTH"
    elif rating and rating < 4.2 and rating > 0:
        classification = "REPUTATION_RISK"
    elif is_fine_dining and not has_social:
        classification = "COMPETITOR_PRESSURE_TARGET"

    # Channel Selection
    channel = "MANUAL"
    if has_phone and total_score > 70:
        channel = "WHATSAPP"
    elif has_email and total_score > 50:
        channel = "EMAIL"

    # Template Selection
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

    # 3-Sentence Outreach Email Pitch
    rating_str = f"{rating}/5" if rating else "a strong"
    review_str = f" from {review_count} reviews" if review_count else ""

    POSTFIX_SIGNATURE = (
        "We have attached our full partnership proposal PDF to this email for your convenience—please feel free to review it! Would love to hear your thoughts or connect for a brief chat.\n\n"
        "If you don't wish to explore this or feel it isn't a fit, please be kind enough to reply and let us know so we can improve and ensure we won't reach out or bother you further.\n\n"
        "Best Regards,\n"
        "Anusara Sugeeshwara\n"
        "Marketing team at EvoSolutions\n"
        "Phone: 0751800804 | Email: hello@evosolutions.lk | Web: evosolutions.lk"
    )

    if review_count >= 500:
        opening = f"Greetings from EvoSolutions! I'm Anusara Sugeeshwara from our marketing team. As one of the most prominent dining landmarks in the area, {name}'s incredible {rating_str} rating across {review_count:,} reviews is a testament to the experience you deliver."
    elif review_count >= 50:
        opening = f"Greetings from EvoSolutions! I'm Anusara Sugeeshwara from our marketing team. We've been following {name}'s strong standing as a local favorite, earning an impressive {rating_str} rating across {review_count} reviews."
    else:
        opening = f"Greetings from EvoSolutions! I'm Anusara Sugeeshwara from our marketing team. We noticed {name} is building a fantastic standard with an impressive {rating_str} rating from {review_count} reviews."

    evo_intro = "At EvoSolutions, we build Sri Lankan restaurant software (smart POS, real-time kitchen displays, and table management) designed to help high-performing venues eliminate operational friction and keep guest experiences smooth."

    if template_type == "luxury_pitch":
        b1 = "- Front-of-house table coordination to streamline service pacing for fine dining"
        b2 = "- Real-time kitchen display sync to eliminate ticket delays during peak dinner hours"
        b3 = "- Centralized billing integration for seamless, error-free guest settlements"
    elif template_type == "social_media_weakness_pitch":
        b1 = "- Direct digital ordering channels to protect D2C margins from third-party aggregators"
        b2 = "- Seamless menu management directly linked to kitchen and cashier displays"
    elif template_type == "hidden_growth_pitch":
        b1 = "- Real-time kitchen display sync to eliminate paper ticket confusion"
        b2 = "- Automated order pacing to handle growing customer volume effortlessly"
    elif template_type == "reputation_fix_pitch":
        b1 = "- Instant POS-to-kitchen order routing to eliminate wait-time bottlenecks"
        b2 = "- Quick cashier settlement workflows to speed up table turnover"
    else:
        b1 = "- Real-time kitchen display sync to eliminate paper ticket delays"
        b2 = "- Front-of-house table management to streamline service pacing"

    bullets = f"{b1}\n{b2}" + (f"\n{b3}" if "b3" in locals() else "")
    email_body = f"Dear {name} Team,\n\n{opening}\n\n{evo_intro}\n\n{bullets}\n\n{POSTFIX_SIGNATURE}"

    return {
        "leadScore": total_score,
        "classification": classification,
        "channel": channel,
        "templateType": template_type,
        "rubricScores": scores,
        "rubricJustification": justifications,
        "emailBody": email_body,
        "reasoningSummary": f"Lead scored {total_score}/100. Classified as {classification} due to rating/digital presence analysis. Routed to {channel}.",
        "pipelineStage": "new"
    }
