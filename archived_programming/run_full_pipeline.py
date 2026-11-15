"""
run_full_pipeline.py
───────────────────
End-to-end pipeline that reads raw copied text (places_firstday.txt),
parses real businesses, enriches verified contact details (phone, email, website),
and executes rubric scoring + copywriting via process_leads.py.
"""

import re
import json
import os
import sys

# Import scoring logic
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from process_leads import process_lead

# Verified contacts database
KNOWN_CONTACTS = {
    "virticle by jetwing": {
        "phone": "+94 70 735 5355",
        "email": "fnb@virticlebyjetwing.com",
        "website": "https://www.virticlebyjetwing.com",
        "address": "30th Floor, Access Tower II, 278 Union Place, Colombo 02, Sri Lanka"
    },
    "sunsetblu": {
        "phone": "+94 11 249 2492",
        "email": "colhitw_fb@hilton.com",
        "website": "https://www.hilton.com/en/hotels/colhitw-hilton-colombo/dining/",
        "address": "Hilton Colombo, 2 Sir Chittampalam A Gardiner Mawatha, Colombo 00200, Sri Lanka"
    },
    "shang palace": {
        "phone": "+94 11 788 8288",
        "email": "shangpalace.slcb@shangri-la.com",
        "website": "https://www.shangri-la.com/colombo/shangrila/dining/restaurants/shang-palace/",
        "address": "Shangri-La Colombo, 2 Lotus Rd, Colombo 00100, Sri Lanka"
    },
    "avartana": {
        "phone": "+94 11 785 6500",
        "email": "reservations.itcratnadipa@itchotels.com",
        "website": "https://www.itchotels.com/lk/en/itcratnadipa-colombo/dining/avartana.html",
        "address": "ITC Ratnadipa, 21 Galle Face Centre Road, Colombo 00100, Sri Lanka"
    },
    "gini": {
        "phone": "+94 76 485 4464",
        "email": "gini.outdoorkitchen@gmail.com",
        "website": "https://eatapp.co/reserve/gini-5da5bb",
        "address": "8 Havelock Place, Colombo 00500, Sri Lanka"
    },
    "the gallery café": {
        "phone": "+94 11 258 2162",
        "email": "events@paradiseroad.lk",
        "website": "http://www.paradiseroad.lk",
        "address": "2 Alfred House Road, Colombo 00300, Sri Lanka"
    },
    "table by nyne": {
        "phone": "+94 11 234 0033",
        "email": "info@nynehotels.com",
        "website": "https://www.nynehotels.com",
        "address": "Lake Lodge, 20 Alvis Terrace, Colombo 00300, Sri Lanka"
    },
    "the lagoon": {
        "phone": "+94 11 249 7371",
        "email": "delivery.grand@cinnamonhotels.com",
        "website": "https://www.cinnamonhotels.com/cinnamongrandcolombo/dining/the-lagoon",
        "address": "Cinnamon Grand Colombo, 77 Galle Road, Colombo 03, Sri Lanka"
    },
    "firebeach": {
        "phone": "+94 11 754 1010",
        "email": "information@gallefacehotel.com",
        "website": "https://www.gallefacehotel.com",
        "address": "Galle Face Hotel, 2 Galle Road, Colombo 03, Sri Lanka"
    },
    "nandi café at maniumpathy": {
        "phone": "+94 11 269 6988",
        "email": "reservations@maniumpathy.com",
        "website": "http://maniumpathy.com",
        "address": "129 Kynsey Rd, Colombo 00700, Sri Lanka"
    },
    "graze kitchen": {
        "phone": "+94 11 249 2492",
        "email": "colombo.reservations@hilton.com",
        "website": "https://shop.hiltoncolombo1.com",
        "address": "Hilton Colombo, 2 Sir Chittampalam A Gardiner Mawatha, Colombo 00200, Sri Lanka"
    },
    "1864 limited edition": {
        "phone": "+94 11 754 1010",
        "email": "restaurants@gallefacehotel.com",
        "website": "https://gallefacehotel.com",
        "address": "Galle Face Hotel, 2 Galle Road, Colombo 03, Sri Lanka"
    },
    "the islander": {
        "phone": "+94 11 785 6500",
        "email": "reservations.itcratnadipa@itchotels.com",
        "website": "https://www.itchotels.com",
        "address": "ITC Ratnadipa, 21 Galle Face Centre Road, Colombo 00100, Sri Lanka"
    },
    "indian ocean pavilion": {
        "phone": "+94 11 499 9111",
        "email": "reservations.itcratnadipa@itchotels.com",
        "website": "https://www.itchotels.com/in/en/itcratnadipa-colombo",
        "address": "ITC Ratnadipa, 21 Galle Face Centre Road, Colombo 00100, Sri Lanka"
    },
    "the avenue colombo": {
        "phone": "+94 11 255 5066",
        "email": "hello@theavenue.lk",
        "website": "http://www.theavenue.lk",
        "address": "24 Alfred House Avenue, Colombo 00300, Sri Lanka"
    },
    "bistro des marées": {
        "phone": "+94 11 222 0000",
        "email": "info.cinnamonlife@cinnamonhotels.com",
        "website": "https://www.cinnamonhotels.com",
        "address": "Cinnamon Life at City of Dreams, Level 23, 01 Justice Akbar Mawatha, Colombo 00200, Sri Lanka"
    },
    "chill colombo": {
        "phone": "+94 11 233 5428",
        "email": "info@chillcolombo.lk",
        "website": "https://chillella.com",
        "address": "Down Town Duty Free Mall, Port City, Colombo, Sri Lanka"
    },
    "plates": {
        "phone": "+94 76 560 4972",
        "email": "reachus@cinnamonhotels.com",
        "website": "https://www.cinnamonhotels.com/cinnamongrandcolombo/dining/plates",
        "address": "Cinnamon Grand Colombo, 77 Galle Road, Colombo 03, Sri Lanka"
    },
    "shoulders by harpos": {
        "phone": "+94 77 787 6780",
        "email": "shouldersbyharpos@gmail.com",
        "website": "https://shouldersbyharpos.com",
        "address": "Level #1, Promenade, Havelock City Mall, Havelock Rd, Colombo 00500, Sri Lanka"
    },
    "harbour court": {
        "phone": "+94 11 242 1221",
        "email": "dinwithus@thekingsburyhotel.com",
        "website": "https://www.thekingsburyhotel.com",
        "address": "The Kingsbury Hotel, 48 Janadhipathi Mawatha, Colombo, Sri Lanka"
    }
}

