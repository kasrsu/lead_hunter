import { getDb } from "../db";

export interface TelegramBotConfig {
  sessionId: string;
  botToken: string;
  chatId: string;
  enabled: boolean;
  autoSendOnReady: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getTelegramBotConfig(sessionId = "sess_default"): TelegramBotConfig {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM telegram_bot_configs WHERE session_id = ?`)
    .get(sessionId) as any;

  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO telegram_bot_configs (session_id, bot_token, chat_id, enabled, auto_send_on_ready, created_at, updated_at)
       VALUES (?, '', '', 0, 0, ?, ?)`
    ).run(sessionId, now, now);

    return {
      sessionId,
      botToken: "",
      chatId: "",
      enabled: false,
      autoSendOnReady: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    sessionId: row.session_id,
    botToken: row.bot_token,
    chatId: row.chat_id,
    enabled: Boolean(row.enabled),
    autoSendOnReady: Boolean(row.auto_send_on_ready),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function updateTelegramBotConfig(
  sessionId = "sess_default",
  updates: {
    botToken?: string;
    chatId?: string;
    enabled?: boolean;
    autoSendOnReady?: boolean;
  }
): TelegramBotConfig {
  const db = getDb();
  const current = getTelegramBotConfig(sessionId);
  const now = new Date().toISOString();

  const botToken = updates.botToken !== undefined ? updates.botToken : current.botToken;
  const chatId = updates.chatId !== undefined ? updates.chatId : current.chatId;
  const enabled = updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : (current.enabled ? 1 : 0);
  const autoSendOnReady = updates.autoSendOnReady !== undefined ? (updates.autoSendOnReady ? 1 : 0) : (current.autoSendOnReady ? 1 : 0);

  db.prepare(
    `INSERT INTO telegram_bot_configs (session_id, bot_token, chat_id, enabled, auto_send_on_ready, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       bot_token = excluded.bot_token,
       chat_id = excluded.chat_id,
       enabled = excluded.enabled,
       auto_send_on_ready = excluded.auto_send_on_ready,
       updated_at = excluded.updated_at`
  ).run(sessionId, botToken, chatId, enabled, autoSendOnReady, now, now);

  return {
    sessionId,
    botToken,
    chatId,
    enabled: Boolean(enabled),
    autoSendOnReady: Boolean(autoSendOnReady),
    createdAt: current.createdAt,
    updatedAt: now,
  };
}
