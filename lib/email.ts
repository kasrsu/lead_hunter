import { Resend } from "resend";

/**
 * Email sending wrapper.
 *
 * Deliberately one-lead-at-a-time, not a bulk blast function. Cold outreach
 * to businesses is regulated (CAN-SPAM in the US, PECR/GDPR in the UK/EU,
 * similar rules elsewhere): you need a real sender identity, a working
 * reply-to/unsubscribe path, and accurate subject lines. Sending must stay a
 * human-reviewed, per-lead action in the UI — don't wire this to auto-send
 * on enrichment.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string; // must be a domain verified in Resend
}

export async function sendOutreachEmail({ to, subject, body, senderName, senderEmail }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!to) throw new Error("Lead has no email address on file — Places API doesn't expose business emails, add one manually first");

  const resend = new Resend(apiKey);

  const html = body
    .split("\n\n")
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  const footer = `<p style="color:#93A29C;font-size:12px;margin-top:24px;">
    Sent by ${senderName}. Reply "stop" if you'd rather not hear from us again.
  </p>`;

  return resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to,
    subject,
    html: html + footer,
    replyTo: senderEmail,
  });
}
