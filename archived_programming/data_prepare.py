"""
parse_restaurants.py
────────────────────
Parses the messy Google Maps copy-paste format into clean structured JSON.

Usage:
  python3 parse_restaurants.py              # uses built-in sample
  python3 parse_restaurants.py input.txt    # parse from a file
  python3 parse_restaurants.py input.txt output.json  # custom output path
"""

import re
import json
import sys

# ── Patterns ──────────────────────────────────────────────────────────────────

RE_IMAGE_URL  = re.compile(r'https://lh3\.googleusercontent\.com/\S+')
RE_MAPS_URL   = re.compile(r'https://www\.google\.com/maps/place/\S+')
RE_STATIC_URL = re.compile(r'https://maps\.gstatic\.com/\S+')

# Rating line appears twice: "4.7 stars 78 Reviews 4.7 (78)"
RE_RATING_BLOCK = re.compile(
    r'(\d+\.\d+)\s*stars?\s*'
    r'([\d,]+)\s*[Rr]eviews?\s*'
    r'(?:\d+\.\d+)?\s*(?:\([\d,]+\))?',
    re.IGNORECASE
)

RE_STATUS = re.compile(
    r'(Open|Closed)\s*[·•]?\s*(Opens?|Closes?)\s+([\d:]+\s*(?:AM|PM))',
    re.IGNORECASE
)

RE_PRICE = re.compile(r'(Rs\.?\s?[\d,]+\+?|\$+)', re.IGNORECASE)

RE_FEATURES = re.compile(
    r'(Wheelchair accessible entrance|Parking[^\n·]{0,40}|Dine[- ]in[^\n·]{0,40}|Takeaway[^\n·]{0,40})',
    re.IGNORECASE
)

# Address heuristic: starts with a number or a known keyword
RE_ADDRESS_START = re.compile(r'\d+\s+\w|(?:Lobby|Ground|Level|Floor)\s+\w', re.IGNORECASE)

KNOWN_CATEGORIES = [
    'Fine Dining', 'Family-friendly', 'Buffet', 'Café', 'Cafe',
    'Bar & Grill', 'Seafood', 'Fast Food', 'Casual Dining',
    'Bakery', 'Restaurant', 'Bar',
]


def remove_urls(text):
    text = RE_IMAGE_URL.sub('', text)
    text = RE_MAPS_URL.sub('', text)
    text = RE_STATIC_URL.sub('', text)
    return text


def extract_review_snippet(raw_text):
    """
    By the time this is called, all URLs have already been stripped by remove_urls().
    The static star-icon URL was between the quote parts, so after URL removal the
    rating/status/price block appears *inside* the quote string.

    Returns (snippet, cleaned_text) where cleaned_text still contains the
    rating/status/price block so downstream extractors can find it.
    """
    RE_NOISE = re.compile(
        r'\s*\d+\.\d+\s*stars?\s*[\d,]+\s*[Rr]eviews?\s*(?:\d+\.\d+)?\s*(?:\([\d,]+\))?\s*'
        r'(?:(?:Open|Closed)\s*[·•]?\s*(?:Opens?|Closes?)\s+[\d:]+\s*(?:AM|PM))?\s*'
        r'(?:Rs\.?\s?[\d,]+\+?|\$+)?\s*',
        re.IGNORECASE
    )

    open_q  = raw_text.find('"')
    if open_q == -1:
        return None, raw_text

    close_q = raw_text.rfind('"')
    has_close = close_q > open_q

    if has_close:
        inner = raw_text[open_q + 1: close_q]

        # Pull out the noise block (rating/status/price) to preserve it
        noise_m = RE_NOISE.search(inner)
        if noise_m:
            noise_block = noise_m.group(0)
            inner_clean = inner[:noise_m.start()] + ' ' + inner[noise_m.end():]
        else:
            noise_block = ''
            inner_clean = inner

        inner_clean = re.sub(r'\s+', ' ', inner_clean).strip()
        snippet = inner_clean if len(inner_clean) > 5 else None

        # cleaned_text: remove the quote but re-insert the noise for downstream
        cleaned = raw_text[:open_q] + ' ' + noise_block + ' ' + raw_text[close_q + 1:]
    else:
        # No closing quote — snippet runs until a feature landmark
        after_open = raw_text[open_q + 1:]
        landmark = re.search(
            r'Wheelchair|Parking|Dine.in|Takeaway|\Z',
            after_open, re.IGNORECASE
        )
        snippet_raw = after_open[:landmark.start()].strip() if landmark else after_open.strip()

        noise_m = RE_NOISE.search(snippet_raw)
        if noise_m:
            noise_block = noise_m.group(0)
            before = snippet_raw[:noise_m.start()].strip()
            after  = snippet_raw[noise_m.end():].strip()
            snippet_clean = (before + ' ' + after).strip()
        else:
            noise_block = ''
            snippet_clean = snippet_raw

        snippet_clean = re.sub(r'\s+', ' ', snippet_clean).strip()
        snippet = snippet_clean if len(snippet_clean) > 5 else None

        # Keep everything before the quote + the noise block for downstream
        cleaned = raw_text[:open_q] + ' ' + noise_block

    return snippet, cleaned


