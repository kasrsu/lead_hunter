import type { PersistedLead, TelegramConfig } from "../types";

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8922881742:AAEN_BmuOeUVIpMdPxvLPuQkggjiaRd5VEY";
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "5613517754";

let inMemoryConfig: TelegramConfig = {
  botToken: DEFAULT_BOT_TOKEN,
  chatId: DEFAULT_CHAT_ID,
  enabled: Boolean(DEFAULT_BOT_TOKEN && DEFAULT_CHAT_ID),
  autoSendTelegramOnReady: true,
};

export function getTelegramConfig(): TelegramConfig {
  return { ...inMemoryConfig };
}

export function saveTelegramConfig(config: Partial<TelegramConfig>): TelegramConfig {
  inMemoryConfig = {
    ...inMemoryConfig,
    ...config,
    botToken: (config.botToken || inMemoryConfig.botToken || DEFAULT_BOT_TOKEN).trim(),
    chatId: (config.chatId || inMemoryConfig.chatId || DEFAULT_CHAT_ID).trim(),
    enabled: Boolean((config.botToken || inMemoryConfig.botToken) && (config.chatId || inMemoryConfig.chatId)),
  };
  return { ...inMemoryConfig };
}

/** Auto-detects the Chat ID from recent Telegram updates */
export async function autoDetectChatId(botTokenOverride?: string): Promise<{ chatId: string | null; username: string | null }> {
  const token = (botTokenOverride || inMemoryConfig.botToken || DEFAULT_BOT_TOKEN).trim();
  if (!token) return { chatId: null, username: null };

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    const res = await fetch(url);
    if (!res.ok) return { chatId: null, username: null };
    const data = await res.json();

    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      for (let i = data.result.length - 1; i >= 0; i--) {
        const update = data.result[i];
        const msg = update.message || update.edited_message || update.channel_post;
        if (msg && msg.chat && msg.chat.id) {
          const detectedChatId = String(msg.chat.id);
          const username = msg.from?.username || msg.from?.first_name || "User";
          saveTelegramConfig({ chatId: detectedChatId });
          return { chatId: detectedChatId, username };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Telegram Auto-Detect Error] ${err.message}`);
  }

  return { chatId: null, username: null };
}

/** Sends a Telegram message with optional Inline Keyboard */
export async function sendTelegramMessage(
  text: string,
  replyMarkup?: any,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<boolean> {
  const config = getTelegramConfig();

  const activeToken = config.botToken || DEFAULT_BOT_TOKEN;
  const activeChatId = config.chatId || DEFAULT_CHAT_ID;

  if (!activeToken || !activeChatId) {
    console.warn(`[Telegram Service] Cannot send message — missing chatId or botToken.`);
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${activeToken}/sendMessage`;
    const body: any = {
      chat_id: activeChatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      console.log(`[Telegram Service] Successfully dispatched message to Chat ID: ${activeChatId}`);
      return true;
    } else {
      const errText = await res.text();
      console.warn(`[Telegram API Response Error] ${res.status}: ${errText}`);
      return false;
    }
  } catch (err: any) {
    console.warn(`[Telegram Service Exception] ${err.message}`);
    return false;
  }
}

/** Deployment lifecycle notifications */
export async function notifyDeploymentStart(totalLeads: number): Promise<boolean> {
  const msg = `
🚀 <b>Autonomous Lead Hunter Agent Deployed!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Total Leads queued for processing:</b> ${totalLeads}
<b>Status:</b> Actively calculating 4-part metrics, AI enrichment & readying for approval.
<i>Tap ✅ <b>Approve & Send (Resend)</b> on lead cards below to send instantly!</i>
`.trim();

  return sendTelegramMessage(msg);
}

/** Dispatches Lead Enriched alert with Interactive "Approve & Send (Resend)" button */
export async function notifyLeadEnriched(lead: PersistedLead): Promise<boolean> {
  const score = lead.opportunityScore ?? lead.leadScore ?? 50;
  const tier = lead.priorityTier || "Warm";
  const tierEmoji = tier === "Hot" ? "🔥" : tier === "Warm" ? "🟧" : "🟦";

  const subject = lead.emailSubject || `Outreach & Partnership Proposal - ${lead.name}`;
  const body = lead.emailBody || "";

  const msg = `
${tierEmoji} <b>Lead Ready for Approval:</b> ${escapeHtml(lead.name)}
━━━━━━━━━━━━━━━━━━━━
<b>Category:</b> ${escapeHtml(lead.category || "Hospitality")}
<b>Address:</b> ${escapeHtml(lead.address || "N/A")}
<b>Rating:</b> ★ ${lead.rating} (${lead.reviews} reviews)
<b>Opportunity Score:</b> <code>${score}/100</code> (${tier})
<b>Contact Email:</b> <code>${escapeHtml(lead.contactEmail || "Missing Email")}</code>

<b>Subject:</b> <i>"${escapeHtml(subject)}"</i>

${escapeHtml(body)}
`.trim();

  const actions: { text: string; callback_data: string }[] = [];

  if (lead.contactEmail) {
    actions.push({ text: "📧 Send Email (Resend)", callback_data: `approve:${lead.id}` });
  }
  if (lead.phone) {
    actions.push({ text: "💬 Send via WhatsApp", callback_data: `approve_wa:${lead.id}` });
  }
  if (actions.length === 0) {
    actions.push({ text: "✅ Approve Lead", callback_data: `approve:${lead.id}` });
  }

  const inlineKeyboard = {
    inline_keyboard: [
      actions,
      [
        { text: "🔄 Regenerate Draft", callback_data: `regen:${lead.id}` },
      ],
    ],
  };

  return sendTelegramMessage(msg, inlineKeyboard);
}

export async function notifyEmailDispatched(lead: PersistedLead, toEmail: string): Promise<boolean> {
  const score = lead.opportunityScore ?? lead.leadScore ?? 50;
  const tier = lead.priorityTier || "Warm";
  const tierEmoji = tier === "Hot" ? "🔥" : tier === "Warm" ? "🟧" : "🟦";

  const msg = `
📬 <b>OUTBOUND EMAIL DISPATCHED VIA RESEND!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Business:</b> ${escapeHtml(lead.name)}
<b>Sent To:</b> <code>${escapeHtml(toEmail)}</code>
<b>Score:</b> ${tierEmoji} <code>${score}/100</code> (${tier})
<b>AI Subject:</b> <i>"${escapeHtml(lead.emailSubject || "N/A")}"</i>
<b>Status:</b> Autonomously Sent & Recorded in Database!
`.trim();

  return sendTelegramMessage(msg);
}

export async function notifyDeploymentComplete(processed: number, total: number, readyCount: number): Promise<boolean> {
  const msg = `
🎉 <b>Autonomous Deployment Completed!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Processed:</b> ${processed} of ${total} leads
<b>Ready in Approval Queue:</b> ${readyCount} leads awaiting human approval!
<b>Status:</b> All queued leads have been enriched and stored in database.
`.trim();

  return sendTelegramMessage(msg);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
