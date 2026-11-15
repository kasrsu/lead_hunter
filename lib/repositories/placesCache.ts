import { getDb } from "../db";
import crypto from "node:crypto";

export interface PlacesCacheRecord {
  id: string;
  cacheKey: string;
  category: string;
  location: string;
  rawResponse: string;
  createdAt: string;
  expiresAt: string;
}

export function generateCacheKey(category: string, location: string, bounds?: Record<string, any>): string {
  const normCategory = category.trim().toLowerCase();
  const normLocation = location.trim().toLowerCase();
  const boundsStr = bounds ? JSON.stringify(bounds) : "";
  return crypto
    .createHash("sha256")
    .update(`${normCategory}:${normLocation}:${boundsStr}`)
    .digest("hex");
}

export function getCachedPlaces(cacheKey: string): any[] | null {
  const db = getDb();
  const now = new Date().toISOString();
  
  const row = db
    .prepare(
      `SELECT raw_response, expires_at FROM places_cache 
       WHERE cache_key = ? AND expires_at > ?`
    )
    .get(cacheKey, now) as { raw_response: string; expires_at: string } | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.raw_response);
  } catch {
    return null;
  }
}

export function setCachedPlaces(
  cacheKey: string,
  category: string,
  location: string,
  places: any[],
  ttlDays = 30
): void {
  const db = getDb();
  const id = `cache_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const createdAt = now.toISOString();
  const expiresAt = expires.toISOString();
  const rawResponse = JSON.stringify(places);

  db.prepare(
    `INSERT INTO places_cache (id, cache_key, category, location, raw_response, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       raw_response = excluded.raw_response,
       created_at = excluded.created_at,
       expires_at = excluded.expires_at`
  ).run(id, cacheKey, category, location, rawResponse, createdAt, expiresAt);
}

export function pruneExpiredCache(): number {
  const db = getDb();
  const now = new Date().toISOString();
  const info = db.prepare(`DELETE FROM places_cache WHERE expires_at <= ?`).run(now);
  return info.changes;
}

export function clearAllPlacesCache(): number {
  const db = getDb();
  const info = db.prepare(`DELETE FROM places_cache`).run();
  return info.changes;
}
