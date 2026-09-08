import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { computeLeadMetrics } from "@/lib/services/scoringEngine";
import type { Lead, PersistedLead, PipelineStage, PriorityTier } from "@/lib/types";

/**
 * Lead data access (Repositories layer). Every function speaks snake_case to
 * SQLite and returns camelCase PersistedLead objects to the rest of the app.
 */

interface LeadRow {
  id: string;
  campaign_id: string;
  place_id: string;
  name: string;
  address: string;
  phone: string;
  rating: number;
  reviews: number;
  maps_url: string;
  category: string;
  website: string;
  has_website: number;
  price_range: string;
  review_snippet: string;
  features: string;
  instagram: string;
  facebook: string;
  hours_label: string;
  image_url: string;
  source: string;
  contact_email: string;
  pipeline_stage: PipelineStage;
  lead_score: number | null;
  opportunity_score: number | null;
  reachability_score: number | null;
  completeness_score: number | null;
  engagement_score: number | null;
  priority_tier: PriorityTier | null;
  classification: string | null;
  channel: string | null;
  whatsapp_status: string | null;
  template_type: string | null;
  rubric_scores: string | null;
  rubric_justification: string | null;
  reasoning_summary: string | null;
  research_brief: string | null;
  email_subject: string | null;
  email_body: string | null;
  review_notes: string | null;
  iterations: number | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToLead(row: LeadRow): PersistedLead {
  let parsedFeatures: string[] = [];
  try {
    if (row.features) parsedFeatures = JSON.parse(row.features);
  } catch {
    parsedFeatures = [];
  }

  return {
    id: row.id,
    campaignId: row.campaign_id,
    placeId: row.place_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    rating: row.rating,
    reviews: row.reviews,
    mapsUrl: row.maps_url,
    category: row.category,
    website: row.website,
    hasWebsite: Boolean(row.has_website),
    priceRange: row.price_range,
    reviewSnippet: row.review_snippet,
    features: parsedFeatures,
    instagram: row.instagram,
    facebook: row.facebook,
    hoursLabel: row.hours_label,
    imageUrl: row.image_url,
    source: (row.source as any) || "google-maps",
    contactEmail: row.contact_email,
    pipelineStage: row.pipeline_stage,
    leadScore: row.lead_score,
    opportunityScore: row.opportunity_score,
    reachabilityScore: row.reachability_score,
    completenessScore: row.completeness_score,
    engagementScore: row.engagement_score,
    priorityTier: row.priority_tier,
    classification: row.classification,
    channel: row.channel,
    whatsappStatus: row.whatsapp_status || "unverified",
    templateType: row.template_type,
    rubricScores: row.rubric_scores ? JSON.parse(row.rubric_scores) : null,
    rubricJustification: row.rubric_justification
      ? JSON.parse(row.rubric_justification)
      : null,
    reasoningSummary: row.reasoning_summary,
    researchBrief: row.research_brief,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
    reviewNotes: row.review_notes,
    iterations: row.iterations,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LEAD_COLUMNS = `
  id, campaign_id, place_id, name, address, phone, rating, reviews, maps_url,
  category, website, has_website, price_range, review_snippet, features,
  instagram, facebook, hours_label, image_url, source, contact_email,
  pipeline_stage, lead_score, opportunity_score, reachability_score,
  completeness_score, engagement_score, priority_tier, classification, channel, whatsapp_status,
  template_type, rubric_scores, rubric_justification, reasoning_summary,
  research_brief, email_subject, email_body, review_notes, iterations, sent_at,
  created_at, updated_at
`;

/** Batch-insert search or imported leads; returns the persisted leads. */
export function insertLeads(campaignId: string, leads: Partial<Lead>[]): PersistedLead[] {
  const db = getDb();
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO leads (
      id, campaign_id, place_id, name, address, phone, rating, reviews, maps_url,
      category, website, has_website, price_range, review_snippet, features,
      instagram, facebook, hours_label, image_url, source, contact_email,
      pipeline_stage, lead_score, opportunity_score, reachability_score,
      completeness_score, engagement_score, priority_tier, classification, channel, whatsapp_status,
      template_type, rubric_scores, rubric_justification, reasoning_summary,
      research_brief, email_subject, email_body, review_notes, iterations, sent_at,
      created_at, updated_at
    ) VALUES (
      @id, @campaign_id, @place_id, @name, @address, @phone, @rating, @reviews, @maps_url,
      @category, @website, @has_website, @price_range, @review_snippet, @features,
      @instagram, @facebook, @hours_label, @image_url, @source, @contact_email,
      @pipeline_stage, @lead_score, @opportunity_score, @reachability_score,
      @completeness_score, @engagement_score, @priority_tier, @classification, @channel, @whatsapp_status,
      @template_type, @rubric_scores, @rubric_justification, @reasoning_summary,
      @research_brief, @email_subject, @email_body, @review_notes, @iterations, @sent_at,
      @created_at, @updated_at
    )
  `);

  const rowsToInsert: LeadRow[] = [];

  for (const lead of leads) {
    const metrics = computeLeadMetrics(lead);
    const placeId = lead.placeId || `imp_${randomUUID().slice(0, 8)}`;
    const website = lead.website || "";
    const hasWebsite = lead.hasWebsite !== undefined ? (lead.hasWebsite ? 1 : 0) : website ? 1 : 0;

    rowsToInsert.push({
      id: randomUUID(),
      campaign_id: campaignId,
      place_id: placeId,
      name: lead.name || "Unnamed Business",
      address: lead.address || "",
      phone: lead.phone || "",
      rating: lead.rating ?? 0,
      reviews: lead.reviews ?? 0,
      maps_url: lead.mapsUrl || "",
      category: lead.category || "General",
      website,
      has_website: hasWebsite,
      price_range: lead.priceRange || "",
      review_snippet: lead.reviewSnippet || "",
      features: JSON.stringify(lead.features || []),
      instagram: lead.instagram || "",
      facebook: lead.facebook || "",
      hours_label: lead.hoursLabel || "",
      image_url: lead.imageUrl || "",
      source: lead.source || "google-maps",
      contact_email: (lead as any).contactEmail || (lead as any).email || "",
      pipeline_stage: (lead as any).pipelineStage || "new",
      lead_score: (lead as any).leadScore ?? metrics.leadScore,
      opportunity_score: (lead as any).opportunityScore ?? metrics.opportunityScore,
      reachability_score: (lead as any).reachabilityScore ?? metrics.reachabilityScore,
      completeness_score: (lead as any).completenessScore ?? metrics.completenessScore,
      engagement_score: (lead as any).engagementScore ?? metrics.engagementScore,
      priority_tier: (lead as any).priorityTier ?? metrics.priorityTier,
      classification: (lead as any).classification || null,
      channel: (lead as any).channel || null,
      whatsapp_status: (lead as any).whatsappStatus || "unverified",
      template_type: (lead as any).templateType || null,
      rubric_scores: (lead as any).rubricScores ? JSON.stringify((lead as any).rubricScores) : null,
      rubric_justification: (lead as any).rubricJustification ? JSON.stringify((lead as any).rubricJustification) : null,
      reasoning_summary: (lead as any).reasoningSummary || null,
      research_brief: (lead as any).researchBrief || null,
      email_subject: (lead as any).emailSubject || null,
      email_body: (lead as any).emailBody || null,
      review_notes: (lead as any).reviewNotes || null,
      iterations: (lead as any).iterations ?? null,
      sent_at: (lead as any).sentAt || null,
      created_at: now,
      updated_at: now,
    });
  }

  db.transaction(() => {
    for (const row of rowsToInsert) {
      insertStmt.run(row);
    }
  })();

  return rowsToInsert.map(rowToLead);
}

export function getLead(id: string): PersistedLead | null {
  const row = getDb().prepare(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = ?`).get(id) as
    | LeadRow
    | undefined;
  return row ? rowToLead(row) : null;
}

export function listLeadsByCampaign(campaignId: string): PersistedLead[] {
  const rows = getDb()
    .prepare(`SELECT ${LEAD_COLUMNS} FROM leads WHERE campaign_id = ? ORDER BY created_at DESC`)
    .all(campaignId) as LeadRow[];
  return rows.map(rowToLead);
}

export function listAllLeads(): PersistedLead[] {
  const rows = getDb()
    .prepare(`SELECT ${LEAD_COLUMNS} FROM leads ORDER BY created_at DESC`)
    .all() as LeadRow[];
  return rows.map(rowToLead);
}

export function updateLead(
  id: string,
  patch: Partial<PersistedLead>
): PersistedLead {
  if (!getLead(id)) throw new Error(`Lead ${id} not found`);
  const columnMap: Record<string, string> = {
    contactEmail: "contact_email",
    pipelineStage: "pipeline_stage",
    leadScore: "lead_score",
    opportunityScore: "opportunity_score",
    reachabilityScore: "reachability_score",
    completenessScore: "completeness_score",
    engagementScore: "engagement_score",
    priorityTier: "priority_tier",
    classification: "classification",
    channel: "channel",
    whatsappStatus: "whatsapp_status",
    templateType: "template_type",
    rubricScores: "rubric_scores",
    rubricJustification: "rubric_justification",
    reasoningSummary: "reasoning_summary",
    researchBrief: "research_brief",
    emailSubject: "email_subject",
    emailBody: "email_body",
    reviewNotes: "review_notes",
    iterations: "iterations",
    sentAt: "sent_at",
  };

  const assignments: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [key, column] of Object.entries(columnMap)) {
    if (!(key in patch) || patch[key as keyof PersistedLead] === undefined) continue;
    const value = patch[key as keyof PersistedLead];
    const serialized =
      key === "rubricScores" || key === "rubricJustification"
        ? JSON.stringify(value)
        : value;
    assignments.push(`${column} = @${key}`);
    params[key] = serialized;
  }
  if (assignments.length === 0) return getLead(id)!;

  assignments.push(`updated_at = @updated_at`);
  params.updated_at = new Date().toISOString();

  getDb()
    .prepare(`UPDATE leads SET ${assignments.join(", ")} WHERE id = @id`)
    .run(params);

  const updated = getLead(id);
  if (!updated) throw new Error(`Lead ${id} not found after update`);
  return updated;
}

export function updateLeadStage(id: string, stage: PipelineStage): PersistedLead {
  const patch: Partial<PersistedLead> = { pipelineStage: stage };
  if (stage === "sent") {
    patch.sentAt = new Date().toISOString();
  }
  return updateLead(id, patch);
}

export function deleteLead(id: string): void {
  getDb().prepare(`DELETE FROM leads WHERE id = ?`).run(id);
}

/** All leads, grouped by pipeline stage (used by the dashboard funnel). */
export function getStageCounts(): Record<PipelineStage, number> {
  const rows = getDb()
    .prepare(`SELECT pipeline_stage, COUNT(*) AS n FROM leads GROUP BY pipeline_stage`)
    .all() as { pipeline_stage: PipelineStage; n: number }[];
  const counts: Record<PipelineStage, number> = {
    new: 0,
    drafting: 0,
    ready: 0,
    sent: 0,
    won: 0,
    archived: 0,
  };
  for (const row of rows) counts[row.pipeline_stage] = row.n;
  return counts;
}

export function getPriorityTierCounts(): Record<PriorityTier, number> {
  const rows = getDb()
    .prepare(`SELECT priority_tier, COUNT(*) AS n FROM leads WHERE priority_tier IS NOT NULL GROUP BY priority_tier`)
    .all() as { priority_tier: PriorityTier; n: number }[];
  const counts: Record<PriorityTier, number> = {
    Hot: 0,
    Warm: 0,
    Cold: 0,
  };
  for (const row of rows) {
    if (row.priority_tier in counts) counts[row.priority_tier] = row.n;
  }
  return counts;
}

export function getClassificationBreakdown(): {
  classification: string;
  count: number;
}[] {
  return getDb()
    .prepare(
      `SELECT classification, COUNT(*) AS count
       FROM leads WHERE classification IS NOT NULL
       GROUP BY classification ORDER BY count DESC`
    )
    .all() as { classification: string; count: number }[];
}

export function getContactBreakdown(): {
  hasEmail: number;
  hasPhoneOnly: number;
  hasSocialsOnly: number;
  noDirectContact: number;
} {
  const db = getDb();
  const all = (db.prepare(`SELECT contact_email, phone, instagram, facebook FROM leads`).all() ?? []) as any[];
  let hasEmail = 0;
  let hasPhoneOnly = 0;
  let hasSocialsOnly = 0;
  let noDirectContact = 0;

  for (const r of all) {
    const email = Boolean(r.contact_email);
    const phone = Boolean(r.phone);
    const social = Boolean(r.instagram || r.facebook);

    if (email) {
      hasEmail++;
    } else if (phone) {
      hasPhoneOnly++;
    } else if (social) {
      hasSocialsOnly++;
    } else {
      noDirectContact++;
    }
  }
  return { hasEmail, hasPhoneOnly, hasSocialsOnly, noDirectContact };
}

export function getGlobalAvgScore(): number | null {
  const row = getDb()
    .prepare(`SELECT AVG(lead_score) AS avg FROM leads WHERE lead_score IS NOT NULL`)
    .get() as { avg: number | null };
  return row.avg != null ? Math.round(row.avg) : null;
}
