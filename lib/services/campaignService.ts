import { searchPlacesNew, type PlacesNewSearchOptions } from "@/lib/placesNew";
import { getCampaignWithStats, insertCampaign } from "@/lib/repositories/campaigns";
import { insertLeads } from "@/lib/repositories/leads";
import type { CampaignWithStats, PersistedLead } from "@/lib/types";

export interface CreateCampaignFromNewSearchInput {
  categories: string[];
  includedTypes?: string[];
  location: string;
  apiKey: string;
  minRating?: number;
  minReviews?: number;
  hasWebsite?: "all" | "yes" | "no";
  maxResults?: number;
  name?: string;
  sessionId?: string;
  mapBounds?: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
  };
}

export async function createCampaignFromSearch(
  input: CreateCampaignFromNewSearchInput
): Promise<{
  campaign: CampaignWithStats;
  leads: PersistedLead[];
  isCacheHit: boolean;
  estimatedCostUsd: number;
  totalRequests: number;
}> {
  const sessionId = input.sessionId || "sess_default";

  // Execute Places API (New) Search with 30-day SQLite cache & field masking
  const searchResult = await searchPlacesNew({
    categories: input.categories,
    includedTypes: input.includedTypes,
    location: input.location,
    apiKey: input.apiKey,
    sessionId,
    minRating: input.minRating ?? 0,
    minReviews: input.minReviews ?? 0,
    hasWebsite: input.hasWebsite ?? "all",
    maxResults: input.maxResults ?? 60,
    mapBounds: input.mapBounds,
  });

  const categoriesLabel = input.categories.join(", ");
  const campaignName = input.name ?? `${categoriesLabel || "Businesses"} in ${input.location}`;

  const campaign = insertCampaign({
    name: campaignName,
    keyword: categoriesLabel,
    location: input.location,
    minRating: input.minRating ?? 0,
    minReviews: input.minReviews ?? 0,
    sessionId,
  });

  const persisted = insertLeads(campaign.id, searchResult.leads);
  const stats = getCampaignWithStats(campaign.id);
  if (!stats) throw new Error("Campaign was created but could not be re-read");

  return {
    campaign: stats,
    leads: persisted,
    isCacheHit: searchResult.isCacheHit,
    estimatedCostUsd: searchResult.estimatedCostUsd,
    totalRequests: searchResult.totalRequests,
  };
}
