# Full Lead Processing Engine

Automated scraping, website fallback mining, contact extraction, and AI agent rubric scoring engine for the LeadHunter platform.

## Features

1. **CSV Parser (`csv_parser.py`)**:
   - Parses Google Maps web-scraper CSV exports like [`places_test2.csv`](file:///home/kasr/Storage/Project%20TagTeam/LeadHunt_Project/places_test2.csv).
   - Extracts business name, category, rating, review count, location address, price range, review snippets, and image URLs.

2. **Web Crawler & Fallback Miner (`crawler.py`)**:
   - **Direct Crawler**: If a website URL exists, flags `hasWebsite = true` and crawls `/contact`, `/about` to extract real emails, phone numbers, Instagram, and Facebook handles.
   - **Fallback Mining Function**: If `hasWebsite = false` (no website listed on Maps), searches Google/DuckDuckGo for `"Business Name" "Location"`, locates candidate sites or Facebook pages, and mines contact details.

3. **Rubric Scoring Agent (`scoring_agent.py`)**:
   - Evaluates a 9-factor rubric (0-100 score).
   - Classifies leads (`LUXURY_PREMIUM`, `DIGITAL_WEAKNESS_OPPORTUNITY`, `REPUTATION_RISK`, `HIGH_POTENTIAL_GROWTH`, `GENERAL_OUTREACH`).
   - Routes to outreach channel (`WHATSAPP`, `EMAIL`, `MANUAL`).
   - Generates a personalized 3-sentence outreach email draft.

4. **Engine Orchestrator (`main.py`)**:
   - Executes the full pipeline end-to-end and outputs a ready-to-deploy JSON campaign file compatible with LeadHunter's `/api/leads/import` endpoint.

## Usage

```bash
python3 full_lead_processing/main.py places_test2.csv places_test2_campaign.json
```
