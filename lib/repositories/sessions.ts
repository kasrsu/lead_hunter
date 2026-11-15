import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export interface UserSession {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string;
}

interface UserSessionRow {
  id: string;
  name: string;
  description: string;
  is_active: number;
  created_at: string;
  last_active_at: string;
}

function rowToSession(row: UserSessionRow): UserSession {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

const SESSION_COLUMNS = "id, name, description, is_active, created_at, last_active_at";

function ensureUserSessionsTable(db: ReturnType<typeof getDb>) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        description    TEXT NOT NULL DEFAULT '',
        is_active      INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        last_active_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      INSERT OR IGNORE INTO user_sessions (id, name, description, is_active)
      VALUES ('sess_default', 'Main Workspace', 'Default master session workspace', 1);
    `);
  } catch {
    // best effort
  }
}

export function listUserSessions(): UserSession[] {
  const db = getDb();
  ensureUserSessionsTable(db);
  const rows = db
    .prepare(`SELECT ${SESSION_COLUMNS} FROM user_sessions ORDER BY last_active_at DESC`)
    .all() as UserSessionRow[];

  return rows.map(rowToSession);
}

export function getUserSession(id: string): UserSession | null {
  const db = getDb();
  ensureUserSessionsTable(db);
  const row = db
    .prepare(`SELECT ${SESSION_COLUMNS} FROM user_sessions WHERE id = ?`)
    .get(id) as UserSessionRow | undefined;

  return row ? rowToSession(row) : null;
}

export function getOrCreateUserSession(id: string, name?: string): UserSession {
  const db = getDb();
  const existing = getUserSession(id);
  if (existing) {
    db.prepare(`UPDATE user_sessions SET last_active_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?`).run(id);
    return { ...existing, lastActiveAt: new Date().toISOString() };
  }

  const newSessionName = name || (id === "sess_default" ? "Main Workspace" : `Session ${id.slice(0, 8)}`);
  const row: UserSessionRow = {
    id,
    name: newSessionName,
    description: "Isolated workspace session",
    is_active: 1,
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO user_sessions (${SESSION_COLUMNS}) VALUES (@id, @name, @description, @is_active, @created_at, @last_active_at)`
  ).run(row);

  return rowToSession(row);
}

export function createUserSession(name: string, description = ""): UserSession {
  const id = `sess_${randomUUID().slice(0, 8)}`;
  const row: UserSessionRow = {
    id,
    name,
    description,
    is_active: 0,
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };

  getDb()
    .prepare(
      `INSERT INTO user_sessions (${SESSION_COLUMNS}) VALUES (@id, @name, @description, @is_active, @created_at, @last_active_at)`
    )
    .run(row);

  return rowToSession(row);
}

export function setActiveUserSession(id: string): UserSession {
  const db = getDb();
  const session = getUserSession(id) || getOrCreateUserSession(id);

  db.prepare(`UPDATE user_sessions SET is_active = 0`).run();
  db.prepare(`UPDATE user_sessions SET is_active = 1, last_active_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?`).run(id);

  return { ...session, isActive: true, lastActiveAt: new Date().toISOString() };
}

export function deleteUserSession(id: string): boolean {
  if (id === "sess_default") {
    // Default session cannot be deleted
    return false;
  }
  const db = getDb();
  const res = db.prepare(`DELETE FROM user_sessions WHERE id = ?`).run(id);
  // Also clean up campaigns belonging to this session
  db.prepare(`DELETE FROM campaigns WHERE session_id = ?`).run(id);
  return res.changes > 0;
}
