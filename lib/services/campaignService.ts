import { huntLeads } from "@/lib/places";
import { getCampaignWithStats, insertCampaign } from "@/lib/repositories/campaigns";
import { insertLeads } from "@/lib/repositories/leads";
import type { CampaignWithStats, PersistedLead } from "@/lib/types";

/**
 * Campaign orchestration (Services layer). The only place that knows a scan
 * is "hunt Places for businesses without a website, then persist them as a
 * new campaign". API routes stay thin and call this.
 */

export interface CreateCampaignInput {
  keyword: string;
  location: string;
  apiKey: string;
  minRating?: number;
  minReviews?: number;
  name?: string;
}

export async function createCampaignFromSearch(
  input: CreateCampaignInput
): Promise<{ campaign: CampaignWithStats; leads: PersistedLead[] }> {
  const leads = await huntLeads({
    keyword: input.keyword,
    location: input.location,
    apiKey: input.apiKey,
    minRating: input.minRating ?? 0,
    minReviews: input.minReviews ?? 0,
  });

  const campaign = insertCampaign({
    name: input.name ?? `${input.keyword} in ${input.location}`,
    keyword: input.keyword,
    location: input.location,
    minRating: input.minRating ?? 0,
    minReviews: input.minReviews ?? 0,
  });

  const persisted = insertLeads(campaign.id, leads);
  const stats = getCampaignWithStats(campaign.id);
  if (!stats) throw new Error("Campaign was created but could not be re-read");
  return { campaign: stats, leads: persisted };
}
