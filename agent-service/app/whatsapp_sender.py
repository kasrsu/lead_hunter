"""WhatsApp message sender module.

Supports sending via:
- Meta WhatsApp Cloud API (WHATSAPP_CLOUD_TOKEN, WHATSAPP_PHONE_NUMBER_ID)
- UltraMsg API (ULTRAMSG_INSTANCE_ID, ULTRAMSG_TOKEN)
- Twilio WhatsApp API (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER)
- Generic HTTP Webhook (WHATSAPP_API_URL, WHATSAPP_API_KEY)
- Fallback: Direct wa.me click-to-chat URL generator
"""
import os
import re
import urllib.parse
import logging
from typing import Dict, Any

import requests

logger = logging.getLogger("whatsapp_sender")


def sanitize_phone_number(phone: str) -> str:
    """Format phone number to international digits-only format with Sri Lanka +94 default."""
    if not phone:
        return ""
    raw = phone.strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # Sri Lanka 11 digits starting with 94
    if digits.startswith("94") and len(digits) == 11:
        return digits

    # Local Sri Lanka 10 digits starting with 0 (e.g. 0773718159 -> 94773718159)
    if digits.startswith("0") and len(digits) == 10:
        return "94" + digits[1:]

    # Local Sri Lanka 9 digits without leading 0
    if len(digits) == 9 and digits[0] in "12378":
        return "94" + digits

    # Default 10-digit number assuming Sri Lanka if not starting with 1
    if len(digits) == 10 and not digits.startswith("1"):
        return "94" + digits[1:]

    return digits


def detect_landline(phone: str) -> tuple[bool, str]:
    """Detect if a phone number is a landline, toll-free, or non-mobile number."""
    if not phone or not phone.strip():
        return True, "Missing phone number"

    raw = phone.strip()
    digits = re.sub(r"\D", "", raw)

    if not digits or len(digits) < 10:
        return True, "Incomplete phone number"

    # 1. Toll-free numbers (1800, 1860, 0800, 800, 888, 877, 866, 855, 844, 833)
    if re.search(r"^(1800|1860|0800|0808|800|888|877|866|855|844|833)", digits):
        return True, "Toll-free landline / service line"

    # 2. Try python-phonenumbers library if installed
    try:
        import phonenumbers
        region = None if raw.startswith("+") else "IN"
        parsed = phonenumbers.parse(raw, region)
        if phonenumbers.is_valid_number(parsed):
            ntype = phonenumbers.number_type(parsed)
            if ntype in (
                phonenumbers.PhoneNumberType.FIXED_LINE,
                phonenumbers.PhoneNumberType.TOLL_FREE,
                phonenumbers.PhoneNumberType.PREMIUM_RATE,
                phonenumbers.PhoneNumberType.SHARED_COST,
                phonenumbers.PhoneNumberType.VOIP,
            ):
                return True, f"Detected landline ({ntype.name if hasattr(ntype, 'name') else ntype})"
            elif ntype in (phonenumbers.PhoneNumberType.MOBILE, phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE):
                return False, "Valid mobile number"
    except Exception:
        pass

    # 3. Country-specific heuristic pattern validation
    # A) India (+91 or 10-digit default / 11-digit leading 0)
    if raw.startswith("+91") or digits.startswith("91"):
        in_digits = digits[2:] if digits.startswith("91") else digits
        if len(in_digits) == 11 and in_digits.startswith("0"):
            in_digits = in_digits[1:]
        if len(in_digits) == 10:
            if not in_digits[0] in ("6", "7", "8", "9"):
                return True, "Indian landline number (does not start with 6/7/8/9)"
        else:
            return True, f"Invalid phone digit count ({len(in_digits)}) for India"

    elif len(digits) == 10:
        if not digits[0] in ("6", "7", "8", "9"):
            return True, "Landline number (does not start with mobile prefix 6/7/8/9)"

    # B) UK (+44 / 07...)
    if raw.startswith("+44") or digits.startswith("44") or (digits.startswith("0") and len(digits) == 11):
        uk_digits = digits[2:] if digits.startswith("44") else (digits[1:] if digits.startswith("0") else digits)
        if not uk_digits.startswith("7"):
            return True, "UK landline number (does not start with 7)"

    # C) UAE (+971 / 05...)
    if raw.startswith("+971") or digits.startswith("971"):
        uae_digits = digits[3:] if digits.startswith("971") else digits
        if uae_digits.startswith("0"):
            uae_digits = uae_digits[1:]
        if not uae_digits.startswith("5"):
            return True, "UAE landline number (does not start with 5)"

    # D) Australia (+61 / 04...)
    if raw.startswith("+61") or digits.startswith("61"):
        au_digits = digits[2:] if digits.startswith("61") else digits
        if au_digits.startswith("0"):
            au_digits = au_digits[1:]
        if not au_digits.startswith("4"):
            return True, "Australian landline number (does not start with 4)"

    return False, "Passes mobile format check"


