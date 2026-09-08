"""
crawler.py
──────────
Web scraping and fallback mining engine for LeadHunter.
- Direct website crawler: extracts email, phone, Instagram, Facebook links.
- Fallback Miner: mines contact details using web search and domain matching.
"""

import re
import time
import random
import json
from urllib.request import urlopen, Request
from urllib.parse import urlparse, quote_plus
from urllib.error import URLError, HTTPError

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
}

RE_EMAIL = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
RE_INSTAGRAM = re.compile(r'instagram\.com/([A-Za-z0-9_.]{2,30})/?', re.IGNORECASE)
RE_FACEBOOK = re.compile(r'facebook\.com/((?:pages/[^/"\'?\s]+|[A-Za-z0-9.\-]{3,}))/?', re.IGNORECASE)
RE_TEL = re.compile(r'href=["\']tel:([^"\']+)["\']', re.IGNORECASE)
RE_SL_PHONE = re.compile(r'(?:\+94|0)(?:11|7[01245678]|24|31|38|81)\s*\d{3}\s*\d{4}')

JUNK_EMAILS = {'example.com', 'sentry.io', 'schema.org', 'w3.org', 'wixpress.com', 'domain.com', 'duckduckgo.com'}
JUNK_IG = {'instagram', 'reels', 'explore', 'p', 'tv', 'stories', 'accounts'}
JUNK_FB = {'sharer', 'share', 'dialog', 'plugins', 'login', 'facebook'}

# Purged hardcoded fake directory. All contact details are mined live via web search & scraping.

def fetch_html(url, timeout=10, max_bytes=300_000):
    if not url or not url.startswith(('http://', 'https://')):
        return None
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read(max_bytes)
            charset = resp.headers.get_content_charset() or 'utf-8'
            return raw.decode(charset, errors='replace')
    except Exception as e:
        return None

