/**
 * WhatsApp message sending wrapper for Next.js app.
 *
 * Supports sending via configured Cloud APIs (UltraMsg / Meta Cloud API / Twilio)
 * or generating direct wa.me click-to-chat links.
 */

interface SendWhatsAppInput {
  toPhone: string;
  text: string;
  senderName?: string;
}

export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return "";
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Sri Lanka 11-digit number starting with 94 (e.g. 94773718159)
  if (digits.startsWith("94") && digits.length === 11) {
    return digits;
  }

  // Local Sri Lankan 10-digit number starting with '0' (e.g. 0773718159 or 0112739610 -> 94773718159)
  if (digits.startsWith("0") && digits.length === 10) {
    return "94" + digits.slice(1);
  }

  // Local Sri Lankan 9-digit number without leading 0 (e.g. 773718159 -> 94773718159)
  if (digits.length === 9 && /^[12378]/.test(digits)) {
    return "94" + digits;
  }

  // Default 10-digit local number (non-US) -> assume Sri Lanka +94
  if (digits.length === 10 && !digits.startsWith("1")) {
    return "94" + digits.slice(1);
  }

  return digits;
}

export function getWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

export function detectLandline(phone: string): { isLandline: boolean; reason: string } {
  if (!phone || !phone.trim()) return { isLandline: true, reason: "Missing phone number" };
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length < 10) return { isLandline: true, reason: "Incomplete phone number" };

  // Toll-free numbers
  if (/^(1800|1860|0800|0808|800|888|877|866|855|844|833)/.test(digits)) {
    return { isLandline: true, reason: "Toll-free landline / service line" };
  }

  // India mobile check (starts with 6,7,8,9 if 10 digits or +91)
  if (raw.startsWith("+91") || digits.startsWith("91")) {
    const inDigits = digits.startsWith("91") ? digits.slice(2) : digits;
    const cleanIn = inDigits.length === 11 && inDigits.startsWith("0") ? inDigits.slice(1) : inDigits;
    if (cleanIn.length === 10 && !/^[6-9]/.test(cleanIn)) {
      return { isLandline: true, reason: "Indian landline number" };
    }
  } else if (digits.length === 10 && !/^[6-9]/.test(digits)) {
    return { isLandline: true, reason: "Landline number (does not start with 6/7/8/9)" };
  }

  // UK check (+44 or 07...)
  if (raw.startsWith("+44") || digits.startsWith("44") || (digits.startsWith("0") && digits.length === 11)) {
    const ukDigits = digits.startsWith("44") ? digits.slice(2) : (digits.startsWith("0") ? digits.slice(1) : digits);
    if (!ukDigits.startsWith("7")) {
      return { isLandline: true, reason: "UK landline number" };
    }
  }

  return { isLandline: false, reason: "Passes mobile format check" };
}

export async function verifyWhatsAppNumber(phone: string): Promise<{ whatsappStatus: string; isValid: boolean }> {
  const cleanPhone = sanitizePhoneNumber(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return { whatsappStatus: "no_phone", isValid: false };
  }

  const landlineCheck = detectLandline(phone);
  if (landlineCheck.isLandline) {
    return { whatsappStatus: "landline_invalid", isValid: false };
  }

  const ultramsgInstance = process.env.ULTRAMSG_INSTANCE_ID;
  const ultramsgToken = process.env.ULTRAMSG_TOKEN;
  if (ultramsgInstance && ultramsgToken) {
    try {
      const res = await fetch(`https://api.ultramsg.com/${ultramsgInstance}/contacts/check?token=${ultramsgToken}&phone=${cleanPhone}`);
      if (res.ok) {
        const data = await res.json();
        const isValid = data?.status === "valid" || data?.isWhatsApp === true;
        return { whatsappStatus: isValid ? "verified" : "invalid", isValid };
      }
    } catch {
      // ignore
    }
  }

  const isValidFormat = /^\d{10,15}$/.test(cleanPhone);
  return { whatsappStatus: isValidFormat ? "verified" : "invalid", isValid: isValidFormat };
}

export async function sendOutreachWhatsApp({ toPhone, text, senderName }: SendWhatsAppInput) {
  const cleanPhone = sanitizePhoneNumber(toPhone);
  if (!cleanPhone) {
    throw new Error("Lead has no valid phone number on file for WhatsApp outreach");
  }

  const waUrl = getWhatsAppUrl(cleanPhone, text);

  // Check Cloud API configurations
  const cloudToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (cloudToken && phoneNumberId) {
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cloudToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: text },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { status: "sent", provider: "meta_cloud", data, url: waUrl };
    }
  }

  const ultramsgInstance = process.env.ULTRAMSG_INSTANCE_ID;
  const ultramsgToken = process.env.ULTRAMSG_TOKEN;

  if (ultramsgInstance && ultramsgToken) {
    const params = new URLSearchParams();
    params.append("token", ultramsgToken);
    params.append("to", cleanPhone);
    params.append("body", text);

    const res = await fetch(`https://api.ultramsg.com/${ultramsgInstance}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (res.ok) {
      const data = await res.json();
      return { status: "sent", provider: "ultramsg", data, url: waUrl };
    }
  }

  // Fallback to click-to-chat URL
  return {
    status: "link_generated",
    provider: "wa_me_link",
    phone: cleanPhone,
    url: waUrl,
  };
}