def verify_whatsapp_status(phone: str) -> Dict[str, Any]:
    """Verify whether a phone number is registered/valid on WhatsApp and not a landline."""
    clean_phone = sanitize_phone_number(phone)
    if not clean_phone or len(clean_phone) < 10:
        return {"whatsapp_status": "no_phone", "is_valid": False, "reason": "Missing or incomplete phone number"}

    # Run landline detection check
    is_landline, landline_reason = detect_landline(phone)
    if is_landline:
        logger.info("Filtered landline number %s: %s", phone, landline_reason)
        return {"whatsapp_status": "landline_invalid", "is_valid": False, "reason": landline_reason}

    # 1. Check via UltraMsg API if configured
    ultramsg_instance = os.getenv("ULTRAMSG_INSTANCE_ID", "").strip()
    ultramsg_token = os.getenv("ULTRAMSG_TOKEN", "").strip()
    if ultramsg_instance and ultramsg_token:
        try:
            url = f"https://api.ultramsg.com/{ultramsg_instance}/contacts/check"
            params = {"token": ultramsg_token, "phone": clean_phone}
            resp = requests.get(url, params=params, timeout=5)
            if resp.ok:
                data = resp.json()
                is_valid = data.get("status") == "valid" or data.get("isWhatsApp", False)
                status_str = "verified" if is_valid else "invalid"
                return {"whatsapp_status": status_str, "is_valid": is_valid, "provider": "ultramsg", "raw": data}
        except Exception as e:
            logger.warning("UltraMsg contact verification failed: %s", e)

    # 2. Check via Meta WhatsApp Cloud API if configured
    cloud_token = os.getenv("WHATSAPP_CLOUD_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    if cloud_token and phone_number_id:
        try:
            url = f"https://graph.facebook.com/v18.0/{phone_number_id}/contacts"
            headers = {"Authorization": f"Bearer {cloud_token}", "Content-Type": "application/json"}
            payload = {"messaging_product": "whatsapp", "contacts": [clean_phone], "blocking": "wait"}
            resp = requests.post(url, json=payload, headers=headers, timeout=5)
            if resp.ok:
                data = resp.json()
                contacts = data.get("contacts", [])
                is_valid = any(c.get("status") == "valid" for c in contacts)
                status_str = "verified" if is_valid else "invalid"
                return {"whatsapp_status": status_str, "is_valid": is_valid, "provider": "meta_cloud", "raw": data}
        except Exception as e:
            logger.warning("Meta Cloud API contact verification failed: %s", e)

    # 3. Structural mobile validation fallback
    is_structurally_valid = bool(re.match(r"^\d{10,15}$", clean_phone))
    if is_structurally_valid:
        return {"whatsapp_status": "verified", "is_valid": True, "provider": "format_validation"}
    
    return {"whatsapp_status": "invalid", "is_valid": False, "provider": "format_validation"}


def get_whatsapp_click_url(phone: str, message: str) -> str:
    """Generate a standard wa.me click-to-chat link."""
    clean_phone = sanitize_phone_number(phone)
    encoded_text = urllib.parse.quote(message)
    return f"https://wa.me/{clean_phone}?text={encoded_text}"


def send_whatsapp_message(to_phone: str, text: str) -> Dict[str, Any]:
    """Send a WhatsApp message using configured cloud credentials or fallback to wa.me link."""
    clean_phone = sanitize_phone_number(to_phone)
    if not clean_phone:
        raise ValueError("Invalid target phone number for WhatsApp dispatch")

    wa_url = get_whatsapp_click_url(clean_phone, text)

    # 1. Meta WhatsApp Cloud API
    cloud_token = os.getenv("WHATSAPP_CLOUD_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    if cloud_token and phone_number_id:
        try:
            url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {cloud_token}",
                "Content-Type": "application/json",
            }
            payload = {
                "messaging_product": "whatsapp",
                "to": clean_phone,
                "type": "text",
                "text": {"body": text},
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            logger.info("WhatsApp message sent via Meta Cloud API to %s", clean_phone)
            return {"status": "sent", "provider": "meta_cloud", "response": resp.json(), "url": wa_url}
        except Exception as e:
            logger.error("Meta WhatsApp Cloud API send failed: %s", e)

    # 2. UltraMsg API
    ultramsg_instance = os.getenv("ULTRAMSG_INSTANCE_ID", "").strip()
    ultramsg_token = os.getenv("ULTRAMSG_TOKEN", "").strip()
    if ultramsg_instance and ultramsg_token:
        try:
            url = f"https://api.ultramsg.com/{ultramsg_instance}/messages/chat"
            payload = {
                "token": ultramsg_token,
                "to": clean_phone,
                "body": text,
            }
            resp = requests.post(url, data=payload, timeout=10)
            resp.raise_for_status()
            logger.info("WhatsApp message sent via UltraMsg API to %s", clean_phone)
            return {"status": "sent", "provider": "ultramsg", "response": resp.json(), "url": wa_url}
        except Exception as e:
            logger.error("UltraMsg API send failed: %s", e)

    # 3. Twilio WhatsApp API
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    twilio_from = os.getenv("TWILIO_WHATSAPP_NUMBER", "").strip()
    if twilio_sid and twilio_token and twilio_from:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            from_num = twilio_from if twilio_from.startswith("whatsapp:") else f"whatsapp:{twilio_from}"
            to_num = f"whatsapp:+{clean_phone}"
            data = {
                "From": from_num,
                "To": to_num,
                "Body": text,
            }
            resp = requests.post(url, data=data, auth=(twilio_sid, twilio_token), timeout=10)
            resp.raise_for_status()
            logger.info("WhatsApp message sent via Twilio API to %s", clean_phone)
            return {"status": "sent", "provider": "twilio", "response": resp.json(), "url": wa_url}
        except Exception as e:
            logger.error("Twilio WhatsApp API send failed: %s", e)

    # 4. Generic Webhook API
    generic_url = os.getenv("WHATSAPP_API_URL", "").strip()
    generic_key = os.getenv("WHATSAPP_API_KEY", "").strip()
    if generic_url:
        try:
            headers = {"Content-Type": "application/json"}
            if generic_key:
                headers["Authorization"] = f"Bearer {generic_key}"
            payload = {"phone": clean_phone, "message": text}
            resp = requests.post(generic_url, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            logger.info("WhatsApp message sent via generic API to %s", clean_phone)
            return {"status": "sent", "provider": "webhook", "response": resp.json(), "url": wa_url}
        except Exception as e:
            logger.error("Generic WhatsApp API send failed: %s", e)

    # 5. Fallback: wa.me Link
    logger.info("No cloud WhatsApp API token configured. Created wa.me click-to-chat URL for %s", clean_phone)
    return {
        "status": "link_generated",
        "provider": "wa_me_link",
        "phone": clean_phone,
        "url": wa_url,
    }
