import { NextRequest, NextResponse } from "next/server";
import { autoDetectChatId, getTelegramConfig, saveTelegramConfig, sendTelegramMessage } from "@/lib/services/telegramService";

export const runtime = "nodejs";

/** GET /api/telegram/config — Read active Telegram configuration */
export async function GET() {
  const config = getTelegramConfig();
  return NextResponse.json({ config });
}

/** POST /api/telegram/config — Update Telegram Bot Token & Chat ID and send optional test alert */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { botToken, chatId, sendTest, autoDetect } = body || {};

    if (autoDetect) {
      const detected = await autoDetectChatId(botToken);
      if (detected.chatId) {
        const updated = getTelegramConfig();
        return NextResponse.json({
          config: updated,
          detected: true,
          message: `Detected Chat ID: ${detected.chatId} for ${detected.username}`,
        });
      } else {
        return NextResponse.json({
          detected: false,
          message: "No recent messages found. Open Telegram, start your bot, send a message (e.g. /start), then try again!",
        });
      }
    }

    const updated = saveTelegramConfig({
      botToken: typeof botToken === "string" ? botToken.trim() : undefined,
      chatId: typeof chatId === "string" ? chatId.trim() : undefined,
    });

    let testSent = false;
    if (sendTest && updated.botToken && updated.chatId) {
      testSent = await sendTelegramMessage(
        `🧪 <b>Telegram Alert Integration Test</b>\n━━━━━━━━━━━━━━━━━━━━\nLead Hunter Agent connection established! You will receive live lead scoring and outreach completion notifications here.`
      );
    }

    return NextResponse.json({ config: updated, testSent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to save Telegram config" }, { status: 500 });
  }
}
