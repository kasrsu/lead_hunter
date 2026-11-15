import { listCampaignsWithStats } from "@/lib/repositories/campaigns";
import {
  getClassificationBreakdown,
  getContactBreakdown,
  getGlobalAvgScore,
  getPriorityTierCounts,
  getStageCounts,
} from "@/lib/repositories/leads";
import type { DashboardStats } from "@/lib/types";

/**
 * Dashboard roll-up (Services layer). Pure read aggregation — the dashboard
 * route just calls this and serializes it.
 */
export function getDashboardStats(sessionId?: string): DashboardStats {
  const campaigns = listCampaignsWithStats(sessionId);
  const stageCounts = getStageCounts();
  const tierCounts = getPriorityTierCounts();
  const contactBreakdown = getContactBreakdown();

  return {
    totalCampaigns: campaigns.length,
    totalLeads: campaigns.reduce((sum, c) => sum + c.leadCount, 0),
    avgScore: getGlobalAvgScore(),
    sentCount: stageCounts.sent,
    wonCount: stageCounts.won,
    readyCount: stageCounts.ready,
    tierCounts,
    contactBreakdown,
    funnel: stageCounts,
    classificationBreakdown: getClassificationBreakdown(),
    recentCampaigns: campaigns.slice(0, 10),
  };
}
