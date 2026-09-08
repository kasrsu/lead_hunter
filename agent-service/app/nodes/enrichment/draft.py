"""Draft node for lead enrichment graph."""
import re
from typing import Any
from ...state.enrichment_state import EnrichmentState
from ...prompts.enrichment_prompts import DRAFT_PROMPT_TEMPLATE
from ...scoring import ANGLES
from ...llm import call_ollama


def _format_subject(business_name: str) -> str:
    name = business_name.strip() if business_name else "Your Business"
    return f"Outreach & Partnership Proposal - {name}"


EXACT_SIGNATURE = (
    "We have attached our full partnership proposal PDF to this email for your convenience—please feel free to review it! Would love to hear your thoughts or connect for a brief chat.\n\n"
    "If you don't wish to explore this or feel it isn't a fit, please be kind enough to reply and let us know so we can improve and ensure we won't reach out or bother you further.\n\n"
    "Best Regards,\n"
    "Anusara Sugeeshwara\n"
    "Marketing team at EvoSolutions\n"
    "Phone: 0751800804 | Email: hello@evosolutions.lk | Web: evosolutions.lk"
)


def _ensure_email_body(body: str, business_name: str) -> str:
    name = business_name.strip() if business_name else "Your Business"
    salutation = f"Dear {name} Team,"

    lines = [line.strip() for line in body.strip().split("\n") if line.strip()]

    filtered_lines = []
    for line in lines:
        # Ignore SUBJECT: or BODY: headers accidentally included inside LLM body text
        if re.match(r"^(SUBJECT|BODY):\s*", line, re.IGNORECASE):
            continue
        # Ignore duplicate salutation headers like "Dear Avartana Team," while preserving "Greetings from EvoSolutions! ..."
        if re.match(r"^(Dear|Hi|Hello)\s+.*Team,?", line, re.IGNORECASE) or line.strip() == salutation:
            continue
        # Ignore any manual sign-off / outro lines or generic system pitches from raw LLM output
        if re.match(r"^(Best|Regards|Best Regards|Sincerely|Thanks|Cheers|Warm regards|Kind regards),?", line, re.IGNORECASE):
            continue
        if re.match(r"^(Anusara Sugeeshwara|Marketing team at EvoSolutions|Marketing Team at EvoSolutions|EvoSolutions|Phone:?|Contact:?)\.?", line, re.IGNORECASE):
            continue
        if "would love to hear more about what you think" in line.lower():
            continue
        if "if you don't wish" in line.lower() or "won't reach" in line.lower() or "bother you" in line.lower():
            continue
        if "we have developed a smart pos" in line.lower() or "we believe that by working together" in line.lower():
            continue
        if "please visit evosolutions.lk" in line.lower() or "connect with me directly" in line.lower():
            continue

        filtered_lines.append(line)

    if not filtered_lines:
        content_body = f"I noticed {name} has built a strong reputation. At EvoSolutions, we help leading businesses optimize their digital presence, streamline customer acquisition, and capture direct online revenue."
    else:
        content_body = "\n\n".join(filtered_lines)

    # Ensure salutation at beginning
    if not content_body.startswith(salutation):
        content_body = f"{salutation}\n\n{content_body}"

    # Remove trailing EXACT_SIGNATURE if already present to avoid duplication
    content_body = content_body.rstrip()
    if content_body.endswith(EXACT_SIGNATURE):
        return content_body

    return f"{content_body}\n\n{EXACT_SIGNATURE}"


def _parse_email(raw: str, business_name: str) -> tuple[str, str]:
    body_match = re.search(r"BODY:\s*([\s\S]+)", raw, re.IGNORECASE)
    raw_body = body_match.group(1).strip() if body_match else raw.strip()

    # Always enforce company-targeted subject
    subject = _format_subject(business_name)
    body = _ensure_email_body(raw_body, business_name)
    return subject, body


async def draft_node(state: EnrichmentState) -> dict[str, Any]:
    """Generate cold outreach email draft using research brief and score."""
    sender = state["sender"]
    lead = state.get("lead", {})
    business_name = lead.get("name") or state.get("research_brief", "").split("\n")[0].replace("Business:", "").strip() or "Your Business"

    classification = state.get("classification", "GENERAL_OUTREACH")
    template_type = state.get("template_type", "general_ai_pitch")
    angle = ANGLES.get(template_type, ANGLES["general_ai_pitch"])

    rating = lead.get("rating") if lead.get("rating") is not None else "N/A"
    reviews_count = lead.get("reviews") or lead.get("review_count") or "N/A"
    category = lead.get("category") or "Restaurant & Hospitality"
    address = lead.get("address") or lead.get("location") or "N/A"
    review_snippet = lead.get("reviewSnippet") or lead.get("review_snippet") or "N/A"
    website = lead.get("website") or "N/A"

    rubric_scores = state.get("rubric_scores") or lead.get("rubricScores") or {}
    rubric_justifications = state.get("rubric_justification") or lead.get("rubricJustification") or {}

    rubric_scores_formatted = ", ".join(f"{k}: {v}" for k, v in rubric_scores.items()) if rubric_scores else "N/A"
    rubric_justifications_formatted = "\n".join(f"- {k}: {v}" for k, v in rubric_justifications.items()) if rubric_justifications else "N/A"

    prompt = DRAFT_PROMPT_TEMPLATE.format(
        business_name=business_name,
        category=category,
        rating=rating,
        reviews_count=reviews_count,
        address=address,
        review_snippet=review_snippet,
        website=website,
        offer_description=sender.get("offerDescription", ""),
        research_brief=state.get("research_brief", ""),
        lead_score=state.get("lead_score", 0),
        classification=classification,
        angle=angle,
        rubric_scores_formatted=rubric_scores_formatted,
        rubric_justifications_formatted=rubric_justifications_formatted,
    )

    raw_response = await call_ollama(prompt, temperature=0.6)
    subject, body = _parse_email(raw_response, business_name)

    return {
        "email_subject": subject,
        "email_body": body,
        "iterations": state.get("iterations", 0) + 1,
    }

