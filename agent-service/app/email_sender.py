"""Resend email sending from Python."""
import os
# pyrefly: ignore [missing-import]
import resend

NEW_API_KEY = "re_X2dAG3oc_EvNn9WQ5RbsYcizpEjdXHdDn"


def init_resend():
    api_key = (os.getenv("RESEND_API_KEY") or NEW_API_KEY).strip()
    resend.api_key = api_key


POSTFIX_SIGNATURE = (
    "We have attached our full partnership proposal PDF to this email for your convenience—please feel free to review it! Would love to hear your thoughts or connect for a brief chat.\n\n"
    "If you don't wish to explore this or feel it isn't a fit, please be kind enough to reply and let us know so we can improve and ensure we won't reach out or bother you further.\n\n"
    "Best Regards,\n"
    "Anusara Sugeeshwara\n"
    "Marketing team at EvoSolutions\n"
    "Phone: 0751800804 | Email: hello@evosolutions.lk | Web: evosolutions.lk"
)


DEFAULT_ATTACHMENT_PATH = "/home/kasr/Storage/Project TagTeam/LeadHunt_Project/pdf_proposal/EvoDine_Restaurant_Management_(3) (1).pdf"


def send_email(
    to: str,
    subject: str,
    body: str,
    reply_to: str | None = None,
    attachment_path: str | None = DEFAULT_ATTACHMENT_PATH,
) -> dict:
    """Send an email via Resend API in Production mode. Returns the Resend response dict."""
    init_resend()
    sender_email = os.getenv("RESEND_SENDER_EMAIL", "hello@evosolutions.lk").strip()

    final_body = body.strip()
    if not final_body.endswith(POSTFIX_SIGNATURE):
        final_body = f"{final_body}\n\n{POSTFIX_SIGNATURE}"

    html_body = final_body.replace("\n", "<br/>")

    params: dict = {
        "from": f"EvoSolutions <{sender_email}>",
        "to": [to],
        "subject": subject,
        "html": f"<div style='font-family:sans-serif;font-size:14px;line-height:1.6;color:#1e293b'>{html_body}</div>",
    }
    if reply_to:
        params["reply_to"] = reply_to

    pdf_path = attachment_path or DEFAULT_ATTACHMENT_PATH
    if pdf_path and os.path.exists(pdf_path):
        filename = "EvoDine_Proposal.pdf"
        try:
            with open(pdf_path, "rb") as f:
                file_bytes = list(f.read())
            params["attachments"] = [
                {
                    "filename": filename,
                    "content": file_bytes,
                }
            ]
        except Exception:
            params["attachments"] = [
                {
                    "filename": filename,
                    "path": pdf_path,
                }
            ]

    return resend.Emails.send(params)
