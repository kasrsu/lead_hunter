import type { Lead } from "./types";
import { generateCacheKey, getCachedPlaces, setCachedPlaces } from "./repositories/placesCache";
import { checkQuotaAvailable, recordApiUsage } from "./repositories/quotaAndUsage";

const PLACES_NEW_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Strict field mask for single-stage Text Search (Pro SKU)
const PRO_SKU_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.primaryType",
  "places.types",
].join(",");

export interface PlacesNewSearchOptions {
  categories: string[]; // e.g. ["roofers", "plumbers"] or official type IDs
  includedTypes?: string[]; // Official Google Places type IDs
  location: string;
  apiKey: string;
  sessionId?: string;
  minRating?: number;
  minReviews?: number;
  hasWebsite?: "all" | "yes" | "no";
  maxResults?: number;
  mapBounds?: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Searches for businesses using official Google Places API (New) Text Search (`/v1/places:searchText`).
 * Strictly field masked to minimize SKU billing, with 30-day SQLite caching & hard quota rate limiting.
 */
export async function searchPlacesNew(options: PlacesNewSearchOptions): Promise<{
  leads: Lead[];
  isCacheHit: boolean;
  estimatedCostUsd: number;
  totalRequests: number;
}> {
  const {
    categories,
    includedTypes = [],
    location,
    apiKey,
    sessionId = "sess_default",
    minRating = 0,
    minReviews = 0,
    hasWebsite = "all",
    maxResults = 60,
    mapBounds,
  } = options;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Google Places API Key is required.");
  }

  const primaryCategory = categories[0] || includedTypes[0] || "business";
  const categoriesLabel = categories.length > 0 ? categories.join(", ") : includedTypes.join(", ");
  
  // Generate 30-day cache key
  const cacheKey = generateCacheKey(categoriesLabel, location, mapBounds);
  const cachedData = getCachedPlaces(cacheKey);

  if (cachedData) {
    // Filter cached items according to current search criteria
    const filteredLeads = filterLeads(cachedData, categories, minRating, minReviews, hasWebsite);
    return {
      leads: filteredLeads.slice(0, maxResults),
      isCacheHit: true,
      estimatedCostUsd: 0,
      totalRequests: 0,
    };
  }

  // Check quota limit before dispatching HTTP calls
  const quotaStatus = checkQuotaAvailable(sessionId, 1);
  if (!quotaStatus.allowed) {
    throw new Error(`QUOTA EXCEEDED: ${quotaStatus.reason}`);
  }

  const leadsMap = new Map<string, Lead>();
  let totalApiRequests = 0;

  // Run search per category/type input
  const queriesToRun = categories.length > 0 ? categories : [primaryCategory];

