import type { Lead } from "./types";

export interface EnrichmentOptions {
  provider?: "claude" | "ollama" | "auto";
  anthropicApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

/**
 * Generates a short (2-3 sentence) personalized cold outreach opener for a lead using Claude API or Ollama.
 */
export async function generateColdOpener(
  lead: Lead,
  options: EnrichmentOptions = {}
): Promise<string> {
  const {
    provider = "auto",
    anthropicApiKey = process.env.ANTHROPIC_API_KEY,
    ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b-instruct-q4_K_M",
  } = options;

  const catLower = (lead.category || "").toLowerCase();
  const isHospitality = /restaurant|cafe|dining|bistro|bakery|bar|pub|food/.test(catLower);
  const isAgencySoftware = /marketing|advertising|software|saas|tech|agency|media|pr|consult/.test(catLower);
  const isTrades = /plumbing|hvac|roofing|electrician|contractor|repair|solar/.test(catLower);
  const isProfessional = /law|legal|attorney|dentist|dental|doctor|clinic|cpa|account/.test(catLower);

  const valuePitchReq = isHospitality
    ? "pitch VIP reservation automation, kitchen/POS integration, or direct ordering channel optimization."
    : isAgencySoftware
    ? "pitch accelerating client acquisition funnels, digital storefront conversion, and inbound lead capture."
    : isTrades
    ? "pitch instant mobile quote request portals and local Google Maps search optimization."
    : isProfessional
    ? "pitch automated client/patient intake portals and online scheduling workflows."
    : "pitch modern digital presence optimization and client acquisition.";

  const prompt = `Write a compelling 2-3 sentence cold outreach email opener for a potential B2B client. 
Business Name: ${lead.name}
Category: ${lead.category || "Local Business"}
Address: ${lead.address || "Local area"}
Star Rating: ${lead.rating ? `${lead.rating} stars (${lead.reviews} reviews)` : "Unrated"}
Website Status: ${lead.website ? `Has website (${lead.website})` : "No website listed"}

Requirements:
- Keep it to EXACTLY 2-3 sentences.
- Be highly specific, referencing their business name, rating (${lead.rating ? `${lead.rating} stars across ${lead.reviews} reviews` : ""}), and local presence.
- CRITICAL: If the business has an established website or high review volume (500+ reviews), DO NOT claim they have a weak digital presence or lack a website. Instead, ${valuePitchReq}
- If the business has NO website listed, highlight the opportunity of building a high-converting digital storefront.
- Sound natural, non-spammy, and focused on starting a genuine conversation.
- Do NOT output full email headers, subject line, or sign-offs — ONLY output the 2-3 sentence opener text.`;

  // 1. Try Anthropic Claude API if configured
  if ((provider === "claude" || provider === "auto") && anthropicApiKey && anthropicApiKey.trim() !== "") {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text?.trim();
        if (text) return text;
      }
    } catch {
      // fallback to Ollama or simple opener
    }
  }

  // 2. Try Local Ollama API if configured
  if (provider === "ollama" || provider === "auto") {
    try {
      const res = await fetch(`${ollamaBaseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const responseText = data.response?.trim();
        if (responseText) return responseText;
      }
    } catch {
      // fallback to template
    }
  }

  // 3. Fallback template opener if no LLM key/service available
  const ratingMention = lead.rating >= 4.0 
    ? `I was really impressed seeing ${lead.name}'s ${lead.rating}-star reputation (${lead.reviews ? `${lead.reviews.toLocaleString()} reviews` : "established rating"}).`
    : `I came across ${lead.name} while researching top ${lead.category || "service"} providers in the area.`;

  let webMention = "";
  if (!lead.website) {
    webMention = `I noticed your business doesn't currently list an official website on Google Maps, which represents a massive opportunity to capture local clients with a dedicated digital storefront.`;
  } else if (isAgencySoftware) {
    webMention = lead.reviews >= 500
      ? `Given your strong market presence, I wanted to share a quick strategy for expanding your client acquisition pipeline and web conversion.`
      : `I took a look at your website and wanted to share a strategy for accelerating direct inbound lead capture and client acquisition.`;
  } else if (isTrades) {
    webMention = `Given your strong local reputation, I wanted to share a quick idea on streamlining mobile quote requests and local search visibility.`;
  } else if (isProfessional) {
    webMention = `Given your strong practice reputation, I wanted to share a strategy for automating client intake and expanding online appointment scheduling.`;
  } else {
    webMention = lead.reviews >= 500
      ? `Given your strong market presence, I wanted to share a quick idea on streamlining VIP guest reservations and direct ordering channels.`
      : `I took a look at your website and wanted to share a strategy for increasing direct bookings while cutting aggregator commissions.`;
  }

  return `${ratingMention} ${webMention} Would you be open to a quick 5-minute chat this week about how we can help ${lead.name}?`;
}
