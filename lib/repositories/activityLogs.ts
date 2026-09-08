import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export interface ActivityLog {
  id: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  category: "AGENT" | "TELEGRAM" | "RESEND" | "CAMPAIGN" | "SYSTEM";
  message: string;
  details?: string;
  createdAt: string;
}

export function logActivity({
  level = "INFO",
  category = "SYSTEM",
  message,
  details = "",
}: {
  level?: ActivityLog["level"];
  category?: ActivityLog["category"];
  message: string;
  details?: string;
}): ActivityLog {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO activity_logs (id, level, category, message, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, level, category, message, details, createdAt);

  return { id, level, category, message, details, createdAt };
}

export function getRecentLogs(limit = 50): ActivityLog[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, level, category, message, details, created_at as createdAt
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as ActivityLog[];

  return rows;
}

export function clearLogs(): void {
  const db = getDb();
  db.prepare(`DELETE FROM activity_logs`).run();
}
