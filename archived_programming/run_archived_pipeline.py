"""
run_archived_pipeline.py
────────────────────────
Runs the archived LeadHunter processing pipeline on a campaign JSON file,
using role-based email guessing ("guess words") for domains, rubric scoring (0-100),
lead classification, and 3-sentence cold email generation.
"""

import json
import os
import re
from urllib.parse import urlparse

# Import scoring logic from process_leads.py
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from process_leads import process_lead

GUESS_WORDS = [
    "info", "contact", "reservations", "hello",
    "fnb", "events", "enquiries", "sales", "manager"
]

def extract_domain(website_url):
    if not website_url:
        return None
    url = website_url if website_url.startswith("http") else "http://" + website_url
    try:
        domain = urlparse(url).netloc
        domain = re.sub(r"^www\.", "", domain)
        return domain if domain and "." in domain else None
    except Exception:
        return None

def generate_guessed_emails(domain):
    if not domain:
        return []
    return [f"{word}@{domain}" for word in GUESS_WORDS]

def process_campaign_file(input_filepath, output_filepath):
    print(f"📂 Loading campaign file: {input_filepath}")
    with open(input_filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    campaign_name = data.get("campaignName", "Scraped Leads Campaign")
    leads_list = data.get("leads", data if isinstance(data, list) else [])

    print(f"🔍 Found {len(leads_list)} leads to process...")

    processed_leads = []

    for index, item in enumerate(leads_list, 1):
        name = item.get("name") or f"Lead #{index}"
        website = item.get("website", "")
        domain = extract_domain(website)
        
        existing_email = item.get("email") or item.get("contactEmail", "")
        guessed_emails = []
        if domain:
            guessed_emails = generate_guessed_emails(domain)

        # Primary email to use
        email = existing_email or (guessed_emails[0] if guessed_emails else "")

        # Prepare lead_data dict for process_lead function
        lead_data = {
            "name": name,
            "rating": item.get("rating"),
            "review_count": item.get("reviews") or item.get("review_count"),
            "price_range": item.get("priceRange") or item.get("price_range"),
            "category": item.get("category"),
            "website": website,
            "email": email,
            "phone": item.get("phone"),
            "instagram": item.get("instagram"),
            "facebook": item.get("facebook"),
        }

        # Run real program rubric scoring
        analysis = process_lead(lead_data)

        # Merge original fields with analysis and guessed email words
        enriched_item = {
            "placeId": item.get("placeId", f"lead_{index:03d}"),
            "name": name,
            "category": item.get("category", ""),
            "address": item.get("address", ""),
            "phone": item.get("phone", ""),
            "email": email,
            "guessedEmails": guessed_emails,
            "rating": item.get("rating", 0.0),
            "reviews": item.get("reviews", 0),
            "hasWebsite": item.get("hasWebsite", bool(website)),
            "website": website,
            "priceRange": item.get("priceRange", ""),
            "reviewSnippet": item.get("reviewSnippet", ""),
            "features": item.get("features", []),
            "imageUrl": item.get("imageUrl", ""),
            "source": item.get("source", "archived-program"),
            # Scoring & Pitch Output from real program
            "leadScore": analysis["lead_score"],
            "classification": analysis["classification"],
            "channel": analysis["channel"],
            "templateType": analysis["template_type"],
            "rubricScores": analysis["rubric_scores"],
            "rubricJustification": analysis["rubric_justification"],
            "emailBody": analysis["email_body"],
            "reasoningSummary": analysis["reasoning_summary"],
            "pipelineStage": "ready" if email or item.get("phone") else "new"
        }

        processed_leads.append(enriched_item)
        print(f"  [{index}/{len(leads_list)}] {name:30s} | Score: {analysis['lead_score']}/100 | Class: {analysis['classification']} | Email: {email or 'N/A'}")

    final_output = {
        "campaignName": campaign_name,
        "leads": processed_leads
    }

    with open(output_filepath, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Processed {len(processed_leads)} leads successfully!")
    print(f"📁 Output saved to: {output_filepath}")
    return final_output

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_file = os.path.join(base_dir, "places_firstday.json")
    output_file = os.path.join(base_dir, "places_firstday.json")
    process_campaign_file(input_file, output_file)
