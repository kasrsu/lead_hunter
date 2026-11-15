"""
gmaps_browser_scraper.py
─────────────────────────
Headless Browser Scraper for Google Maps search URLs.
Uses Playwright to render Google Maps, scroll through place listings,
click each place panel, and extract direct Phone Numbers, Website URLs, Addresses,
Ratings, and Reviews directly from Google Maps.
Then crawls official websites for real email addresses.
"""

import sys
import os
import re
import time
import json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scoring_agent import evaluate_and_score_lead

RE_EMAIL = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
RE_SL_PHONE = re.compile(r'(?:\+94|0)(?:11|7[01245678]|24|31|38|81)\s*\d{3}\s*\d{4}')

JUNK_EMAILS = {'example.com', 'sentry.io', 'schema.org', 'w3.org', 'wixpress.com', 'domain.com', 'duckduckgo.com', 'google.com'}

def is_category_compatible(scraped_category: str, target_niche: str, place_name: str = "") -> bool:
    """
    Verifies if scraped business category or place name strictly matches target search niche.
    Uses dynamic word extraction, stop-word filtering, and industry synonym expansion
    to support any B2B or consumer niche (marketing agencies, software, restaurants, trades, etc.).
    """
    if not target_niche:
        return True

    cat_lower = (scraped_category or "").lower().strip()
    name_lower = (place_name or "").lower().strip()
    niche_lower = target_niche.lower().strip()

INDUSTRY_CLUSTERS = {
    "marketing": {
        "marketing", "advertising", "ad", "pr", "public relations", "media", "branding", "seo", "digital agency"
    },
    "software": {
        "software", "saas", "tech", "technology", "it service", "computer consultant", "web dev", "app dev", "developer", "programming"
    },
    "hospitality": {
        "restaurant", "restaurants", "bistro", "brasserie", "cafe", "cafes", "diner", "eatery", "steakhouse", "pizzeria", "pizza",
        "pub", "bar", "bakery", "catering", "dining", "food", "kitchen", "grill", "lounge", "tavern", "gastropub", "sushi",
        "ramen", "burger", "taco", "indian", "chinese", "italian", "french", "mexican", "thai", "japanese", "vietnamese"
    },
    "trade_services": {
        "plumbing", "plumber", "hvac", "heating", "air conditioning", "cooling", "roofing", "roofer", "electrician", "electrical", "contractor", "repair", "solar", "pest control", "landscaping"
    },
    "professional_services": {
        "lawyer", "attorney", "law firm", "legal", "dentist", "dental", "doctor", "clinic", "hospital", "cpa", "accounting", "tax service", "real estate", "realtor", "property management"
    }
}


def is_category_compatible(scraped_category: str, target_niche: str, place_name: str = "") -> bool:
    """
    Verifies if scraped business category or place name matches the target search industry cluster.
    Focuses on main category / industry matching (Marketing vs Hospitality vs Software vs Trades vs Professional)
    without restricting subcategories (e.g. all restaurant types/cuisines are accepted for restaurant searches).
    """
    if not target_niche:
        return True

    cat_lower = (scraped_category or "").lower().strip()
    name_lower = (place_name or "").lower().strip()
    niche_lower = target_niche.lower().strip()

    # Identify target industry cluster
    target_cluster = None
    for cluster_name, keywords in INDUSTRY_CLUSTERS.items():
        if any(kw in niche_lower for kw in keywords):
            target_cluster = cluster_name
            break

    # If target niche does not map to a known industry cluster, accept all
    if not target_cluster:
        return True

    target_keywords = INDUSTRY_CLUSTERS[target_cluster]

    # Match if category or place name contains any keyword in the target industry cluster
    has_cat_match = any(kw in cat_lower for kw in target_keywords)
    has_name_match = any(kw in name_lower for kw in target_keywords)

    if has_cat_match or has_name_match:
        return True

    # Reject if category explicitly matches a DIFFERENT conflicting industry cluster
    for other_cluster, keywords in INDUSTRY_CLUSTERS.items():
        if other_cluster != target_cluster:
            if any(kw in cat_lower for kw in keywords):
                return False

    # Fallback: if category is generic ("Business", "Point of interest"), allow name check
    return True