  for (const cat of queriesToRun) {
    if (leadsMap.size >= maxResults) break;

    const queryText = `${cat} in ${location}`;
    const requestBody: Record<string, any> = {
      textQuery: queryText,
      maxResultCount: 20,
    };

    if (includedTypes.length > 0 && includedTypes[0]) {
      requestBody.includedType = includedTypes[0];
    }

    if (mapBounds?.lat && mapBounds?.lng && mapBounds?.radiusMeters) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: mapBounds.lat, longitude: mapBounds.lng },
          radius: mapBounds.radiusMeters,
        },
      };
    }

    // Rate-limiting throttle
    if (totalApiRequests > 0) {
      await sleep(150);
    }

    const res = await fetch(PLACES_NEW_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PRO_SKU_FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    });

    totalApiRequests += 1;

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Places API (New) HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const places = data.places ?? [];

    for (const place of places) {
      const placeId = place.id;
      if (!placeId || leadsMap.has(placeId)) continue;

      const name = place.displayName?.text ?? "";
      const address = place.formattedAddress ?? "";
      const phone = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? "";
      const website = place.websiteUri ?? "";
      const rating = place.rating ?? 0;
      const reviews = place.userRatingCount ?? 0;
      const mapsUrl = place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`;
      const placeCategory = place.primaryType ?? (place.types ?? [])[0] ?? cat;

      const lead: Lead = {
        placeId,
        name,
        address,
        phone,
        rating,
        reviews,
        mapsUrl,
        category: placeCategory,
        website,
        hasWebsite: Boolean(website),
        source: "google-maps",
      };

      leadsMap.set(placeId, lead);
    }
  }

  // Record API usage & cost log in SQLite
  const { estimatedCostUsd } = recordApiUsage({
    sessionId,
    endpoint: "v1/places:searchText",
    requestsCount: totalApiRequests,
    skuType: "Text Search (Pro)",
    fieldMask: PRO_SKU_FIELD_MASK,
  });

  const rawLeadsArray = Array.from(leadsMap.values());

  // Store complete response in 30-day cache
  setCachedPlaces(cacheKey, categoriesLabel, location, rawLeadsArray, 30);

  // Apply filters
  const filteredLeads = filterLeads(rawLeadsArray, categories, minRating, minReviews, hasWebsite);

  return {
    leads: filteredLeads.slice(0, maxResults),
    isCacheHit: false,
    estimatedCostUsd,
    totalRequests: totalApiRequests,
  };
}

const INDUSTRY_CLUSTERS: Record<string, string[]> = {
  marketing: [
    "marketing", "advertising", "ad", "pr", "public relations", "media", "branding", "seo", "digital agency"
  ],
  software: [
    "software", "saas", "tech", "technology", "it service", "computer consultant", "web dev", "app dev", "developer", "programming"
  ],
  hospitality: [
    "restaurant", "restaurants", "bistro", "brasserie", "cafe", "cafes", "diner", "eatery", "steakhouse", "pizzeria", "pizza",
    "pub", "bar", "bakery", "catering", "dining", "food", "kitchen", "grill", "lounge", "tavern", "gastropub", "sushi",
    "ramen", "burger", "taco", "indian", "chinese", "italian", "french", "mexican", "thai", "japanese", "vietnamese"
  ],
  trade_services: [
    "plumbing", "plumber", "hvac", "heating", "air conditioning", "cooling", "roofing", "roofer", "electrician", "electrical", "contractor", "repair", "solar", "pest control", "landscaping"
  ],
  professional_services: [
    "lawyer", "attorney", "law firm", "legal", "dentist", "dental", "doctor", "clinic", "hospital", "cpa", "accounting", "tax service", "real estate", "realtor", "property management"
  ]
};

export function isCategoryCompatible(scrapedCategory: string, requestedCategories: string[]): boolean {
  if (!scrapedCategory || !requestedCategories || requestedCategories.length === 0) return true;

  const catLower = scrapedCategory.toLowerCase().replace(/_/g, " ").trim();
  const reqStr = requestedCategories.join(" ").toLowerCase();

  let targetCluster: string | null = null;
  for (const [clusterName, keywords] of Object.entries(INDUSTRY_CLUSTERS)) {
    if (keywords.some((kw) => reqStr.includes(kw))) {
      targetCluster = clusterName;
      break;
    }
  }

  if (!targetCluster) return true;

  const targetKeywords = INDUSTRY_CLUSTERS[targetCluster];
  if (targetKeywords.some((kw) => catLower.includes(kw))) {
    return true;
  }

  for (const [otherCluster, keywords] of Object.entries(INDUSTRY_CLUSTERS)) {
    if (otherCluster !== targetCluster) {
      if (keywords.some((kw) => catLower.includes(kw))) {
        return false;
      }
    }
  }

  return true;
}

function filterLeads(
  leads: Lead[],
  categories: string[],
  minRating: number,
  minReviews: number,
  hasWebsite: "all" | "yes" | "no",
  targetSegment?: "all" | "underdog"
): Lead[] {
  return leads.filter((lead) => {
    if (lead.rating < minRating) return false;
    if (lead.reviews < minReviews) return false;
    if (hasWebsite === "yes" && !lead.website) return false;
    if (hasWebsite === "no" && lead.website) return false;

    // Niche Mismatch Verification
    if (!isCategoryCompatible(lead.category, categories)) return false;

    return true;
  });
}
