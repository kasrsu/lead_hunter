import { getDb } from "../db";

export interface SavedSearch {
  id: string;
  sessionId: string;
  name: string;
  categories: string[];
  location: string;
  mapBounds?: Record<string, any>;
  minRating: number;
  minReviews: number;
  hasWebsite: "all" | "yes" | "no";
  createdAt: string;
}

export function listSavedSearches(sessionId = "sess_default"): SavedSearch[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM saved_searches WHERE session_id = ? ORDER BY created_at DESC`)
    .all(sessionId) as any[];

  return rows.map((r) => {
    let categories: string[] = [];
    let mapBounds: Record<string, any> = {};
    try {
      categories = JSON.parse(r.categories_json);
    } catch {
      categories = [r.categories_json];
    }
    try {
      mapBounds = JSON.parse(r.map_bounds_json || "{}");
    } catch {
      mapBounds = {};
    }

    return {
      id: r.id,
      sessionId: r.session_id,
      name: r.name,
      categories,
      location: r.location,
      mapBounds,
      minRating: r.min_rating,
      minReviews: r.min_reviews,
      hasWebsite: r.has_website || "all",
      createdAt: r.created_at,
    };
  });
}

export function createSavedSearch(search: {
  sessionId?: string;
  name?: string;
  categories: string[];
  location: string;
  mapBounds?: Record<string, any>;
  minRating?: number;
  minReviews?: number;
  hasWebsite?: "all" | "yes" | "no";
}): SavedSearch {
  const db = getDb();
  const sessionId = search.sessionId || "sess_default";
  const id = `srch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const name = search.name || `${search.categories.join(", ")} in ${search.location}`;
  const categoriesJson = JSON.stringify(search.categories);
  const mapBoundsJson = JSON.stringify(search.mapBounds || {});
  const minRating = search.minRating ?? 0;
  const minReviews = search.minReviews ?? 0;
  const hasWebsite = search.hasWebsite || "all";
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO saved_searches (id, session_id, name, categories_json, location, map_bounds_json, min_rating, min_reviews, has_website, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, name, categoriesJson, search.location, mapBoundsJson, minRating, minReviews, hasWebsite, createdAt);

  return {
    id,
    sessionId,
    name,
    categories: search.categories,
    location: search.location,
    mapBounds: search.mapBounds,
    minRating,
    minReviews,
    hasWebsite,
    createdAt,
  };
}

export function deleteSavedSearch(id: string, sessionId = "sess_default"): boolean {
  const db = getDb();
  const info = db.prepare(`DELETE FROM saved_searches WHERE id = ? AND session_id = ?`).run(id, sessionId);
  return info.changes > 0;
}