def format_sl_phone(phone_raw: str) -> str:
    """Clean and format raw phone strings safely for international numbers."""
    if not phone_raw:
        return ""
    p = phone_raw.strip()
    if p.startswith('+'):
        return p
    digits = re.sub(r'\D', '', p)
    if not digits:
        return p
    if p.startswith('0'):
        return p
    return f"+{digits}" if len(digits) >= 10 else p

def clean_email(email_str):
    if not email_str:
        return None
    e = email_str.lower().strip().strip('.')
    if any(e.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.woff', '.woff2', '.ttf', '.webp', '.ico')):
        return None
    if 'error-lite' in e or 'duckduckgo' in e or 'sentry' in e or 'schema' in e:
        return None
    domain = e.split('@')[-1]
    if domain in JUNK_EMAILS or any(junk in domain for junk in ('sentry', 'schema', 'example', 'w3.org', 'wixpress', 'gws-prod', 'google')):
        return None
    return e

def scrape_website_for_contacts(url, context):
    """
    Layer 2 Website Crawler:
    If email or mobile is not present, visits official website homepage
    and subpages (/contact, /contact-us, /about) to extract email AND phone number.
    """
    res = {'email': None, 'phone': None, 'facebook': None, 'instagram': None}
    if not url or 'facebook.com' in url or 'instagram.com' in url:
        return res

    try:
        page = context.new_page()
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        pages_to_check = [url, base_url + '/contact', base_url + '/contact-us', base_url + '/about', base_url + '/about-us']

        combined_content = ""
        for target in pages_to_check:
            try:
                page.goto(target, timeout=3000, wait_until='domcontentloaded')
                content = page.content()
                if content:
                    combined_content += "\n" + content
                if RE_EMAIL.search(combined_content):
                    break
            except Exception:
                pass

        page.close()

        if not combined_content:
            return res

        # 1. Extract mailto links first (highest priority official email)
        mailto_links = re.findall(r'href=["\']mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})["\']', combined_content, re.IGNORECASE)
        for raw in mailto_links:
            c = clean_email(raw)
            if c:
                res['email'] = c
                break

        if not res['email']:
            for raw in RE_EMAIL.findall(combined_content):
                c = clean_email(raw)
                if c:
                    res['email'] = c
                    break

        # 2. Extract phone
        tels = re.findall(r'href=["\']tel:([^"\']+)["\']', combined_content, re.IGNORECASE)
        if tels:
            res['phone'] = tels[0].strip()
        else:
            sl_phones = RE_SL_PHONE.findall(combined_content)
            if sl_phones:
                res['phone'] = sl_phones[0].strip()

        # 3. Extract social links
        fbs = re.findall(r'facebook\.com/((?:pages/[^/"\'?\s]+|[A-Za-z0-9.\-]{3,}))/?', combined_content, re.IGNORECASE)
        if fbs:
            res['facebook'] = f"https://facebook.com/{fbs[0]}"

        igs = re.findall(r'instagram\.com/([A-Za-z0-9_.]{2,30})/?', combined_content, re.IGNORECASE)
        if igs:
            res['instagram'] = f"https://instagram.com/{igs[0]}"

    except Exception:
        pass

    return res

def live_search_for_venue_contacts(venue_name, address, context):
    """
    Fallback Web Search when venue has no website or missing contact info.
    Performs Bing web search for `"{venue_name} {address}"`.
    Extracts top organic website link and crawls it for email and phone.
    """
    res = {'email': None, 'phone': None, 'website': None}
    search_query = f"{venue_name} {address}".strip()
    print(f"   🔎 [Live Web Search Fallback] Mining web search for '{venue_name}'...", flush=True)

    target_url = None
    try:
        import urllib.parse
        import urllib.request
        from bs4 import BeautifulSoup

        encoded_q = urllib.parse.quote_plus(search_query)
        bing_url = f"https://www.bing.com/search?q={encoded_q}"
        req = urllib.request.Request(bing_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        })
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            soup = BeautifulSoup(html, 'html.parser')

            for item in soup.find_all('li', class_='b_algo'):
                a_tag = item.find('a', href=True)
                if a_tag:
                    href = a_tag['href']
                    if href.startswith('http') and not any(skip in href.lower() for skip in (
                        'bing.com', 'microsoft.com', 'google.com', 'tripadvisor', 'ubereats', 'pickme', 'yamu.lk', 'ikman.lk', 'facebook.com/places'
                    )):
                        target_url = href
                        break
    except Exception:
        pass

    if target_url:
        print(f"      🌐 [Discovered Web Page] {target_url}", flush=True)
        mined = scrape_website_for_contacts(target_url, context)
        mined['website'] = target_url
        return mined

    return res

