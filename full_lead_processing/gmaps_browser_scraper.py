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
        pages_to_check = [url]
        base_url = url.rstrip('/')
        for sub in ['/contact', '/contact-us', '/about']:
            pages_to_check.append(base_url + sub)

        combined_content = ""
        for target in pages_to_check:
            try:
                page.goto(target, timeout=12000, wait_until='domcontentloaded')
                content = page.content()
                if content:
                    combined_content += "\n" + content
                time.sleep(0.2)
            except Exception:
                pass

        page.close()

        if not combined_content:
            return res

        # 1. Extract email
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
    Performs Bing web search for `"{venue_name} {address} Sri Lanka"`.
    Extracts top organic website link and crawls it for email and phone.
    """
    res = {'email': None, 'phone': None, 'website': None}
    search_query = f"{venue_name} {address} Sri Lanka".strip()
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

def scrape_google_maps(maps_url, output_json_path=None):
    print(f"\n==================================================", flush=True)
    print(f"🚀 Starting Playwright Google Maps Headless Scraper", flush=True)
    print(f"📍 Target Maps URL: {maps_url}", flush=True)
    print(f"==================================================\n", flush=True)

    leads = []

    with sync_playwright() as p:
        print("🌐 Launching Chromium browser (headless mode)...", flush=True)
        try:
            browser = p.chromium.launch(headless=True)
        except Exception as e:
            if "playwright install" in str(e).lower():
                print("   📦 Auto-installing Playwright Chromium browser binaries...", flush=True)
                import subprocess
                subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
                browser = p.chromium.launch(headless=True)
            else:
                raise e
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1400, "height": 900}
        )
        page = context.new_page()

        print("📡 Navigating to Google Maps search page...", flush=True)
        try:
            page.goto(maps_url, wait_until='domcontentloaded', timeout=35000)
        except Exception as err:
            print(f"⚠️ Initial page.goto notice: {err}", flush=True)

        page.wait_for_timeout(3000)

        # Handle cookie consent dialog if present
        try:
            consent_btns = page.locator('button[aria-label*="Accept"], button:has-text("Accept all"), form[action*="consent"] button').all()
            if consent_btns:
                print("   🍪 Dismissing Google Consent dialog...", flush=True)
                consent_btns[0].click()
                page.wait_for_timeout(2000)
        except Exception:
            pass

        # Wait for feed container
        feed_selector = 'div[role="feed"]'
        try:
            print("📜 Locating Google Maps place feed container...", flush=True)
            page.wait_for_selector(feed_selector, timeout=15000)
            feed = page.locator(feed_selector)
            # Scroll feed to load more places
            print("🔽 Scrolling place feed to load entries...", flush=True)
            for i in range(1, 9):
                feed.evaluate('el => el.scrollBy(0, 1500)')
                time.sleep(1.0)
                count_so_far = page.locator('a[href*="/maps/place/"]').count()
                print(f"   📜 [Scroll {i}/8] Found {count_so_far} places in feed so far...", flush=True)
        except Exception as e:
            print(f"⚠️ Feed scroll warning: {e}", flush=True)

        # Locate place cards
        place_links = page.locator('a[href*="/maps/place/"]').all()
        print(f"🔍 Found {len(place_links)} place entries on Google Maps.\n", flush=True)

        seen_names = set()

        for idx, link in enumerate(place_links, 1):
            try:
                href = link.get_attribute('href')
                aria_label = link.get_attribute('aria-label') or ''

                if not aria_label and href:
                    # Parse title from URL
                    parts = href.split('/maps/place/')
                    if len(parts) > 1:
                        aria_label = parts[1].split('/')[0].replace('+', ' ')

                if not aria_label or aria_label in seen_names:
                    continue
                seen_names.add(aria_label)

                print(f"[{len(seen_names):02d}] Extracting from Maps: {aria_label}", flush=True)

                # Get card text container text
                card_text = ""
                try:
                    card_parent = link.locator('xpath=ancestor::div[contains(@class, "Nv2PK") or contains(@class, "hfB5eb") or @role="article"]').first
                    if card_parent.is_visible():
                        card_text = card_parent.inner_text()
                except Exception:
                    pass

                # Click place link to open detail panel
                try:
                    link.click(timeout=5000)
                    page.wait_for_timeout(2000)
                except Exception:
                    pass

                # Get detail panel text
                panel_text = ""
                try:
                    panel_text = page.locator('div[role="main"]').inner_text(timeout=3000)
                except Exception:
                    pass

                combined_text = card_text + "\n" + panel_text

                # 1. Parse Rating & Review Count (Multi-strategy)
                rating = 0.0
                reviews = 0
                card_aria = link.get_attribute('aria-label') or ''

                # Strategy A: Detail Panel DOM Attributes
                try:
                    stars_el = page.locator('div[role="main"] span[aria-label*="star"], div[role="main"] span[aria-label*="stars"]').first
                    if stars_el.is_visible(timeout=1500):
                        label = stars_el.get_attribute('aria-label') or ''
                        m = re.search(r'([1-5]\.\d)', label)
                        if m:
                            rating = float(m.group(1))

                    rev_el = page.locator('div[role="main"] button[aria-label*="review"], div[role="main"] button[aria-label*="reviews"]').first
                    if rev_el.is_visible(timeout=1500):
                        label = rev_el.get_attribute('aria-label') or ''
                        m = re.search(r'([\d,Kk.]+)\s*review', label, re.IGNORECASE)
                        if m:
                            raw_r = m.group(1).replace(',', '')
                            if 'k' in raw_r.lower():
                                reviews = int(float(raw_r.lower().replace('k', '')) * 1000)
                            else:
                                reviews = int(float(raw_r))
                except Exception:
                    pass

                # Strategy B: Card Aria-Label & InnerText Regex Matching (Sanitized)
                clean_str = re.sub(r'https?://\S+', '', f"{card_aria}\n{combined_text}")
                clean_str = re.sub(r'data=\S+', '', clean_str)
                clean_str = re.sub(r'@[\d.,\-]+', '', clean_str)

                if rating == 0.0 or reviews == 0:
                    m_rev = re.search(r'([1-5]\.\d)\s*★?\s*\(([\d,Kk.]+)\)', clean_str)
                    if m_rev:
                        if rating == 0.0:
                            rating = float(m_rev.group(1))
                        if reviews == 0:
                            raw_r = m_rev.group(2).replace(',', '')
                            if 'k' in raw_r.lower():
                                reviews = int(float(raw_r.lower().replace('k', '')) * 1000)
                            else:
                                reviews = int(float(raw_r))

                if rating == 0.0 or reviews == 0:
                    m_star = re.search(r'([1-5]\.\d)\s*(?:stars?|★)', clean_str, re.IGNORECASE)
                    if m_star and rating == 0.0:
                        rating = float(m_star.group(1))
                    m_cnt = re.search(r'([\d,Kk.]+)\s*reviews?', clean_str, re.IGNORECASE)
                    if m_cnt and reviews == 0:
                        raw_r = m_cnt.group(1).replace(',', '')
                        if 'k' in raw_r.lower():
                            reviews = int(float(raw_r.lower().replace('k', '')) * 1000)
                        else:
                            reviews = int(float(raw_r))

                # 2. Parse Price Range ($$, $$$)
                price_range = ""
                p_match = re.search(r'(?:\b|·\s*)(\${1,4}|LKR|Rs\.?)(?:\s*·|\b)', combined_text)
                if p_match:
                    price_range = p_match.group(1)

                # 3. Parse Category
                category = "Restaurant"
                c_match = re.search(r'·\s*(?:\${1,4}\s*·\s*)?([A-Za-z\s]{3,30})(?:\s*·|\n|$)', card_text)
                if c_match:
                    cat_found = c_match.group(1).strip()
                    if len(cat_found) > 2 and 'star' not in cat_found.lower():
                        category = cat_found

                # 4. Extract Phone from panel
                phone = ""
                phone_btn = page.locator('button[data-tooltip*="phone"], button[aria-label*="Phone"], button[data-item-id*="phone"]').first
                if phone_btn.is_visible():
                    aria = phone_btn.get_attribute('aria-label') or ''
                    phone = format_sl_phone(aria.replace('Phone:', '').replace('phone:', '').strip())
                if not phone:
                    phones = RE_SL_PHONE.findall(combined_text)
                    if phones:
                        phone = format_sl_phone(phones[0].strip())

                # 5. Extract Website from panel
                website = ""
                web_btn = page.locator('a[data-tooltip*="website"], a[aria-label*="Website"], a[data-item-id*="authority"]').first
                if web_btn.is_visible():
                    website = web_btn.get_attribute('href') or ''

                # 6. Extract Address from panel
                address = ""
                addr_btn = page.locator('button[data-tooltip*="address"], button[aria-label*="Address"]').first
                if addr_btn.is_visible():
                    aria = addr_btn.get_attribute('aria-label') or ''
                    address = aria.replace('Address:', '').strip()

                # Layer 2: Direct Website Crawling & Fallback Live Web Search
                email = ""
                if website:
                    print(f"   🌐 [Layer 2 Website Mining] Crawling {website} for contacts...", flush=True)
                    web_contacts = scrape_website_for_contacts(website, context)
                    if web_contacts.get('email'):
                        email = web_contacts['email']
                        print(f"      📧 [Direct Web Email]: {email}", flush=True)
                    if web_contacts.get('phone') and not phone:
                        phone = web_contacts['phone']
                        print(f"      📞 [Direct Web Phone]: {phone}", flush=True)

                # Fallback: If Email or Phone or Website is missing, perform live Web Search
                if not email or not phone or not website:
                    search_res = live_search_for_venue_contacts(aria_label, address, context)
                    if search_res.get('email') and not email:
                        email = search_res['email']
                        print(f"      📧 [Live Search Mined Email]: {email}", flush=True)
                    if search_res.get('phone') and not phone:
                        phone = search_res['phone']
                        print(f"      📞 [Live Search Mined Phone]: {phone}", flush=True)
                    if search_res.get('website') and not website:
                        website = search_res['website']
                        print(f"      🌐 [Live Search Discovered Web]: {website}", flush=True)

                lead = {
                    "id": f"gmaps_{len(seen_names):03d}",
                    "name": aria_label,
                    "category": category,
                    "rating": rating,
                    "reviews": reviews,
                    "address": address,
                    "priceRange": price_range,
                    "reviewSnippet": f"Google Maps verified business ({rating}⭐, {reviews} reviews) in {address or 'Sri Lanka'}.",
                    "mapsUrl": href or maps_url,
                    "imageUrl": "",
                    "phone": phone,
                    "email": email,
                    "website": website,
                    "hasWebsite": bool(website)
                }

                # Score lead using AI rubric agent
                agent_res = evaluate_and_score_lead(lead)
                lead.update(agent_res)

                print(f"   ⭐ Rating: {rating}★ ({reviews:,} reviews) | Price: {price_range or 'N/A'} | Category: {category}", flush=True)
                print(f"   🎯 Score : {lead['leadScore']}/100 | Class: {lead['classification']} | Channel: {lead['channel']}", flush=True)
                print(f"   📞 Phone : {phone or '—'}", flush=True)
                print(f"   📧 Email : {email or '—'}", flush=True)
                print(f"   🌐 Web   : {website or '—'}\n", flush=True)

                leads.append(lead)

            except Exception as err:
                print(f"   ⚠️ Error parsing card #{idx}: {err}", flush=True)

        browser.close()

    print(f"==================================================", flush=True)
    print(f"✅ Google Maps Scraper completed! Extracted & Scored {len(leads)} leads.", flush=True)
    print(f"==================================================\n", flush=True)

    if output_json_path:
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump({"campaignName": f"Google Maps Campaign - {time.strftime('%Y-%m-%d')}", "leads": leads}, f, indent=2, ensure_ascii=False)
        print(f"📁 Saved campaign JSON to: {output_json_path}", flush=True)

    return leads

if __name__ == "__main__":
    maps_url = sys.argv[1] if len(sys.argv) > 1 else "https://www.google.com/maps/search/dine+in+restaurant+sri+lanka/@6.8607995,79.8785902,14z/data=!4m2!2m1!6e5?entry=ttu&g_ep=EgoyMDI2MDgyMy4wIKXMDSoASAFQAw%3D%3D"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "gmaps_scraped_leads.json"
    scrape_google_maps(maps_url, output_file)
