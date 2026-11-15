"""
enrich_restaurants.py  (v2 — Playwright + Google Places API)
─────────────────────────────────────────────────────────────
Enriches parsed restaurant JSON with:
  - phone number
  - website URL
  - email address
  - Instagram handle
  - Facebook page

TWO enrichment strategies (auto-selects based on whether you have an API key):

  Strategy A — Google Places API  ★ RECOMMENDED
    • Free API key: https://console.cloud.google.com → Enable "Places API"
    • Paste key in GOOGLE_API_KEY below OR set env var: export GOOGLE_API_KEY=...
    • Returns phone + website instantly, no scraping
    • Free tier: 5,000 calls/month

  Strategy B — Playwright browser  (fallback, no API key needed)
    • Opens a real Chrome browser and reads the rendered Maps page
    • Slower (~5s/restaurant) but works without any key
    • Requires: pip install playwright && python3 -m playwright install chromium

Usage:
  python3 enrich_restaurants.py                         # restaurants.json -> enriched.json
  python3 enrich_restaurants.py input.json              # custom input
  python3 enrich_restaurants.py input.json output.json  # custom in + out

Pipeline:
  python3 parse_restaurants.py  raw.txt     parsed.json
  python3 enrich_restaurants.py parsed.json enriched.json
"""

import json, os, re, sys, time, random
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import urlparse

# ── CONFIG ────────────────────────────────────────────────────────────────────

GOOGLE_API_KEY  = os.environ.get('GOOGLE_API_KEY', '')  # or paste directly: 'AIza...'
REQUEST_DELAY   = (2.0, 4.0)   # seconds between requests
REQUEST_TIMEOUT = 15
MAX_BYTES       = 300_000

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
}

# ── Regex ─────────────────────────────────────────────────────────────────────

RE_PLACE_ID  = re.compile(r'!19s(ChIJ[A-Za-z0-9_\-]+)')
RE_EMAIL     = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
RE_INSTAGRAM = re.compile(r'instagram\.com/([A-Za-z0-9_.]{2,30})/?', re.IGNORECASE)
RE_FACEBOOK  = re.compile(r'facebook\.com/((?:pages/[^/"\'?\s]+|[A-Za-z0-9.\-]{3,}))/?', re.IGNORECASE)
RE_TEL       = re.compile(r'href=["\']tel:([^"\']+)["\']', re.IGNORECASE)

JUNK_EMAILS = {'example.com', 'sentry.io', 'schema.org', 'w3.org', 'wixpress.com'}
JUNK_IG     = {'instagram', 'reels', 'explore', 'p', 'tv', 'stories', 'accounts'}
JUNK_FB     = {'sharer', 'share', 'dialog', 'plugins', 'login', 'facebook'}

# ── Helpers ───────────────────────────────────────────────────────────────────

def sleep():
    time.sleep(random.uniform(*REQUEST_DELAY))

def fetch_html(url, max_bytes=MAX_BYTES):
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=REQUEST_TIMEOUT) as r:
            raw = r.read(max_bytes)
            enc = r.headers.get_content_charset() or 'utf-8'
            return raw.decode(enc, errors='replace')
    except Exception as e:
        print(f'      ⚠  fetch failed [{url[:65]}]: {e}')
        return None

def extract_place_id(maps_url):
    m = RE_PLACE_ID.search(maps_url or '')
    return m.group(1) if m else None

def clean_email(e):
    e = e.lower().strip()
    if any(e.endswith(x) for x in ('.png','.jpg','.gif','.svg','.css','.js','.woff')):
        return None
    if e.split('@')[-1] in JUNK_EMAILS:
        return None
    return e

def clean_instagram(username):
    u = username.strip('/').split('?')[0]
    return None if (u.lower() in JUNK_IG or len(u) < 2) else f'https://instagram.com/{u}'

def clean_facebook(path):
    p = path.strip('/').split('?')[0]
    return None if (p.lower() in JUNK_FB or len(p) < 3) else f'https://facebook.com/{p}'


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGY A — Google Places API
# ══════════════════════════════════════════════════════════════════════════════

def places_api_lookup(place_id):
    if not GOOGLE_API_KEY or not place_id:
        return {}
    url = (
        f'https://maps.googleapis.com/maps/api/place/details/json'
        f'?place_id={place_id}&fields=formatted_phone_number,website&key={GOOGLE_API_KEY}'
    )
    html = fetch_html(url, max_bytes=50_000)
    if not html:
        return {}
    try:
        data = json.loads(html)
        r    = data.get('result', {})
        return {'phone': r.get('formatted_phone_number'), 'website': r.get('website')}
    except Exception as e:
        print(f'      ⚠  Places API parse error: {e}')
        return {}


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGY B — Playwright browser scraping
# ══════════════════════════════════════════════════════════════════════════════