def scrape_google_maps(maps_url, output_json_path=None, max_leads=25):
    print(f"\n==================================================", flush=True)
    print(f"🚀 Starting Playwright Google Maps Headless Scraper", flush=True)
    print(f"📍 Target Maps URL: {maps_url}", flush=True)
    print(f"📊 Target Lead Volume: {max_leads} leads", flush=True)
    print(f"==================================================\n", flush=True)

    leads = []

    def save_incremental():
        if output_json_path:
            try:
                clean_path = os.path.normpath(output_json_path.replace('\\ ', ' ').replace('\\', '/'))
                out_dir = os.path.dirname(os.path.abspath(clean_path))
                if out_dir:
                    os.makedirs(out_dir, exist_ok=True)
                with open(clean_path, 'w', encoding='utf-8') as f:
                    json.dump({"campaignName": f"Google Maps Campaign - {time.strftime('%Y-%m-%d')}", "leads": leads}, f, indent=2, ensure_ascii=False)
            except Exception:
                pass

    with sync_playwright() as p:
        print("🌐 Launching Chromium browser (headless mode)...", flush=True)
        launch_args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        try:
            browser = p.chromium.launch(headless=True, args=launch_args)
        except Exception as e:
            if "playwright install" in str(e).lower():
                print("   📦 Auto-installing Playwright Chromium browser binaries...", flush=True)
                import subprocess
                subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
                browser = p.chromium.launch(headless=True, args=launch_args)
            else:
                raise e
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1400, "height": 900}
        )
        page = context.new_page()

        print("📡 Navigating to Google Maps search page...", flush=True)
        try:
            page.goto(maps_url, wait_until='domcontentloaded', timeout=25000)
        except Exception as err:
            print(f"⚠️ Initial page.goto notice: {err}", flush=True)

        page.wait_for_timeout(1500)

        # Handle cookie consent dialog if present
        try:
            consent_btns = page.locator('button[aria-label*="Accept"], button:has-text("Accept all"), form[action*="consent"] button').all()
            if consent_btns:
                print("   🍪 Dismissing Google Consent dialog...", flush=True)
                consent_btns[0].click()
                page.wait_for_timeout(1000)
        except Exception:
            pass

        # Wait for feed container
        feed_selector = 'div[role="feed"]'
        try:
            print("📜 Locating Google Maps place feed container...", flush=True)
            page.wait_for_selector(feed_selector, timeout=10000)
            feed = page.locator(feed_selector)
            # Scroll feed to load target number of places
            print("🔽 Scrolling place feed to load entries...", flush=True)
            for i in range(1, 9):
                feed.evaluate('el => el.scrollBy(0, 1500)')
                time.sleep(0.4)
                count_so_far = page.locator('a[href*="/maps/place/"]').count()
                print(f"   📜 [Scroll {i}/8] Found {count_so_far} places in feed so far...", flush=True)
                if count_so_far >= max_leads:
                    break
        except Exception as e:
            print(f"⚠️ Feed scroll warning: {e}", flush=True)

        # Locate place links and collect target entries up to max_leads
        place_links = page.locator('a[href*="/maps/place/"]').all()
        print(f"🔍 Found {len(place_links)} place entries on Google Maps feed.\n", flush=True)

        target_entries = []
        seen_names = set()

        for link in place_links:
            try:
                href = link.get_attribute('href') or ''
                aria_label = link.get_attribute('aria-label') or ''

                clean_name = aria_label
                if not clean_name and href:
                    parts = href.split('/maps/place/')
                    if len(parts) > 1:
                        clean_name = parts[1].split('/')[0].replace('+', ' ')

                if not clean_name or clean_name in seen_names:
                    continue

                seen_names.add(clean_name)
                if href.startswith('/'):
                    href = 'https://www.google.com' + href

                # Pre-extract initial rating & reviews from feed aria-label or card text if available
                feed_rating = 0.0
                feed_reviews = 0

                m_star = re.search(r'([1-5]\.\d)\s*(?:stars?|★)?', aria_label, re.IGNORECASE)
                if m_star:
                    try: feed_rating = float(m_star.group(1))
                    except Exception: pass

                m_rev = re.search(r'([\d,Kk.]+)\s*reviews?', aria_label, re.IGNORECASE)
                if not m_rev:
                    m_rev = re.search(r'\(([\d,Kk.]+)\)', aria_label)
                if m_rev:
                    raw_r = m_rev.group(1).replace(',', '')
                    if 'k' in raw_r.lower():
                        feed_reviews = int(float(raw_r.lower().replace('k', '')) * 1000)
                    else:
                        try: feed_reviews = int(float(raw_r))
                        except Exception: pass

                target_entries.append({
                    "name": clean_name,
                    "href": href,
                    "initial_rating": feed_rating,
                    "initial_reviews": feed_reviews
                })

                if len(target_entries) >= max_leads:
                    break
            except Exception:
                pass

        page.close()

        print(f"🎯 Extracted {len(target_entries)} verified target place links (capped at {max_leads}). Mining isolated place details...\n", flush=True)

        # Detect target niche from maps_url if available
        target_niche = ""
        url_match = re.search(r'/maps/search/([^/@?]+)', maps_url)
        if url_match:
            import urllib.parse
            target_niche = urllib.parse.unquote(url_match.group(1)).replace('+', ' ')

        for idx, entry in enumerate(target_entries, 1):
            if len(leads) >= max_leads:
                print(f"🛑 Target volume limit reached ({max_leads} leads). Finishing early.", flush=True)
                break

            aria_label = entry["name"]
            href = entry["href"]
            rating = entry["initial_rating"]
            reviews = entry["initial_reviews"]

            print(f"[{idx:02d}/{len(target_entries)}] Direct Scraping: {aria_label}", flush=True)
            detail_page = context.new_page()
            try:
                detail_page.goto(href, wait_until='domcontentloaded', timeout=15000)
                detail_page.wait_for_timeout(1200)

                # 1. Title
                title = aria_label
                try:
                    h1_els = detail_page.locator('h1').all()
                    for h in h1_els:
                        txt = h.inner_text().strip()
                        if txt:
                            title = txt
                            break
                except Exception:
                    pass

                # 2. Address
                address = ""
                try:
                    addr_btn = detail_page.locator('button[data-item-id="address"], button[aria-label*="Address"]').first
                    if addr_btn.is_visible(timeout=1000):
                        aria = addr_btn.get_attribute('aria-label') or ''
                        address = aria.replace('Address:', '').strip()
                except Exception:
                    pass

                # 3. Phone
                phone = ""
                try:
                    phone_btn = detail_page.locator('button[data-item-id*="phone"], button[aria-label*="Phone"]').first
                    if phone_btn.is_visible(timeout=1000):
                        aria = phone_btn.get_attribute('aria-label') or ''
                        phone = format_sl_phone(aria.replace('Phone:', '').replace('phone:', '').strip())
                except Exception:
                    pass
                if not phone:
                    try:
                        phones = RE_SL_PHONE.findall(detail_page.content())
                        if phones:
                            phone = format_sl_phone(phones[0].strip())
                    except Exception:
                        pass

                # 4. Website
                website = ""
                try:
                    web_btn = detail_page.locator('a[data-item-id="authority"], a[aria-label*="Website"]').first
                    if web_btn.is_visible(timeout=1000):
                        website = web_btn.get_attribute('href') or ''
                except Exception:
                    pass

                # 5. Rating & Review Count Mining
                try:
                    star_el = detail_page.locator('span[aria-label*="star"], span[aria-label*="stars"], button[aria-label*="star"]').first
                    if star_el.is_visible(timeout=1000):
                        lbl = star_el.get_attribute('aria-label') or ''
                        m = re.search(r'([1-5]\.\d)', lbl)
                        if m:
                            rating = float(m.group(1))
                except Exception:
                    pass

                try:
                    rev_els = detail_page.locator('button[aria-label*="review"], span[aria-label*="review"], button[jsaction*="review"], div.F7piq, span.ceNzKf').all()
                    for r_el in rev_els:
                        lbl = (r_el.get_attribute('aria-label') or r_el.inner_text() or '').strip()
                        if 'write' in lbl.lower():
                            continue
                        m = re.search(r'([\d,Kk.]+)\s*(?:Google\s*)?reviews?', lbl, re.IGNORECASE)
                        if not m:
                            m = re.search(r'\(([\d,Kk.]+)\)', lbl)
                        if m:
                            raw_r = m.group(1).replace(',', '')
                            if 'k' in raw_r.lower():
                                parsed_r = int(float(raw_r.lower().replace('k', '')) * 1000)
                            else:
                                parsed_r = int(float(raw_r))
                            if parsed_r > 0:
                                reviews = parsed_r
                                break
                except Exception:
                    pass

                if reviews == 0:
                    try:
                        body_txt = detail_page.content()
                        m_cnt = re.search(r'aria-label=["\'][^"\']*?([\d,Kk.]+)\s*reviews?', body_txt, re.IGNORECASE)
                        if not m_cnt:
                            m_cnt = re.search(r'([\d,Kk.]+)\s*(?:Google\s*)?reviews?', body_txt, re.IGNORECASE)
                        if not m_cnt:
                            m_cnt = re.search(r'(?:[1-5]\.\d\s*)?\(([\d,Kk.]+)\)', body_txt)
                        if m_cnt:
                            raw_r = m_cnt.group(1).replace(',', '')
                            if 'k' in raw_r.lower():
                                reviews = int(float(raw_r.lower().replace('k', '')) * 1000)
                            else:
                                reviews = int(float(raw_r))
                    except Exception:
                        pass

                # If still 0, check entry initial_reviews
                if reviews == 0 and entry["initial_reviews"] > 0:
                    reviews = entry["initial_reviews"]


                # Category & Price Range
                price_range = ""
                category = "Business"
                try:
                    cat_el = detail_page.locator('button[jsaction*="category"], button[data-item-id="category"]').first
                    if cat_el.is_visible(timeout=1000):
                        cat_txt = cat_el.inner_text().strip()
                        if cat_txt:
                            category = cat_txt
                except Exception:
                    pass
                if category == "Business":
                    try:
                        cat_btns = detail_page.locator('button.DkL0fc').all()
                        for cb in cat_btns:
                            txt = cb.inner_text().strip()
                            if txt and not any(kw in txt.lower() for kw in ('review', 'star', 'save', 'share', 'nearby', 'directions', 'claim', 'website', 'phone', 'menu')):
                                category = txt
                                break
                    except Exception:
                        pass

                try:
                    combined_text = detail_page.content()
                    p_match = re.search(r'(?:\b|·\s*)(\${1,4}|LKR|Rs\.?)(?:\s*·|\b)', combined_text)
                    if p_match:
                        price_range = p_match.group(1)
                except Exception:
                    pass

                # Layer 2: Website Mining
                email = ""
                if website:
                    print(f"   🌐 [Layer 2 Website Mining] Crawling {website}...", flush=True)
                    web_contacts = scrape_website_for_contacts(website, context)
                    if web_contacts.get('email'):
                        email = web_contacts['email']
                        print(f"      📧 [Direct Web Email]: {email}", flush=True)
                    if web_contacts.get('phone') and not phone:
                        phone = web_contacts['phone']
                        print(f"      📞 [Direct Web Phone]: {phone}", flush=True)

                # Fallback: Live Web Search
                if (not email or not phone or not website) and address:
                    search_res = live_search_for_venue_contacts(title, address, context)
                    if search_res.get('email') and not email:
                        email = search_res['email']
                        print(f"      📧 [Live Search Mined Email]: {email}", flush=True)
                    if search_res.get('phone') and not phone:
                        phone = search_res['phone']
                        print(f"      📞 [Live Search Mined Phone]: {phone}", flush=True)
                    if search_res.get('website') and not website:
                        website = search_res['website']
                        print(f"      🌐 [Live Search Discovered Web]: {website}", flush=True)

                # Category Verification (Prevent Niche Mismatch)
                if target_niche and not is_category_compatible(category, target_niche, title):
                    print(f"   ⚠️ [Niche Mismatch Filter] Skipping '{title}' ({category}) because it does not match target industry '{target_niche}'.", flush=True)
                    continue

                lead = {
                    "id": f"gmaps_{idx:03d}",
                    "name": title,
                    "category": category,
                    "rating": rating,
                    "reviews": reviews,
                    "reviewCount": reviews,
                    "address": address,
                    "priceRange": price_range,
                    "reviewSnippet": f"Google Maps verified business ({rating}⭐, {reviews} reviews) in {address or 'location'}.",
                    "mapsUrl": href,
                    "imageUrl": "",
                    "phone": phone,
                    "email": email,
                    "website": website,
                    "hasWebsite": bool(website)
                }

                # Score lead using AI rubric agent (unless skipped via environment)
                if os.environ.get("SKIP_ENRICHMENT") == "1":
                    lead.update({
                        "leadScore": 50,
                        "classification": "UNASSIGNED",
                        "channel": "DIRECT",
                        "recommendedAngle": "Raw scraped business contact",
                        "pitchDraft": "AI enrichment disabled.",
                        "rubricBreakdown": []
                    })
                else:
                    agent_res = evaluate_and_score_lead(lead)
                    lead.update(agent_res)

                print(f"   ⭐ Rating: {rating}★ ({reviews:,} reviews) | Price: {price_range or 'N/A'} | Category: {category}", flush=True)
                print(f"   🎯 Score : {lead['leadScore']}/100 | Class: {lead['classification']} | Channel: {lead['channel']}", flush=True)
                print(f"   📞 Phone : {phone or '—'}", flush=True)
                print(f"   📧 Email : {email or '—'}", flush=True)
                print(f"   🌐 Web   : {website or '—'}\n", flush=True)

                leads.append(lead)
                save_incremental()

            except Exception as err:
                print(f"   ⚠️ Error parsing place #{idx}: {err}", flush=True)
            finally:
                detail_page.close()

        browser.close()

    print(f"==================================================", flush=True)
    print(f"✅ Google Maps Scraper completed! Extracted & Scored {len(leads)} leads.", flush=True)
    print(f"==================================================\n", flush=True)

    save_incremental()
    return leads

if __name__ == "__main__":
    maps_url = sys.argv[1] if len(sys.argv) > 1 else "https://www.google.com/maps/search/dine+in+restaurant+sri+lanka/@6.8607995,79.8785902,14z/data=!4m2!2m1!6e5?entry=ttu&g_ep=EgoyMDI2MDgyMy4wIKXMDSoASAFQAw%3D%3D"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "gmaps_scraped_leads.json"
    max_leads_val = int(sys.argv[3]) if len(sys.argv) > 3 else int(os.environ.get("MAX_LEADS", 25))
    scrape_google_maps(maps_url, output_file, max_leads_val)
