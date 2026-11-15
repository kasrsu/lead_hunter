import { NextRequest, NextResponse } from "next/server";
import { getTelegramBotConfig, updateTelegramBotConfig } from "@/lib/repositories/telegramConfig";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.headers.get("x-session-id") ?? "sess_default";
    const config = getTelegramBotConfig(sessionId);
    return NextResponse.json({ config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch Telegram config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { botToken, chatId, enabled, autoSendOnReady } = body ?? {};
    const sessionId = req.headers.get("x-session-id") ?? "sess_default";

    const updated = updateTelegramBotConfig(sessionId, {
      botToken,
      chatId,
      enabled,
      autoSendOnReady,
    });

    return NextResponse.json({ config: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update Telegram config" }, { status: 500 });
  }
}