def playwright_maps_lookup(maps_url):
    result = {'phone': None, 'website': None}
    if not maps_url:
        return result

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('      ⚠  Playwright not installed.')
        print('         Run: pip install playwright && python3 -m playwright install chromium')
        return result

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx     = browser.new_context(
                user_agent=HEADERS['User-Agent'],
                locale='en-US',
                viewport={'width': 1280, 'height': 800},
            )
            page = ctx.new_page()
            page.goto(maps_url, wait_until='domcontentloaded', timeout=30000)

            # Wait for the sidebar panel to render
            try:
                page.wait_for_selector('[data-item-id^="phone"]', timeout=8000)
            except Exception:
                pass
            page.wait_for_timeout(2000)

            # ── Phone ──────────────────────────────────────────────────────
            phone_el = page.query_selector('[data-item-id^="phone:"]')
            if phone_el:
                label = phone_el.get_attribute('aria-label') or ''
                phone_text = re.sub(r'[Pp]hone:?\s*', '', label).strip()
                if phone_text:
                    result['phone'] = phone_text

            # Fallback: tel: links in page
            if not result['phone']:
                tel_els = page.query_selector_all('a[href^="tel:"]')
                if tel_els:
                    href = tel_els[0].get_attribute('href') or ''
                    result['phone'] = href.replace('tel:', '').strip()

            # ── Website ────────────────────────────────────────────────────
            web_el = page.query_selector('[data-item-id="authority"]')
            if web_el:
                href = web_el.get_attribute('href') or ''
                real = re.search(r'[?&]url=([^&]+)', href)
                website = real.group(1) if real else href
                if website and 'google.com' not in website:
                    result['website'] = website

            # Fallback: first external link in the main panel
            if not result['website']:
                links = page.query_selector_all('a[href^="http"]')
                for link in links:
                    href = link.get_attribute('href') or ''
                    if 'google' not in href and 'gstatic' not in href:
                        result['website'] = href
                        break

            browser.close()

    except Exception as e:
        print(f'      ⚠  Playwright error: {e}')

    return result


# ══════════════════════════════════════════════════════════════════════════════
# Website scraper — email + social links
# ══════════════════════════════════════════════════════════════════════════════

def scrape_website(website_url):
    out = {'email': None, 'instagram': None, 'facebook': None, 'phone': None}
    if not website_url:
        return out

    parsed = urlparse(website_url)
    base   = f"{parsed.scheme}://{parsed.netloc}"
    pages  = [website_url] + [base + p for p in ['/contact', '/contact-us', '/about', '/reach-us']]

    all_html = ''
    for url in pages[:3]:
        html = fetch_html(url)
        if html:
            all_html += html
        sleep()

    if not all_html:
        return out

    for raw in RE_EMAIL.findall(all_html):
        c = clean_email(raw)
        if c:
            out['email'] = c
            break

    for u in RE_INSTAGRAM.findall(all_html):
        c = clean_instagram(u)
        if c:
            out['instagram'] = c
            break

    for path in RE_FACEBOOK.findall(all_html):
        c = clean_facebook(path)
        if c:
            out['facebook'] = c
            break

    tel = RE_TEL.findall(all_html)
    if tel:
        out['phone'] = tel[0].strip()

    return out


# ══════════════════════════════════════════════════════════════════════════════
# Main loop
# ══════════════════════════════════════════════════════════════════════════════

def enrich(restaurants):
    use_api = bool(GOOGLE_API_KEY)

    if use_api:
        print('🔑 Google Places API key detected — using API (fast + reliable)')
    else:
        print('🌐 No API key — using Playwright browser scraping')
        print('   Tip: set GOOGLE_API_KEY env var for much faster results\n')
    print()

    enriched = []
    total    = len(restaurants)

    for i, r in enumerate(restaurants, 1):
        name     = r.get('name', f'Entry {i}')
        maps_url = r.get('maps_url', '')
        print(f'[{i}/{total}] {name}')

        # Step 1 — phone + website
        if use_api:
            place_id = extract_place_id(maps_url)
            print(f'  → API lookup  (place_id: {place_id[:22] if place_id else "not found"})')
            data    = places_api_lookup(place_id)
            phone   = data.get('phone')
            website = data.get('website')
            sleep()
        else:
            print(f'  → Playwright: loading Maps page...')
            data    = playwright_maps_lookup(maps_url)
            phone   = data.get('phone')
            website = data.get('website')
            sleep()

        print(f'     phone:   {phone or "—"}')
        print(f'     website: {website or "—"}')

        # Step 2 — email + socials from website
        email = instagram = facebook = phone_site = None
        if website:
            print(f'  → Scraping website...')
            site       = scrape_website(website)
            email      = site.get('email')
            instagram  = site.get('instagram')
            facebook   = site.get('facebook')
            phone_site = site.get('phone')
            print(f'     email:     {email or "—"}')
            print(f'     instagram: {instagram or "—"}')
            print(f'     facebook:  {facebook or "—"}')
        else:
            print('  ℹ  No website found — skipping')

        enriched.append({
            **r,
            'phone':     phone or phone_site,
            'website':   website,
            'email':     email,
            'instagram': instagram,
            'facebook':  facebook,
        })
        print()

    return enriched


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    input_path  = sys.argv[1] if len(sys.argv) > 1 else 'restaurants.json'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'enriched.json'

    print(f'📂 Loading {input_path}...')
    with open(input_path, 'r', encoding='utf-8') as f:
        restaurants = json.load(f)

    print(f'🔍 Enriching {len(restaurants)} restaurants...\n{"─"*52}')
    result = enrich(restaurants)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    t  = len(result)
    ph = sum(1 for r in result if r.get('phone'))
    ws = sum(1 for r in result if r.get('website'))
    em = sum(1 for r in result if r.get('email'))
    ig = sum(1 for r in result if r.get('instagram'))
    fb = sum(1 for r in result if r.get('facebook'))

    def pct(n): return f'{100*n//t}%' if t else '—'

    print(f'{"─"*52}')
    print(f'✅  Saved to {output_path}')
    print(f'{"─"*52}')
    print(f'  Total       : {t}')
    print(f'  Phone       : {ph}/{t}  ({pct(ph)})')
    print(f'  Website     : {ws}/{t}  ({pct(ws)})')
    print(f'  Email       : {em}/{t}  ({pct(em)})')
    print(f'  Instagram   : {ig}/{t}  ({pct(ig)})')
    print(f'  Facebook    : {fb}/{t}  ({pct(fb)})')
    print(f'{"─"*52}')