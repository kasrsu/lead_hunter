import type { Lead } from "./types";

/**
 * Google Places API wrapper.
 *
 * Deliberately uses the official Places API rather than scraping Google Maps.
 * Scraping the Maps UI directly violates Google's Terms of Service and gets
 * IPs/accounts banned — a real liability if you're reselling this. The
 * Places API is the sanctioned, stable path and is what production lead-gen
 * tools run on.
 *
 * Note on data reuse: Google's ToS restricts long-term caching/redistribution
 * of Places data as a standalone dataset. This tool runs live queries against
 * the caller's own API key rather than storing and reselling a scraped
 * database — keep it that way when you package this for other users.
 */

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

const DETAIL_FIELDS = [
  "name",
  "formatted_address",
  "formatted_phone_number",
  "international_phone_number",
  "website",
  "rating",
  "user_ratings_total",
  "url",
  "business_status",
  "type",
].join(",");

interface PlacesSearchOptions {
  keyword: string;
  location: string;
  apiKey: string;
  minRating?: number;
  minReviews?: number;
  maxResults?: number;
}

async function textSearchPage(query: string, apiKey: string, pageToken?: string) {
  const params = new URLSearchParams({ key: apiKey });
  if (pageToken) {
    params.set("pagetoken", pageToken);
  } else {
    params.set("query", query);
  }
  const res = await fetch(`${TEXT_SEARCH_URL}?${params.toString()}`);
  return res.json();
}

async function getDetails(placeId: string, apiKey: string) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: DETAIL_FIELDS,
    key: apiKey,
  });
  const res = await fetch(`${DETAILS_URL}?${params.toString()}`);
  const data = await res.json();
  if (data.status !== "OK") return null;
  return data.result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Search for businesses matching keyword+location that have NO listed
 * website, ranked by rating x reviews descending (most credible, most
 * reviewed businesses with no site = strongest leads to pitch first).
 */
export async function huntLeads({
  keyword,
  location,
  apiKey,
  minRating = 0,
  minReviews = 0,
  maxResults = 60,
}: PlacesSearchOptions): Promise<Lead[]> {
  const query = `${keyword} in ${location}`;
  const seen = new Set<string>();
  const leads: Lead[] = [];

  let pageToken: string | undefined = undefined;
  let page = 0;

  while (page < 3) {
    if (pageToken) await sleep(2000); // next_page_token needs a short delay before it's valid

    const data = await textSearchPage(query, apiKey, pageToken);
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Places API error: ${data.status} - ${data.error_message ?? ""}`);
    }

    const results = data.results ?? [];
    for (const result of results) {
      const placeId = result.place_id;
      if (!placeId || seen.has(placeId)) continue;
      seen.add(placeId);

      const details = await getDetails(placeId, apiKey);
      if (!details) continue;
      if (details.business_status && details.business_status !== "OPERATIONAL") continue;

      const rating = details.rating ?? 0;
      const reviews = details.user_ratings_total ?? 0;
      const hasWebsite = Boolean(details.website);

      if (hasWebsite) continue;
      if (rating < minRating || reviews < minReviews) continue;

      leads.push({
        placeId,
        name: details.name ?? "",
        address: details.formatted_address ?? "",
        phone: details.formatted_phone_number ?? details.international_phone_number ?? "",
        rating,
        reviews,
        mapsUrl: details.url ?? "",
        category: (details.types ?? [])[0] ?? keyword,
      });

      if (leads.length >= maxResults) break;
    }

    pageToken = data.next_page_token;
    page += 1;
    if (!pageToken || leads.length >= maxResults) break;
  }

  return leads.sort((a, b) => b.rating * (b.reviews || 1) - a.rating * (a.reviews || 1));
}
