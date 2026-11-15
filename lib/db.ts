import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * SQLite storage layer (the bottom of API → Services → Repositories → Storage).
 *
 * Single process-wide connection, opened lazily on first use so tests can set
 * `DATABASE_PATH` (e.g. `:memory:`) before anything touches it. The DB file
 * lives at `<repo>/data/leadhunt.db` unless `DATABASE_PATH` says otherwise.
 *
 * Swapping to Postgres later means reimplementing the repositories in
 * lib/repositories/* against a pg client — nothing above that layer changes.
 */

let db: Database.Database | null = null;

export function getDbPath(): string {
  return (
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "leadhunt.db")
  );
}

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = getDbPath();
  if (dbPath !== ":memory:") {
    // better-sqlite3 won't create the directory itself — make sure it exists.
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

/** Close and drop the singleton — mainly for tests to start fresh. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function migrate(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      is_active      INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      last_active_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL DEFAULT 'sess_default',
      name        TEXT NOT NULL,
      keyword     TEXT NOT NULL,
      location    TEXT NOT NULL,
      min_rating  REAL NOT NULL DEFAULT 0,
      min_reviews INTEGER NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_session ON campaigns(session_id);

    CREATE TABLE IF NOT EXISTS leads (
      id                    TEXT PRIMARY KEY,
      campaign_id           TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      place_id              TEXT NOT NULL,
      name                  TEXT NOT NULL,
      address               TEXT NOT NULL DEFAULT '',
      phone                 TEXT NOT NULL DEFAULT '',
      rating                REAL NOT NULL DEFAULT 0,
      reviews               INTEGER NOT NULL DEFAULT 0,
      maps_url              TEXT NOT NULL DEFAULT '',
      category              TEXT NOT NULL DEFAULT '',
      website               TEXT NOT NULL DEFAULT '',
      has_website           INTEGER NOT NULL DEFAULT 0,
      price_range           TEXT NOT NULL DEFAULT '',
      review_snippet        TEXT NOT NULL DEFAULT '',
      features              TEXT NOT NULL DEFAULT '[]',
      instagram             TEXT NOT NULL DEFAULT '',
      facebook              TEXT NOT NULL DEFAULT '',
      hours_label           TEXT NOT NULL DEFAULT '',
      image_url             TEXT NOT NULL DEFAULT '',
      source                TEXT NOT NULL DEFAULT 'google-maps',
      contact_email         TEXT NOT NULL DEFAULT '',
      pipeline_stage        TEXT NOT NULL DEFAULT 'new',
      lead_score            INTEGER,
      opportunity_score     INTEGER,
      reachability_score    INTEGER,
      completeness_score    INTEGER,
      engagement_score      INTEGER,
      priority_tier         TEXT,
      classification        TEXT,
      channel               TEXT,
      whatsapp_status       TEXT DEFAULT 'unverified',
      template_type         TEXT,
      rubric_scores         TEXT,
      rubric_justification  TEXT,
      reasoning_summary     TEXT,
      research_brief        TEXT,
      email_subject         TEXT,
      email_body            TEXT,
      review_notes          TEXT,
      iterations            INTEGER,
      sent_at               TEXT,
      created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_leads_stage    ON leads(pipeline_stage);

    CREATE TABLE IF NOT EXISTS pending_approvals (
      id                  TEXT PRIMARY KEY,
      lead_id             TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      telegram_message_id INTEGER,
      telegram_chat_id    INTEGER NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
      created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      resolved_at         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pending_approvals_lead ON pending_approvals(lead_id);
    CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id          TEXT PRIMARY KEY,
      level       TEXT NOT NULL DEFAULT 'INFO',
      category    TEXT NOT NULL DEFAULT 'SYSTEM',
      message     TEXT NOT NULL,
      details     TEXT DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

    CREATE TABLE IF NOT EXISTS places_cache (
      id           TEXT PRIMARY KEY,
      cache_key    TEXT NOT NULL UNIQUE,
      category     TEXT NOT NULL,
      location     TEXT NOT NULL,
      raw_response TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      expires_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_places_cache_key ON places_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_places_cache_expires ON places_cache(expires_at);

    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id                 TEXT PRIMARY KEY,
      session_id         TEXT NOT NULL DEFAULT 'sess_default',
      endpoint           TEXT NOT NULL,
      requests_count     INTEGER NOT NULL DEFAULT 1,
      sku_type           TEXT NOT NULL DEFAULT 'Text Search (Pro)',
      estimated_cost_usd REAL NOT NULL DEFAULT 0.032,
      field_mask         TEXT NOT NULL DEFAULT '',
      created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_api_usage_session ON api_usage_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_logs(created_at);

    CREATE TABLE IF NOT EXISTS quota_settings (
      session_id            TEXT PRIMARY KEY,
      daily_limit           INTEGER NOT NULL DEFAULT 1000,
      monthly_limit         INTEGER NOT NULL DEFAULT 20000,
      current_daily_count   INTEGER NOT NULL DEFAULT 0,
      current_monthly_count INTEGER NOT NULL DEFAULT 0,
      last_reset_date       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d','now'))
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id               TEXT PRIMARY KEY,
      session_id       TEXT NOT NULL DEFAULT 'sess_default',
      name             TEXT NOT NULL,
      categories_json  TEXT NOT NULL,
      location         TEXT NOT NULL,
      map_bounds_json  TEXT DEFAULT '{}',
      min_rating       REAL NOT NULL DEFAULT 0,
      min_reviews      INTEGER NOT NULL DEFAULT 0,
      has_website      TEXT DEFAULT 'all',
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_saved_searches_session ON saved_searches(session_id);

    CREATE TABLE IF NOT EXISTS telegram_bot_configs (
      session_id                TEXT PRIMARY KEY,
      bot_token                 TEXT NOT NULL DEFAULT '',
      chat_id                   TEXT NOT NULL DEFAULT '',
      enabled                   INTEGER NOT NULL DEFAULT 0,
      auto_send_on_ready        INTEGER NOT NULL DEFAULT 0,
      created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // Ensure default session exists
  d.exec(`
    INSERT OR IGNORE INTO user_sessions (id, name, description, is_active)
    VALUES ('sess_default', 'Main Workspace', 'Default master session workspace', 1);
  `);

  // Ensure new columns exist for upgraded SQLite databases
  const existingLeadsCols = (d.pragma("table_info(leads)") as { name: string }[]).map((c) => c.name);
  const newLeadsCols: [string, string][] = [
    ["website", "TEXT NOT NULL DEFAULT ''"],
    ["has_website", "INTEGER NOT NULL DEFAULT 0"],
    ["price_range", "TEXT NOT NULL DEFAULT ''"],
    ["review_snippet", "TEXT NOT NULL DEFAULT ''"],
    ["features", "TEXT NOT NULL DEFAULT '[]'"],
    ["instagram", "TEXT NOT NULL DEFAULT ''"],
    ["facebook", "TEXT NOT NULL DEFAULT ''"],
    ["hours_label", "TEXT NOT NULL DEFAULT ''"],
    ["image_url", "TEXT NOT NULL DEFAULT ''"],
    ["source", "TEXT NOT NULL DEFAULT 'google-maps'"],
    ["opportunity_score", "INTEGER"],
    ["reachability_score", "INTEGER"],
    ["completeness_score", "INTEGER"],
    ["engagement_score", "INTEGER"],
    ["priority_tier", "TEXT"],
    ["whatsapp_status", "TEXT DEFAULT 'unverified'"],
    ["generated_opener", "TEXT NOT NULL DEFAULT ''"],
  ];

  for (const [col, def] of newLeadsCols) {
    if (!existingLeadsCols.includes(col)) {
      d.exec(`ALTER TABLE leads ADD COLUMN ${col} ${def}`);
    }
  }

  const existingCampaignCols = (d.pragma("table_info(campaigns)") as { name: string }[]).map((c) => c.name);
  if (!existingCampaignCols.includes("session_id")) {
    d.exec(`ALTER TABLE campaigns ADD COLUMN session_id TEXT NOT NULL DEFAULT 'sess_default'`);
    d.exec(`CREATE INDEX IF NOT EXISTS idx_campaigns_session ON campaigns(session_id)`);
  }

  d.exec(`CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(priority_tier);`);
}
