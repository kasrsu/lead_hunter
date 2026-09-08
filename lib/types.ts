/** A business found by the Places search that has no listed website. */
export type PriorityTier = "Hot" | "Warm" | "Cold";

/** A business found by search or imported via JSON. */
export interface Lead {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  rating: number;
  reviews: number;
  mapsUrl: string;
  category: string;
  website?: string;
  hasWebsite?: boolean;
  priceRange?: string;
  reviewSnippet?: string;
  features?: string[];
  instagram?: string;
  facebook?: string;
  hoursLabel?: string;
  imageUrl?: string;
  source?: "google-maps" | "json-import" | "archived-preset";
}

/** The person on whose behalf the agent writes outreach emails. */
export interface SenderProfile {
  senderName: string;
  senderCompany: string;
  offerDescription: string;
  senderEmail: string;
}

/**
 * A lead after the agent has drafted an email for it. Returned by the
 * Python agent service (research -> score -> draft -> critique -> revise)
 * and stored on the UI lead so the draft is editable before sending.
 */
export interface EnrichedLead extends Lead {
  researchBrief: string;
  /** Deterministic 0-100 rubric score (agent-service/app/scoring.py). */
  leadScore: number;
  classification: string;
  channel: string;
  whatsappStatus?: string;
  templateType: string;
  rubricScores: Record<string, number>;
  rubricJustification: Record<string, string>;
  reasoningSummary: string;
  emailSubject: string;
  emailBody: string;
  reviewNotes: string;
  iterations: number;
  opportunityScore?: number;
  reachabilityScore?: number;
  completenessScore?: number;
  engagementScore?: number;
  priorityTier?: PriorityTier;
}

export type LeadStatus =
  | "idle"
  | "enriching"
  | "enriched"
  | "sending"
  | "sent"
  | "error";

/** Client-side lead: search result + per-lead UI state. */
export interface UILead extends Lead {
  status: LeadStatus;
  contactEmail: string;
  errorMsg?: string;
  researchBrief?: string;
  leadScore?: number;
  classification?: string;
  channel?: string;
  whatsappStatus?: string;
  templateType?: string;
  reasoningSummary?: string;
  emailSubject?: string;
  emailBody?: string;
  reviewNotes?: string;
  iterations?: number;
  opportunityScore?: number;
  reachabilityScore?: number;
  completenessScore?: number;
  engagementScore?: number;
  priorityTier?: PriorityTier;
}

/**
 * Kanban pipeline stages — the persistent lifecycle of a lead, mirroring the
 * AI workflow in AI_IMPLEMENTATION.md (Research → Draft → Critique → Revise →
 * Human Approval → Send). Stored as `pipeline_stage`; distinct from the
 * transient client-side UILead.status (enriching/sending/...) which only
 * reflects in-flight HTTP work.
 */
export type PipelineStage =
  | "new"
  | "drafting"
  | "ready"
  | "sent"
  | "won"
  | "archived";

/** A scan or import of leads, owning the leads it produced. */
export interface Campaign {
  id: string;
  name: string;
  keyword: string;
  location: string;
  minRating: number;
  minReviews: number;
  status: "active" | "archived";
  createdAt: string;
}

/** A lead as persisted in SQLite: search/import data + scorecard + draft + stage. */
export interface PersistedLead extends Lead {
  id: string;
  campaignId: string;
  contactEmail: string;
  pipelineStage: PipelineStage;
  /** Scorecard fields, set once the agent has processed the lead. */
  leadScore: number | null;
  classification: string | null;
  channel: string | null;
  whatsappStatus: string | null;
  templateType: string | null;
  rubricScores: Record<string, number> | null;
  rubricJustification: Record<string, string> | null;
  reasoningSummary: string | null;
  /** Metrics engine scores */
  opportunityScore: number | null;
  reachabilityScore: number | null;
  completenessScore: number | null;
  engagementScore: number | null;
  priorityTier: PriorityTier | null;
  /** Draft fields, set once the agent has drafted. */
  researchBrief: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  reviewNotes: string | null;
  iterations: number | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Campaign plus the aggregate numbers the dashboard/kanban need. */
export interface CampaignWithStats extends Campaign {
  leadCount: number;
  /** Number of leads in each pipeline stage (all stages present, 0-filled). */
  stageCounts: Record<PipelineStage, number>;
  avgScore: number | null;
}

/** Roll-up figures for the dashboard. */
export interface DashboardStats {
  totalCampaigns: number;
  totalLeads: number;
  avgScore: number | null;
  sentCount: number;
  wonCount: number;
  readyCount: number;
  tierCounts: Record<PriorityTier, number>;
  contactBreakdown: {
    hasEmail: number;
    hasPhoneOnly: number;
    hasSocialsOnly: number;
    noDirectContact: number;
  };
  funnel: Record<PipelineStage, number>;
  classificationBreakdown: { classification: string; count: number }[];
  recentCampaigns: CampaignWithStats[];
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
  autoSendTelegramOnReady?: boolean;
}

export interface RobotLogEntry {
  id: string;
  timestamp: string;
  robot: "Research Robot" | "Copywriter Robot" | "Outbound Robot" | "System";
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface AgentDeploymentState {
  isRunning: boolean;
  isPaused: boolean;
  autoSendMode: boolean;
  totalLeads: number;
  processedCount: number;
  successCount: number;
  sentCount: number;
  currentLeadId?: string;
  currentLeadName?: string;
  currentStepMessage?: string;
  startTime?: string;
  telegramEnabled: boolean;
  error?: string | null;
  logs: RobotLogEntry[];
}


