import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { Campaign, CampaignWithStats, PipelineStage } from "@/lib/types";

/**
 * Campaign data access (Repositories layer). Campaign rows carry no aggregate
 * numbers — those are computed here via a small GROUP BY and joined in JS.
 */

interface CampaignRow {
  id: string;
  name: string;
  keyword: string;
  location: string;
  min_rating: number;
  min_reviews: number;
  status: Campaign["status"];
  created_at: string;
}

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    keyword: row.keyword,
    location: row.location,
    minRating: row.min_rating,
    minReviews: row.min_reviews,
    status: row.status,
    createdAt: row.created_at,
  };
}

const COLUMNS = "id, name, keyword, location, min_rating, min_reviews, status, created_at";

export interface NewCampaign {
  name: string;
  keyword: string;
  location: string;
  minRating: number;
  minReviews: number;
}

export function insertCampaign(data: NewCampaign): Campaign {
  const row: CampaignRow = {
    id: randomUUID(),
    name: data.name,
    keyword: data.keyword,
    location: data.location,
    min_rating: data.minRating,
    min_reviews: data.minReviews,
    status: "active",
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `INSERT INTO campaigns (${COLUMNS}) VALUES (@id, @name, @keyword, @location,
       @min_rating, @min_reviews, @status, @created_at)`
    )
    .run(row);
  return rowToCampaign(row);
}

export function getCampaign(id: string): Campaign | null {
  const row = getDb().prepare(`SELECT ${COLUMNS} FROM campaigns WHERE id = ?`).get(id) as
    | CampaignRow
    | undefined;
  return row ? rowToCampaign(row) : null;
}

export function setCampaignStatus(id: string, status: Campaign["status"]): Campaign {
  getDb()
    .prepare(`UPDATE campaigns SET status = ? WHERE id = ?`)
    .run(status, id);
  const updated = getCampaign(id);
  if (!updated) throw new Error(`Campaign ${id} not found after update`);
  return updated;
}

export function renameCampaign(id: string, name: string): Campaign {
  getDb().prepare(`UPDATE campaigns SET name = ? WHERE id = ?`).run(name, id);
  const updated = getCampaign(id);
  if (!updated) throw new Error(`Campaign ${id} not found after update`);
  return updated;
}

/**
 * All campaigns (newest first) with per-campaign lead count, stage counts and
 * average score — one query for the campaign rows, one GROUP BY for leads.
 */
export function listCampaignsWithStats(): CampaignWithStats[] {
  const db = getDb();
  const campaigns = (db.prepare(`SELECT ${COLUMNS} FROM campaigns ORDER BY created_at DESC`).all() ??
    []) as CampaignRow[];

  // Per-campaign stage counts (for the funnel) and per-campaign average score.
  const stageRows = db
    .prepare(`SELECT campaign_id, pipeline_stage, COUNT(*) AS n
              FROM leads GROUP BY campaign_id, pipeline_stage`)
    .all() as { campaign_id: string; pipeline_stage: PipelineStage; n: number }[];

  const avgRows = db
    .prepare(`SELECT campaign_id, AVG(lead_score) AS avg
              FROM leads WHERE lead_score IS NOT NULL GROUP BY campaign_id`)
    .all() as { campaign_id: string; avg: number }[];

  const stagesByCampaign = new Map<string, Map<PipelineStage, number>>();
  for (const row of stageRows) {
    let stages = stagesByCampaign.get(row.campaign_id);
    if (!stages) {
      stages = new Map();
      stagesByCampaign.set(row.campaign_id, stages);
    }
    stages.set(row.pipeline_stage, row.n);
  }
  const avgByCampaign = new Map(avgRows.map((r) => [r.campaign_id, Math.round(r.avg)]));

  return campaigns.map((row) => {
    const campaign = rowToCampaign(row);
    const stages: Record<PipelineStage, number> = {
      new: 0,
      drafting: 0,
      ready: 0,
      sent: 0,
      won: 0,
      archived: 0,
    };
    const stageMap = stagesByCampaign.get(row.id);
    if (stageMap) {
      for (const [stage, n] of stageMap) stages[stage] = n;
    }
    const leadCount = Object.values(stages).reduce((a, b) => a + b, 0);
    return { ...campaign, leadCount, stageCounts: stages, avgScore: avgByCampaign.get(row.id) ?? null };
  });
}

export function getCampaignWithStats(id: string): CampaignWithStats | null {
  return listCampaignsWithStats().find((c) => c.id === id) ?? null;
}