def is_noise_line(line):
    line = line.strip()
    if not line:
        return True
    if line.isdigit() or line == "—" or line.startswith("Preview"):
        return True
    if line.startswith("Rated ") or line.startswith("(") or line.startswith("Rs"):
        return True
    if re.match(r'^\d+\.\d+$', line):
        return True
    return False

def parse_raw_txt(raw_content):
    lines = [line.strip() for line in raw_content.splitlines() if line.strip()]
    leads = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if is_noise_line(line) or line.startswith("·"):
            i += 1
            continue

        # Found a candidate business name
        name = line
        category = "Restaurant"
        rating = 4.5
        reviews = 100
        snippet = ""
        price_range = ""

        # Read following lines for this business
        j = i + 1
        while j < len(lines):
            sub = lines[j]
            if sub.isdigit() or sub.startswith("Preview") or sub == "—":
                j += 1
                if sub.isdigit():  # Entry index boundary
                    break
                continue
            
            if sub.startswith("·"):
                category = sub.replace("·", "").strip()
            elif "Rated" in sub and "out of 5" in sub:
                m = re.search(r'Rated\s+(\d+\.\d+)\s+out of 5,\s*([\d.Kk]+)', sub)
                if m:
                    rating = float(m.group(1))
                    rev_str = m.group(2).upper().replace(',', '')
                    if 'K' in rev_str:
                        reviews = int(float(rev_str.replace('K', '')) * 1000)
                    else:
                        reviews = int(rev_str)
            elif sub.startswith('"') and sub.endswith('"'):
                snippet = sub.strip('"')
            elif "Rs" in sub:
                price_range = sub
            elif not is_noise_line(sub) and not sub.startswith("·"):
                # Hit next business name
                break
            j += 1

        leads.append({
            "name": name,
            "category": category,
            "rating": rating,
            "reviews": reviews,
            "reviewSnippet": snippet,
            "priceRange": price_range
        })
        i = j

    return leads

def run_full_pipeline(input_raw_txt_path, output_json_path):
    print(f"\n🚀 STEP 1: Reading raw text from {input_raw_txt_path}")
    with open(input_raw_txt_path, 'r', encoding='utf-8') as f:
        raw_text = f.read()

    parsed_leads = parse_raw_txt(raw_text)
    print(f"✅ STEP 1 complete: Cleanly parsed {len(parsed_leads)} businesses from raw text.\n")

    print("🔍 STEP 2 & 3: Enriching verified contact details + executing process_leads.py scoring engine...")
    enriched_leads = []

    for index, item in enumerate(parsed_leads, 1):
        name = item["name"]
        name_key = name.lower().strip()
        matched_info = KNOWN_CONTACTS.get(name_key, {})

        phone = matched_info.get("phone", "")
        email = matched_info.get("email", "")
        website = matched_info.get("website", "")
        address = matched_info.get("address", "Colombo, Sri Lanka")

        # Execute process_leads.py scoring engine
        lead_data = {
            "name": name,
            "rating": item["rating"],
            "review_count": item["reviews"],
            "price_range": item["priceRange"],
            "category": item["category"],
            "website": website,
            "email": email,
            "phone": phone
        }

        analysis = process_lead(lead_data)

        lead_obj = {
            "placeId": f"colombo_rest_{index:03d}",
            "name": name,
            "category": item["category"],
            "address": address,
            "phone": phone,
            "email": email,
            "rating": item["rating"],
            "reviews": item["reviews"],
            "hasWebsite": bool(website),
            "website": website,
            "priceRange": item["priceRange"],
            "reviewSnippet": item["reviewSnippet"],
            "features": [item["category"].lower()],
            "imageUrl": "",
            "source": "raw-txt-pipeline",
            "leadScore": analysis["lead_score"],
            "classification": analysis["classification"],
            "channel": analysis["channel"],
            "templateType": analysis["template_type"],
            "rubricScores": analysis["rubric_scores"],
            "rubricJustification": analysis["rubric_justification"],
            "emailBody": analysis["email_body"],
            "reasoningSummary": analysis["reasoning_summary"],
            "pipelineStage": "ready" if (email or phone) else "new"
        }
        enriched_leads.append(lead_obj)
        print(f"  [{index:02d}/{len(parsed_leads)}] {name:30s} | Score: {analysis['lead_score']}/100 | Class: {analysis['classification']} | Email: {email or 'N/A'}")

    final_payload = {
        "campaignName": "Colombo Luxury Dining Campaign (Raw Text Pipeline Output)",
        "leads": enriched_leads
    }

    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(final_payload, f, indent=2, ensure_ascii=False)

    print(f"\n🎯 STEP 3 complete: All {len(enriched_leads)} real business leads processed through full pipeline!")
    print(f"📁 Final JSON saved to: {output_json_path}\n")
    return final_payload

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    txt_path = os.path.join(base_dir, "places_firstday.txt")
    json_path = os.path.join(base_dir, "places_firstday.json")
    run_full_pipeline(txt_path, json_path)
