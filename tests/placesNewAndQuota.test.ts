import { describe, expect, it, beforeEach } from "vitest";
import { getDb, closeDb } from "../lib/db";
import { generateCacheKey, getCachedPlaces, setCachedPlaces } from "../lib/repositories/placesCache";
import { checkQuotaAvailable, recordApiUsage, getUsageSummary, getQuotaSettings } from "../lib/repositories/quotaAndUsage";
import { createSavedSearch, listSavedSearches, deleteSavedSearch } from "../lib/repositories/savedSearches";

describe("Google Places API (New) & Quota Control", () => {
  beforeEach(() => {
    process.env.DATABASE_PATH = ":memory:";
    closeDb();
    getDb();
  });

  it("caches search results for 30 days and returns cache hits", () => {
    const key = generateCacheKey("roofers", "Chicago, IL");
    expect(getCachedPlaces(key)).toBeNull();

    const samplePlaces = [{ id: "place_1", displayName: { text: "Apex Roofing" } }];
    setCachedPlaces(key, "roofers", "Chicago, IL", samplePlaces, 30);

    const cached = getCachedPlaces(key);
    expect(cached).not.toBeNull();
    expect(cached?.length).toBe(1);
    expect(cached?.[0].displayName.text).toBe("Apex Roofing");
  });

  it("enforces hard quota limits and logs estimated USD cost", () => {
    const session = "test_quota_session";
    const quotaBefore = checkQuotaAvailable(session, 1);
    expect(quotaBefore.allowed).toBe(true);

    // Record usage
    const log = recordApiUsage({ sessionId: session, requestsCount: 5, skuType: "Text Search (Pro)" });
    expect(log.estimatedCostUsd).toBe(0.16); // 5 * $0.032

    const summary = getUsageSummary(session);
    expect(summary.totalCalls).toBe(5);
    expect(summary.totalCostUsd).toBe(0.16);
    expect(summary.quota.currentDailyCount).toBe(5);
  });

  it("manages saved searches per session", () => {
    const session = "saved_search_session";
    const saved = createSavedSearch({
      sessionId: session,
      name: "Roofers & Plumbers in Chicago",
      categories: ["roofers", "plumbers"],
      location: "Chicago, IL",
      minRating: 4.0,
    });

    expect(saved.id).toBeDefined();
    const list = listSavedSearches(session);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("Roofers & Plumbers in Chicago");
    expect(list[0].categories).toEqual(["roofers", "plumbers"]);

    const deleted = deleteSavedSearch(saved.id, session);
    expect(deleted).toBe(true);
    expect(listSavedSearches(session).length).toBe(0);
  });
});