def extract_rating_and_reviews(text):
    m = RE_RATING_BLOCK.search(text)
    if m:
        rating = float(m.group(1))
        reviews = int(m.group(2).replace(',', ''))
        return rating, reviews, text[:m.start()] + text[m.end():]
    return None, None, text


def extract_status(text):
    m = RE_STATUS.search(text)
    if m:
        status = m.group(1).capitalize()
        hours_label = f"{m.group(2).capitalize()} {m.group(3).strip()}"
        return status, hours_label, text[:m.start()] + text[m.end():]
    # Simple open/closed with no hours
    s = re.search(r'\b(Open|Closed)\b', text, re.IGNORECASE)
    if s:
        return s.group(1).capitalize(), None, text[:s.start()] + text[s.end():]
    return None, None, text


def extract_price(text):
    m = RE_PRICE.search(text)
    if m:
        return m.group(1).strip(), text[:m.start()] + text[m.end():]
    return None, text


def extract_features(text):
    found = RE_FEATURES.findall(text)
    cleaned = [f.strip() for f in found]
    text = RE_FEATURES.sub('', text)
    return cleaned, text


def extract_name_category_address(text):
    text = re.sub(r'\s+', ' ', text).strip()

    name = None
    category = None
    address = None

    # Try to find a known category keyword
    for cat in KNOWN_CATEGORIES:
        idx = text.lower().find(cat.lower())
        if idx != -1:
            name_candidate = text[:idx].strip().strip('"').strip()
            rest = text[idx + len(cat):].strip()
            name = name_candidate or None
            category = cat
            address = rest.strip() or None
            break

    if not name:
        # Fallback: find first address-like substring
        m = RE_ADDRESS_START.search(text)
        if m:
            name = text[:m.start()].strip().strip('"') or None
            address = text[m.start():].strip() or None
        else:
            name = text.strip().strip('"') or None

    # Clean leftover rating floats from address (e.g. "4.6 Sir Marcus...")
    if address:
        address = re.sub(r'^\d+\.\d+\s*', '', address).strip()
        address = re.sub(r'\s+', ' ', address)
        address = address.strip('"').strip() or None

    return name, category, address


def parse_block(raw_block):
    result = {}

    # ── URLs ──────────────────────────────────────────────────────────────────
    img = RE_IMAGE_URL.search(raw_block)
    result['image_url'] = img.group(0) if img else None

    maps = RE_MAPS_URL.search(raw_block)
    result['maps_url'] = maps.group(0) if maps else None

    # Work on URL-stripped text from here
    text = remove_urls(raw_block)

    # ── Review snippet (must happen before rating strip, quote may wrap it) ──
    snippet, text = extract_review_snippet(text)
    result['review_snippet'] = snippet

    # ── Rating + review count ─────────────────────────────────────────────────
    rating, reviews, text = extract_rating_and_reviews(text)
    result['rating'] = rating
    result['review_count'] = reviews

    # ── Status / hours ────────────────────────────────────────────────────────
    status, hours_label, text = extract_status(text)
    result['status'] = status
    result['hours_label'] = hours_label

    # ── Price range ───────────────────────────────────────────────────────────
    price, text = extract_price(text)
    result['price_range'] = price

    # ── Features ──────────────────────────────────────────────────────────────
    features, text = extract_features(text)
    result['features'] = features

    # ── Name / Category / Address from what's left ────────────────────────────
    name, category, address = extract_name_category_address(text)
    result['name'] = name
    result['category'] = category
    result['address'] = address

    return result


def split_blocks(raw_text):
    """Split on each lh3 image URL which starts every entry."""
    parts = re.split(r'(?=https://lh3\.googleusercontent\.com/)', raw_text.strip())
    return [p.strip() for p in parts if p.strip()]


def main(raw_text):
    blocks = split_blocks(raw_text)
    return [parse_block(b) for b in blocks]


