import json
import os

def process_lead(lead_data):
    """
    Deterministically processes a lead using programmatic rubrics and templates,
    without requiring external AI API calls.
    """
    name = lead_data.get("name") or "Your Business"
    rating = lead_data.get("rating")
    review_count = lead_data.get("review_count")
    price_range = lead_data.get("price_range")
    category = lead_data.get("category")
    website = lead_data.get("website")
    email = lead_data.get("email")
    phone = lead_data.get("phone")
    instagram = lead_data.get("instagram")
    facebook = lead_data.get("facebook")

    # ---------------------------------------------------------
    # STEP 1: RUBRIC SCORING SYSTEM
    # ---------------------------------------------------------
    scores = {}
    justifications = {}

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
    is_fine_dining = category and "fine dining" in category.lower()
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

    # ---------------------------------------------------------
    # STEP 2: LEAD CLASSIFICATION
    # ---------------------------------------------------------
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

    # ---------------------------------------------------------
    # STEP 3: CHANNEL DECISION
    # ---------------------------------------------------------
    channel = "MANUAL"
    if has_phone and total_score > 70:
        channel = "WHATSAPP"
    elif has_email and total_score > 50:
        channel = "EMAIL"

    # ---------------------------------------------------------
    # STEP 4: TEMPLATE SELECTION
    # ---------------------------------------------------------
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

    # ---------------------------------------------------------
    # STEP 5: EMAIL GENERATION (3 Sentences)
    # ---------------------------------------------------------
    rating_str = f"{rating}/5" if rating else "a strong"
    review_str = f" from {review_count} reviews" if review_count else ""

    sentence_1 = ""
    sentence_2 = ""
    sentence_3 = "I’d love to share a brief framework on how similar premium venues are automating this to increase margins—worth a quick chat?"

    if template_type == "luxury_pitch":
        sentence_1 = f"I noticed {name} has built an incredible reputation with {rating_str} feedback{review_str}, positioning you at the top of the local fine dining scene."
        sentence_2 = "However, many high-end venues still rely on fragmented systems for dynamic pricing and addon management, leaving up to 15% of high-margin revenue on the table."
    elif template_type == "social_media_weakness_pitch":
        sentence_1 = f"I saw that {name} is driving impressive foot traffic with {rating_str} feedback{review_str}, but seems to be missing a direct digital booking channel."
        sentence_2 = "Without owning your direct digital real estate, you are likely losing 20% margins to third-party delivery apps and aggregators."
    elif template_type == "hidden_growth_pitch":
        sentence_1 = f"Your recent feedback at {name} ({rating_str}{review_str}) indicates you have a phenomenal product that locals love."
        sentence_2 = "The challenge for growth-stage venues is scaling that hospitality without letting manual table management and menu updates slow down operations."
    elif template_type == "reputation_fix_pitch":
        sentence_1 = f"I've been analyzing the local hospitality market and noticed {name} has consistent traffic but some recent mixed feedback regarding wait times or operations."
        sentence_2 = "Most venues experience this when their POS and table management systems aren't dynamically linked, creating friction for the front-of-house staff."
    else:
        sentence_1 = f"I've been tracking the local dining market and {name}'s {rating_str} rating{review_str} caught my eye."
        sentence_2 = "I help restaurant operators streamline their menu portions, table turnover, and surcharges using centralized digital infrastructure."

    email_body = f"{sentence_1} {sentence_2} {sentence_3}"

    # ---------------------------------------------------------
    # FINAL OUTPUT
    # ---------------------------------------------------------
    return {
        "lead_name": name,
        "lead_score": total_score,
        "classification": classification,
        "channel": channel,
        "template_type": template_type,
        "rubric_scores": scores,
        "rubric_justification": justifications,
        "email_body": email_body,
        "reasoning_summary": f"Lead scored {total_score}/100. Classified as {classification} due to rating/digital presence analysis. Routed to {channel}."
    }

def main(input_filepath, output_filepath):
    print(f"Loading leads from {input_filepath}...")
    with open(input_filepath, 'r', encoding='utf-8') as f:
        leads = json.load(f)
    
    print(f"Found {len(leads)} leads to process.")
    results = []
    
    for index, lead in enumerate(leads):
        name = lead.get('name', f"Lead #{index}")
        print(f"[{index + 1}/{len(leads)}] Processing: {name}")
        
        analysis = process_lead(lead)
        results.append(analysis)
            
    print(f"Saving {len(results)} processed leads to {output_filepath}...")
    with open(output_filepath, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
        
    print("Done!")

if __name__ == "__main__":
    # Adjust paths so it works if run from root or inside Programming/
    import os
    base_dir = os.path.dirname(os.path.abspath(__file__))
    INPUT_FILE = os.path.join(base_dir, "enriched.json")
    OUTPUT_FILE = os.path.join(base_dir, "scored_leads.json")
    
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found. Please ensure it is in the same directory.")
    else:
        main(INPUT_FILE, OUTPUT_FILE)
