import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";

describe("SQLite storage", () => {
  afterAll(() => {
    closeDb();
    delete process.env.DATABASE_PATH;
  });

  it("creates the parent directory for a file-backed database", () => {
    // better-sqlite3 refuses to open a DB whose directory is missing — the
    // storage layer must create it (regression: data/ didn't exist on first run).
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "leadhunt-db-"));
    const dbPath = path.join(dir, "nested", "sub", "test.db");
    process.env.DATABASE_PATH = dbPath;

    closeDb();
    getDb();

    expect(fs.existsSync(dbPath)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("initialises the schema", () => {
    process.env.DATABASE_PATH = ":memory:";
    closeDb();
    const db = getDb();
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const tables = rows.map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(["campaigns", "leads"]));
  });
});
