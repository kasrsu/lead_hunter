"""
scoring_agent.py
────────────────
Evaluates lead metrics using a deterministic 9-factor rubric (0-100),
classifies sales potential, selects outreach channels (EMAIL/WHATSAPP/MANUAL),
and generates factual B2B opportunity audit metrics & strategy signals (no fake first-person email templates).
"""

def evaluate_and_score_lead(lead_dict):
    name = lead_dict.get("name") or "Business Lead"
    rating = lead_dict.get("rating")
    review_count = int(lead_dict.get("reviews") or lead_dict.get("review_count") or 0)
    price_range = lead_dict.get("priceRange") or lead_dict.get("price_range")
    category = lead_dict.get("category") or "Business"
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
    premium_markers = ["$$$", "$$$$", "Rs 5,000+", "Rs 10,000+"]
    is_fine_dining = category and ("fine dining" in category.lower() or "luxury" in category.lower())
    if is_fine_dining or (price_range and any(m in price_range for m in premium_markers)):
        scores["premium_positioning"] = 15
        justifications["premium_positioning"] = "Clear premium pricing or Fine Dining category."
    elif price_range and ("$$" in price_range or "Rs 3,000" in price_range):
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
        justifications["brand_strength"] = "High ratings at scale indicates a defensible brand."
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
        justifications["weakness_exposure"] = "Exposed: Missing owned digital storefront."
    else:
        scores["weakness_exposure"] = 0
        justifications["weakness_exposure"] = "Protected: Owns digital storefront."

    # 9. Ease of Closing (0-5)
    if has_phone and not is_fine_dining:
        scores["ease_of_closing"] = 5
        justifications["ease_of_closing"] = "High ease: Direct phone line available."
    else:
        scores["ease_of_closing"] = 2
        justifications["ease_of_closing"] = "Medium/Low ease: Corporate gatekeepers."

    total_score = sum(scores.values())

    # Lead Classification
    classification = "GENERAL_OUTREACH"
    if not has_web and review_count >= 5:
        classification = "DIGITAL_WEAKNESS_OPPORTUNITY"
    elif scores["premium_positioning"] == 15 and scores["rating_quality"] >= 15:
        classification = "LUXURY_PREMIUM"
    elif rating and rating >= 4.6 and review_count and review_count < 150:
        classification = "HIGH_POTENTIAL_GROWTH"
    elif rating and rating < 4.2 and rating > 0:
        classification = "REPUTATION_RISK"

    # Channel Selection
    channel = "MANUAL"
    if has_phone and total_score >= 60:
        channel = "WHATSAPP"
    elif has_email and total_score >= 50:
        channel = "EMAIL"

    # Build Factual B2B Audit Metrics & Strategy Signals (No fake first-person email text)
    audit_points = []
    
    cat_lower = (category or "").lower()
    is_agency_software = any(k in cat_lower for k in ["marketing", "advertising", "software", "saas", "tech", "agency", "media", "pr", "consult"])
    is_trades = any(k in cat_lower for k in ["plumbing", "hvac", "roofing", "electrician", "contractor", "repair", "solar"])
    is_professional = any(k in cat_lower for k in ["law", "legal", "attorney", "dentist", "dental", "doctor", "clinic", "cpa", "account"])

    # 1. Digital Footprint Audit
    if not has_web:
        if is_agency_software:
            audit_points.append("🚨 MISSING OFFICIAL WEBSITE: Prime prospect for custom Web Storefront, Inbound Lead Capture & Google Business Optimization ($1,500–$3,500 pitch value).")
        elif is_trades or is_professional:
            audit_points.append("🚨 MISSING OFFICIAL WEBSITE: Prime prospect for Instant Booking/Quote Portal & Google Business Optimization ($1,500–$3,500 pitch value).")
        else:
            audit_points.append("🚨 MISSING OFFICIAL WEBSITE: Prime prospect for custom Web Storefront, Online Reservations & Google Business Optimization ($1,500–$3,500 pitch value).")
    else:
        audit_points.append(f"🌐 ACTIVE WEBSITE: {website}")

    # 2. Contact Availability Audit
    if not has_email and not has_phone:
        audit_points.append("⚠️ CRITICAL CONTACT GAP: Neither direct email nor phone is listed on Google Maps.")
    elif not has_email:
        audit_points.append(f"📞 DIRECT PHONE AVAILABLE ({phone}) | ⚠️ Missing Direct Email — Cold Calling or WhatsApp Outreach Recommended.")
    elif not has_phone:
        audit_points.append(f"📧 DIRECT EMAIL AVAILABLE ({email}) | ⚠️ Missing Direct Phone Number.")
    else:
        audit_points.append(f"✅ OMNICHANNEL CONTACT READY: Email ({email}) & Phone ({phone}).")

    # 3. Reputation & Review Volume Audit
    if rating and rating >= 4.5 and review_count >= 500:
        audit_points.append(f"⭐ HIGH REPUTATION AT SCALE: {rating}★ rating with {review_count:,} reviews — High-volume established operator.")
    elif rating and rating >= 4.4 and review_count < 100:
        audit_points.append(f"⭐ HIGH QUALITY, LOW REVIEWS: Excellent rating ({rating}★) but under 100 reviews ({review_count}) — Prime candidate for Automated Review Collection & Local SEO.")
    elif review_count and review_count < 30:
        audit_points.append(f"⚠️ LOW REVIEW VOLUME: Only {review_count} reviews — Early-stage or digitally underserved business.")
    else:
        audit_points.append(f"📊 REPUTATION METRICS: {rating or 'N/A'}★ rating across {review_count:,} reviews.")

    # 4. Strategy Signal
    if not has_web:
        strat = "HIGH CONVERSION PROSPECT: No website listed despite active operations. Pitch custom web storefront + Google Maps optimization."
    elif not has_email:
        strat = "PHONE/WHATSAPP OUTREACH PROSPECT: Direct email is unlisted. Use direct line/WhatsApp for decision-maker introduction."
    elif rating and rating >= 4.5:
        if is_agency_software:
            strat = "PREMIUM REPUTATION PROSPECT: Well-reviewed agency/software business. Pitch inbound lead capture funnels & client acquisition infrastructure."
        elif is_trades or is_professional:
            strat = "PREMIUM REPUTATION PROSPECT: Well-reviewed service provider. Pitch automated quote/intake booking & local review automation."
        else:
            strat = "PREMIUM REPUTATION PROSPECT: Well-reviewed venue. Pitch review management automation or premium software add-ons."
    else:
        strat = "STANDARD B2B OUTREACH PROSPECT: Contact via verified channels with tailored service proposal."

    audit_summary = f"OPPORTUNITY AUDIT:\n" + "\n".join(audit_points) + f"\n\nSTRATEGY SIGNAL:\n{strat}"

    return {
        "leadScore": total_score,
        "classification": classification,
        "channel": channel,
        "templateType": "factual_audit_metrics",
        "rubricScores": scores,
        "rubricJustification": justifications,
        "emailBody": audit_summary,
        "pitchDraft": audit_summary,
        "recommendedAngle": strat,
        "reasoningSummary": f"Lead scored {total_score}/100 ({classification}). Audited website ({'Yes' if has_web else 'No'}), email ({'Yes' if has_email else 'No'}), phone ({'Yes' if has_phone else 'No'}).",
        "pipelineStage": "new"
    }
