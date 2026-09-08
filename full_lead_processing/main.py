"""
main.py
───────
Master CLI Orchestration Engine for LeadHunter.

Usage:
  python3 full_lead_processing/main.py places_test2.csv places_test2_campaign.json
"""

import sys
import os
import json
from datetime import datetime

# Local component imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from csv_parser import parse_places_csv
from crawler import scrape_website, fallback_google_mine
from scoring_agent import evaluate_and_score_lead

def run_pipeline(csv_input_path, json_output_path):
    print(f"\n==================================================")
    print(f"🚀 LeadHunter Engine starting...")
    print(f"📄 Input CSV : {csv_input_path}")
    print(f"📁 Output JSON: {json_output_path}")
    print(f"==================================================\n")

    # Step 1: Parse CSV
    print(f"📥 STEP 1: Parsing CSV data...")
    raw_leads = parse_places_csv(csv_input_path)
    print(f"✅ STEP 1 complete: Extracted {len(raw_leads)} raw lead entries from CSV.\n")

    processed_leads = []
    total = len(raw_leads)

    # Step 2 & 3: Crawl / Mine & Score
    print(f"🔍 STEP 2: Running Web Crawling, Fallback Mining, & Agent Rubric Scoring...")
    print(f"-------------------------------------------------------------------------")

    for idx, lead in enumerate(raw_leads, 1):
        name = lead['name']
        print(f"[{idx:02d}/{total}] Processing: {name}")

        website = lead.get('website', '').strip()
        phone = lead.get('phone', '').strip()
        email = lead.get('email', '').strip()
        instagram = None
        facebook = None

        # Step 2: Crawl direct website if listed
        if website:
            lead['hasWebsite'] = True
            print(f"   🌐 [Direct Website Flagged] Crawling {website}...")
            site_data = scrape_website(website)
            if site_data.get('email'):
                email = site_data['email']
            if site_data.get('phone') and not phone:
                phone = site_data['phone']
            instagram = site_data.get('instagram')
            facebook = site_data.get('facebook')

        # Fallback to live web search if email or phone is still missing
        if not website or not email or not phone:
            print(f"   🔎 [Live Web Search Fallback] Mining web search for '{name}'...")
            mined = fallback_google_mine(name, address=lead.get('address', ''), location="Sri Lanka")
            if mined.get('found_website') and not website:
                website = mined['found_website']
                lead['hasWebsite'] = True
                print(f"   💡 [Mined Website]: {website}")
            if mined.get('email') and not email:
                email = mined['email']
                print(f"   📧 [Mined Email]: {email}")
            if mined.get('phone') and not phone:
                phone = mined['phone']
                print(f"   📞 [Mined Phone]: {phone}")
            if mined.get('instagram') and not instagram:
                instagram = mined['instagram']
            if mined.get('facebook') and not facebook:
                facebook = mined['facebook']

        # Update lead dict with crawled details
        lead['website'] = website
        lead['phone'] = phone
        lead['email'] = email
        lead['instagram'] = instagram
        lead['facebook'] = facebook

        # Step 3: Run Agent Rubric Scoring & Pitch Copywriting
        agent_res = evaluate_and_score_lead(lead)
        lead.update(agent_res)

        print(f"   🎯 Lead Score: {lead['leadScore']}/100 | Class: {lead['classification']} | Channel: {lead['channel']}")
        print(f"   📧 Contact Email: {email or '—'} | Phone: {phone or '—'}")
        print()

        processed_leads.append(lead)

    campaign_name = f"Scraped Campaign ({os.path.basename(csv_input_path)}) - {datetime.now().strftime('%Y-%m-%d')}"

    output_payload = {
        "campaignName": campaign_name,
        "leads": processed_leads
    }

    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(f"==================================================")
    print(f"✅ LeadHunter Engine pipeline complete!")
    print(f"📊 Total Processed : {len(processed_leads)}")
    print(f"🌐 Websites Found  : {sum(1 for l in processed_leads if l['hasWebsite'])}/{len(processed_leads)}")
    print(f"📧 Emails Mined    : {sum(1 for l in processed_leads if l['email'])}/{len(processed_leads)}")
    print(f"📞 Phones Mined    : {sum(1 for l in processed_leads if l['phone'])}/{len(processed_leads)}")
    print(f"📁 Output Saved To : {json_output_path}")
    print(f"==================================================\n")

if __name__ == "__main__":
    print("==================================================", flush=True)
    print("🚀 LeadHunter Orchestrator Engine Initialized", flush=True)
    print("==================================================", flush=True)
    input_arg = sys.argv[1] if len(sys.argv) > 1 else "places_test2.csv"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "places_test2_campaign.json"
    print(f"📥 Input Target : {input_arg}", flush=True)
    print(f"📁 Output Target: {output_file}\n", flush=True)

    if input_arg.startswith(('http://', 'https://')):
        print("🌐 [Detected Web URL] Triggering Playwright Google Maps Browser Scraper...", flush=True)
        try:
            from gmaps_browser_scraper import scrape_google_maps
            scrape_google_maps(input_arg, output_file)
        except Exception as e:
            print(f"❌ Error in browser scraper: {e}", flush=True)
            import traceback
            traceback.print_exc()
    else:
        print("📄 [Detected CSV File] Running CSV Lead Pipeline...", flush=True)
        run_pipeline(input_arg, output_file)