def clean_email(email_str):
    if not email_str:
        return None
    e = email_str.lower().strip().strip('.')
    if any(e.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.woff', '.woff2', '.ttf', '.webp', '.ico')):
        return None
    if 'error-lite' in e or 'duckduckgo' in e:
        return None
    domain = e.split('@')[-1]
    if domain in JUNK_EMAILS or any(junk in domain for junk in ('sentry', 'schema', 'example', 'w3.org', 'wixpress', 'gws-prod', 'duckduckgo')):
        return None
    return e

def clean_phone(phone_str):
    if not phone_str:
        return None
    clean = phone_str.strip().strip('"').strip("'")
    if len(re.sub(r'\D', '', clean)) < 7:
        return None
    return clean

def clean_instagram(user):
    if not user:
        return None
    u = user.strip('/').split('?')[0]
    return None if (u.lower() in JUNK_IG or len(u) < 2) else f"https://instagram.com/{u}"

def clean_facebook(page):
    if not page:
        return None
    p = page.strip('/').split('?')[0]
    return None if (p.lower() in JUNK_FB or len(p) < 3) else f"https://facebook.com/{p}"

def scrape_website(website_url):
    """
    Crawls target website homepage and subpages (/contact, /about)
    to extract real emails, phone numbers, Instagram, and Facebook handles.
    """
    res = {'email': None, 'phone': None, 'instagram': None, 'facebook': None}
    if not website_url:
        return res

    url = website_url if website_url.startswith('http') else 'http://' + website_url
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    pages_to_crawl = [url]
    for sub in ['/contact', '/contact-us', '/about', '/reach-us', '/contactus']:
        pages_to_crawl.append(base + sub)

    combined_html = ""
    for target in pages_to_crawl[:3]:
        html = fetch_html(target)
        if html:
            combined_html += "\n" + html
        time.sleep(0.2)

    if not combined_html:
        return res

    # Extract email
    for raw in RE_EMAIL.findall(combined_html):
        c = clean_email(raw)
        if c:
            res['email'] = c
            break

    # Extract phone
    tels = RE_TEL.findall(combined_html)
    if tels:
        c_phone = clean_phone(tels[0])
        if c_phone:
            res['phone'] = c_phone
    if not res['phone']:
        phones = RE_SL_PHONE.findall(combined_html)
        if phones:
            res['phone'] = phones[0].strip()

    # Extract Instagram
    igs = RE_INSTAGRAM.findall(combined_html)
    if igs:
        res['instagram'] = clean_instagram(igs[0])

    # Extract Facebook
    fbs = RE_FACEBOOK.findall(combined_html)
    if fbs:
        res['facebook'] = clean_facebook(fbs[0])

    return res

def scrape_google_maps_place(business_name, address=""):
    """
    Tier 1: Directly fetches Google Maps place search page for the business name and address
    to extract direct phone numbers, website links, and embedded details.
    """
    res = {'phone': None, 'website': None, 'email': None}
    query = f"{business_name} {address} Sri Lanka".strip()
    maps_url = f"https://www.google.com/maps/search/{quote_plus(query)}"
    html = fetch_html(maps_url, timeout=10)

    if not html:
        return res

    # 1. Extract phone numbers from place data
    phones = RE_SL_PHONE.findall(html)
    if phones:
        res['phone'] = phones[0].strip()

    # 2. Extract external website links (non-google domains)
    raw_urls = re.findall(r'\"(https?://[^\"]+)\"', html)
    ignored = ('google.com', 'gstatic.com', 'googleusercontent.com', 'ggpht.com', 'w3.org', 'schema.org')
    for u in raw_urls:
        if not any(ign in u.lower() for ign in ignored):
            res['website'] = u
            break

    # 3. Extract email if embedded
    for raw in RE_EMAIL.findall(html):
        c = clean_email(raw)
        if c:
            res['email'] = c
            break

    return res

def search_bing_for_business(business_name, address=""):
    """
    Tier 3 Fallback: Queries Bing Search for business contact info and website links.
    Bing returns HTTP 200 OK reliably.
    """
    query = f'"{business_name}" {address} Sri Lanka phone email contact'
    url = f"https://www.bing.com/search?q={quote_plus(query)}"
    html = fetch_html(url, timeout=10)

    found_info = {
        'candidate_website': None,
        'email': None,
        'phone': None,
        'instagram': None,
        'facebook': None
    }

    if not html:
        return found_info

    blocks = re.findall(r'<li class=\"b_algo\".*?</li>', html, re.DOTALL)
    ignored_domains = ('bing.com', 'microsoft.com', 'w3.org', 'wikipedia.org', 'ubereats.com', 'pickme.lk', 'foodpanda.lk', 'tripadvisor.com', 'yelp.com')

    for b in blocks:
        text = re.sub(r'<[^>]+>', ' ', b)
        text = re.sub(r'\s+', ' ', text).strip()

        if not found_info['phone']:
            phones = RE_SL_PHONE.findall(text)
            if phones:
                found_info['phone'] = phones[0].strip()

        if not found_info['email']:
            for raw in RE_EMAIL.findall(text):
                c = clean_email(raw)
                if c:
                    found_info['email'] = c
                    break

        urls = re.findall(r'href=\"(https?://[^\"]+)\"', b)
        for u in urls:
            domain = urlparse(u).netloc.lower()
            if any(ign in domain for ign in ignored_domains):
                continue
            if 'facebook.com' in domain and not found_info['facebook']:
                found_info['facebook'] = u
            elif 'instagram.com' in domain and not found_info['instagram']:
                found_info['instagram'] = u
            elif not found_info['candidate_website']:
                found_info['candidate_website'] = u

    return found_info

def fallback_google_mine(business_name, address="", location="Sri Lanka"):
    """
    Multi-tier Sequential Mining Engine:
    1. Scrapes Google Maps Place Search directly for business phone, website & email.
    2. Searches web (Bing search) as fallback for missing email or phone.
    3. Crawls target website HTML for detailed contact info.
    """
    mined = {
        'found_website': None,
        'email': None,
        'phone': None,
        'instagram': None,
        'facebook': None
    }

    # Step 1: Scrape Google Maps Place Search directly
    gmaps_res = scrape_google_maps_place(business_name, address)
    if gmaps_res.get('phone'):
        mined['phone'] = gmaps_res['phone']
    if gmaps_res.get('website'):
        mined['found_website'] = gmaps_res['website']
    if gmaps_res.get('email'):
        mined['email'] = gmaps_res['email']

    # Step 2: Fallback Bing Search if phone/email/website still missing
    if not mined['phone'] or not mined['email'] or not mined['found_website']:
        bing_res = search_bing_for_business(business_name, address)
        if bing_res.get('candidate_website') and not mined['found_website']:
            mined['found_website'] = bing_res['candidate_website']
        if bing_res.get('email') and not mined['email']:
            mined['email'] = bing_res['email']
        if bing_res.get('phone') and not mined['phone']:
            mined['phone'] = bing_res['phone']
        if bing_res.get('instagram') and not mined['instagram']:
            mined['instagram'] = bing_res['instagram']
        if bing_res.get('facebook') and not mined['facebook']:
            mined['facebook'] = bing_res['facebook']

    # Step 3: Crawl target website HTML if website exists
    target_site = mined['found_website'] or mined['facebook']
    if target_site and 'facebook.com' not in target_site:
        scraped = scrape_website(target_site)
        if scraped.get('email') and not mined['email']:
            mined['email'] = scraped['email']
        if scraped.get('phone') and not mined['phone']:
            mined['phone'] = scraped['phone']
        if scraped.get('instagram') and not mined['instagram']:
            mined['instagram'] = scraped['instagram']
        if scraped.get('facebook') and not mined['facebook']:
            mined['facebook'] = scraped['facebook']

    return mined

