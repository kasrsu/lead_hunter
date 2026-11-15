"""
csv_parser.py
──────────────
Parses Google Maps web-scraper CSV files (like places_test2.csv)
into structured lead dictionaries.
"""

import csv
import re

def parse_review_count(raw_str):
    if not raw_str:
        return 0
    clean = re.sub(r'[^\d.]', '', raw_str)
    if not clean:
        return 0
    try:
        if 'k' in raw_str.lower():
            return int(float(clean) * 1000)
        return int(float(clean))
    except ValueError:
        return 0

def parse_rating(raw_str):
    if not raw_str:
        return 0.0
    try:
        val = float(raw_str)
        return val if 0.0 <= val <= 5.0 else 0.0
    except ValueError:
        return 0.0

def format_sl_phone(phone_raw: str) -> str:
    """Formats raw phone strings into standard +94 XX XXX XXXX format."""
    if not phone_raw:
        return ""
    digits = re.sub(r'\D', '', phone_raw)
    if digits.startswith('0') and len(digits) == 10:
        digits = '94' + digits[1:]
    elif len(digits) == 9 and digits[0] in "12378":
        digits = '94' + digits

    if digits.startswith('94') and len(digits) == 11:
        return f"+94 {digits[2:4]} {digits[4:7]} {digits[7:]}"
    if phone_raw.startswith('+'):
        return phone_raw.strip()
    return f"+{digits}" if digits else phone_raw.strip()

def parse_places_csv(csv_path):
    leads = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, 1):
            name = (row.get('data') or row.get('data2') or row.get('name') or f"Lead #{idx}").strip()

            # Combine review snippet parts
            snippet1 = (row.get('data4') or '').strip().strip('"')
            snippet2 = (row.get('data5') or '').strip().strip('"')
            snippet = f"{snippet1} {snippet2}".strip()

            category = (row.get('data3') or 'Restaurant').strip()
            rating = parse_rating(row.get('data6'))
            address = (row.get('data7') or '').strip()
            # Clean weird icon characters from address if present
            address = re.sub(r'[\u5140-\u9fff\ue000-\uf8ff]', '', address).strip()

            price_range = (row.get('data8') or '').strip()
            reviews_count = parse_review_count(row.get('data9'))
            maps_url = (row.get('web_scraper_start_url') or '').strip()
            image_url = (row.get('image') or row.get('image2') or '').strip()

            # Check direct phone / email / website columns if present
            direct_phone = (row.get('phone') or row.get('telephone') or '').strip()
            direct_email = (row.get('email') or '').strip()
            direct_website = (row.get('website') or row.get('url') or '').strip()

            # Scan address and data fields for embedded phone numbers if direct_phone is empty
            if not direct_phone:
                all_text = " ".join(str(v) for v in row.values() if v)
                sl_phones = re.findall(r'(?:\+94|0)(?:11|7[01245678]|24|31|38|81)\s*\d{3}\s*\d{4}', all_text)
                if sl_phones:
                    direct_phone = sl_phones[0].strip()

            lead = {
                "id": row.get('web_scraper_order') or f"csv_{idx:03d}",
                "name": name,
                "category": category,
                "rating": rating,
                "reviews": reviews_count,
                "address": address,
                "priceRange": price_range,
                "reviewSnippet": snippet,
                "mapsUrl": maps_url,
                "imageUrl": image_url,
                "phone": format_sl_phone(direct_phone),
                "email": direct_email,
                "website": direct_website,
                "hasWebsite": bool(direct_website)
            }
            leads.append(lead)

    return leads

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "places_test2.csv"
    results = parse_places_csv(path)
    print(f"Parsed {len(results)} leads from {path}")
    if results:
        print("Sample:", results[0])