# ── Sample input ──────────────────────────────────────────────────────────────
SAMPLE = """
https://lh3.googleusercontent.com/gps-cs-s/APNQkAFbhSimX6Ux6q2Ro6w3b2iniC86q0sH5yQ9N59ZiKYey5XcQ7mhNPrWJglvMRSFDtZbEYNoV39DnyGx09LEL20qI6GmJgmkrJFVlcuw0byq-wuTyhZkhIwn4gPEEYxA2dqxn0Y1LyjhXksR=w80-h106-k-no https://www.google.com/maps/place/Avartana/data=!4m7!3m6!1s0x3ae2599f3cdc7fa5:0xe58f5db4fcb42d9f!8m2!3d6.9251697!4d79.8455098!16s%2Fg%2F11y2jcc3ck!19sChIJpX_cPJ9Z4joRny20_LRdj-U?authuser=0&hl=en&rclk=1 Avartana Fine Dining "The https://maps.gstatic.com/consumer/images/icons/2x/ic_star_rate_half_14.png 4.7 stars 78 Reviews 4.7 (78) Closed · Opens 6:30 PM Rs 10,000+ food was exceptional, with each dish expertly crafted and presented." Wheelchair accessible entrance  ITC Ratnadipa, a Luxury Collection Hotel, Colombo, 21 Galle Face Center Rd
https://lh3.googleusercontent.com/gps-cs-s/APNQkAELwgX86lJCh9qo0wAB0v1pTM--ig55lxDB8UOisZGlqQuEpdC56KJn7j-9KUh_T7U8SZY5tn3Ls7cqBZkOIBBI7XM7BXUTxnCk5eDJ4Qnu4UqBqjuS2-j8Jv_weoM9ZR7LLGR6=w80-h106-k-no https://www.google.com/maps/place/Spicy+Route+Restaurant/data=!4m7!3m6!1s0x3ae25bc52d8fb225:0x1ca8a472ce5f4b5f!8m2!3d6.8766672!4d79.9016846!16s%2Fg%2F11vhzdbjsx!19sChIJJbKPLcVb4joRX0tfznKkqBw?authuser=0&hl=en&rclk=1 Spicy Route Restaurant Fine Dining "The meat dishes were amazingly delicious and great staff service" https://maps.gstatic.com/consumer/images/icons/2x/ic_star_rate_half_14.png 4.7 stars 21 Reviews 4.7 (21) Open · Closes 11:30 PM Wheelchair accessible entrance  11 Ekwatta Rd
https://lh3.googleusercontent.com/gps-cs-s/APNQkAGDUgQoqkqymU-K_OPXA_nVX7vuPfH3scU6X5Q-C2r_scKl3UZSvQwugAA2rWaJqL2EJPWcmMEH75WyWHeTiSN8H8Wvhhu50F8GdlFQ02KSi2cX-tqnqUYmPUqu5YpGQ4bBKuoqoE_LBcw5=w122-h92-k-no https://www.google.com/maps/place/Cuisine+Colombo+-+Courtside/data=!4m7!3m6!1s0x3ae25930b67c6069:0xa183b11ac05eb0f8!8m2!3d6.9107366!4d79.8593497!16s%2Fg%2F11n107ctsx!19sChIJaWB8tjBZ4joR-LBewBqxg6E?authuser=0&hl=en&rclk=1 Cuisine Colombo - Courtside Family-friendly "Every dish full of flavor and beautifully presented." https://maps.gstatic.com/consumer/images/icons/2x/ic_star_rate_half_14.png 4.6 stars 1,010 Reviews 4.6 (1,010) Open · Closes 10 PM 45 Sir Marcus Fernando Mawatha
https://lh3.googleusercontent.com/gps-cs-s/APNQkAHFZASD701Jv7_iet9Ct9wk4XpRoVKzMP0dJsyCvyw40LeX5bt0amI8DzbN0gaMl6Q58pM__2YzYrzxIJKsno-EdeLABxu1KGloZqO0rGqK5YXliUcMgvNXGcQilusWyAlcyH0x=w116-h92-k-no https://www.google.com/maps/place/Graze+Kitchen/data=!4m7!3m6!1s0x3ae25924f53eff1b:0x306015a1545a9b9e!8m2!3d6.9323!4d79.8451669!16s%2Fg%2F11c5s76jq5!19sChIJG_8-9SRZ4joRnptaVKEVYDA?authuser=0&hl=en&rclk=1 Graze Kitchen Buffet "Exceptional https://maps.gstatic.com/consumer/images/icons/2x/ic_star_rate_half_14.png 4.6 stars 3,482 Reviews 4.6 (3,482) Open · Closes 10:30 PM $$$ dining with delicious Wheelchair accessible entrance  Lobby Level
"""

if __name__ == "__main__":
    # Hard-coded input path
    input_path = 'input.txt'
    output_path = sys.argv[1] if len(sys.argv) > 1 else 'restaurants.json'

    with open(input_path, 'r', encoding='utf-8') as f:
        raw = f.read()

    results = main(raw)

    print(json.dumps(results, indent=2, ensure_ascii=False))

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n✅  Parsed {len(results)} restaurants → saved to {output_path}")