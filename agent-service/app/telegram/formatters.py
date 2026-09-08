"""Format lead data into Telegram HTML messages."""

def format_approval_message(lead: dict) -> str:
    name = _esc(lead.get("name", "Unknown"))
    category = _esc(lead.get("category", ""))
    address = _esc(lead.get("address", ""))
    rating = lead.get("rating", 0) or 0
    reviews = lead.get("reviews", 0) or 0
    phone = _esc(lead.get("phone", "N/A"))
    email = _esc(lead.get("contact_email", "N/A"))

    score = lead.get("lead_score", 0) or 0
    tier = _esc(lead.get("priority_tier", "N/A"))
    classification = _esc(lead.get("classification", "N/A"))

    subject = _esc(lead.get("email_subject") or f"Outreach & Partnership Proposal - {name}")
    body = _esc(lead.get("email_body", "(no body)"))

    channel = str(lead.get("channel") or "").upper()
    if channel == "WHATSAPP" or (phone != "N/A" and email == "N/A"):
        channel_header = "💬 <b>WHATSAPP DISPATCH READY</b>"
        channel_icon = "💬 WhatsApp"
    else:
        channel_header = "📧 <b>EMAIL DISPATCH READY</b>"
        channel_icon = "📧 Email"

    stars = "⭐" * min(5, int(round(rating)))

    return f"""{channel_header}
━━━━━━━━━━━━━━━━━━━━━━━━

🏪 <b>{name}</b>
   {_cat(category)} · {_addr(address)}
   {stars} {rating} ({reviews} reviews)
   📞 Phone: {phone}
   📧 Email: {email}
   📡 Channel: <b>{channel_icon}</b>

📊 Score: <b>{score}/100</b> · <code>{tier}</code>
   {classification}

━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>Subject:</b> {subject}

{body}
━━━━━━━━━━━━━━━━━━━━━━━━"""


def _esc(text: str) -> str:
    """Minimal HTML escaping for Telegram."""
    if not text:
        return ""
    return (
        str(text).replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _cat(c: str) -> str:
    return f"<i>{_esc(c)}</i>" if c else ""


def _addr(a: str) -> str:
    return _esc(a) if a else ""
