import { computeLeadMetrics } from "./services/scoringEngine";
import type { EnrichedLead, Lead, SenderProfile } from "./types";

/**
 * HTTP client for the Python agent service.
 *
 * Calls the FastAPI Python agent service (research -> score -> draft -> critique -> revise)
 * on AGENT_SERVICE_URL (default: http://127.0.0.1:8000).
 * If the service is offline or fails, it falls back gracefully to the local engine.
 */

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? "http://127.0.0.1:8000";

export async function enrichLead(lead: Lead, sender: SenderProfile): Promise<EnrichedLead> {
  console.log(`[Agent] Contacting Python agent service at ${AGENT_SERVICE_URL}/enrich for lead "${lead.name}"...`);

  const activeSender: SenderProfile = {
    senderName: sender?.senderName || "EVO Solutions Outreach",
    senderCompany: sender?.senderCompany || "EVO Solutions",
    offerDescription: sender?.offerDescription || "Digital storefront optimization, dynamic menu pricing & lead intelligence",
    senderEmail: sender?.senderEmail || "outreach@evosolutions.lk",
  };

  try {
    const res = await fetch(`${AGENT_SERVICE_URL}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(300000), // 5 minutes timeout for local LLM processing
      body: JSON.stringify({
        lead: {
          placeId: lead.placeId || "lead_id",
          name: lead.name,
          address: lead.address || "",
          phone: lead.phone || "",
          rating: lead.rating || 0,
          reviews: lead.reviews || 0,
          mapsUrl: lead.mapsUrl || "",
          category: lead.category || "",
        },
        sender: activeSender,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.lead) {
        console.log(`[Agent] Successfully received Python LangGraph response for "${lead.name}"!`);
        return data.lead as EnrichedLead;
      }
    } else {
      const errorText = await res.text();
      console.warn(`[Agent] Python service returned HTTP ${res.status}: ${errorText}`);
    }
  } catch (err: any) {
    console.warn(`[Agent] Can't reach Python agent service at ${AGENT_SERVICE_URL}: ${err.message}`);
  }

  console.log(`[Agent] Using local fallback engine for lead "${lead.name}"`);

  // Local fallback engine (derived from process_leads.py)
  const metrics = computeLeadMetrics(lead);
  const name = lead.name || "Your Business";
  const rating = lead.rating ? `${lead.rating}/5` : "a strong rating";
  const reviews = lead.reviews ? ` across ${lead.reviews} reviews` : "";
  const category = lead.category || "hospitality";
  const catLower = (category || "").toLowerCase();
  const isAgencySoftware = /marketing|advertising|software|saas|tech|agency|media|pr|consult/.test(catLower);
  const isTrades = /plumbing|hvac|roofing|electrician|contractor|repair|solar/.test(catLower);
  const isProfessional = /law|legal|attorney|dentist|dental|doctor|clinic|cpa|account/.test(catLower);

  const solutionText = isAgencySoftware
    ? "build high-converting digital storefronts, optimize inbound lead capture funnels, and accelerate client acquisition."
    : isTrades
    ? "build high-converting mobile portals, enable instant quote & booking requests, and dominate local search visibility."
    : isProfessional
    ? "build modern practice storefronts, automate client intake workflows, and streamline online scheduling."
    : "build high-converting digital storefronts, integrate direct ordering systems, and drive targeted local customer acquisition.";

  const classification = metrics.opportunityScore >= 70 ? "HIGH_OPPORTUNITY" : metrics.opportunityScore >= 40 ? "MEDIUM_OPPORTUNITY" : "LOW_OPPORTUNITY";
  const templateType = lead.phone ? "WHATSAPP_INTRO" : "EMAIL_OUTREACH";

  const subject = `Outreach & Partnership Proposal - ${name}`;
  const emailBody = `Dear ${name} Team,

I noticed ${name} has built an impressive local reputation with ${rating}${reviews}. However, many ${category} businesses lose potential customer volume and margin by not fully capturing their direct digital presence.

Our team at EvoSolutions works directly with leading ${category} businesses to ${solutionText}

Please visit evosolutions.lk to explore our full portfolio and solutions.

Best Regards,
Anusara Sugeeshwara
Marketing team at EvoSolutions
Phone: 0751800804 | Email: hello@evosolutions.lk | Web: evosolutions.lk`;

  return {
    ...lead,
    researchBrief: `Business: ${name}\nCategory: ${category}\nRating: ${rating}\nReviews: ${reviews}\nPhone: ${lead.phone || "N/A"}\nEmail: ${(lead as any).contactEmail || "N/A"}\nOpportunity Score: ${metrics.opportunityScore}/100`,
    leadScore: metrics.opportunityScore,
    opportunityScore: metrics.opportunityScore,
    reachabilityScore: metrics.reachabilityScore,
    completenessScore: metrics.completenessScore,
    engagementScore: metrics.engagementScore,
    priorityTier: metrics.priorityTier,
    classification,
    channel: lead.phone ? "WHATSAPP" : "EMAIL",
    whatsappStatus: lead.phone ? "verified" : "no_phone",
    templateType,
    rubricScores: {
      rating_quality: lead.rating >= 4.5 ? 20 : 10,
      digital_presence: lead.hasWebsite ? 15 : 0,
      contact_availability: lead.phone && (lead as any).contactEmail ? 10 : 5,
    },
    rubricJustification: {
      rating_quality: `Rating ${rating} indicates strong customer feedback.`,
      digital_presence: lead.hasWebsite ? "Has active web presence." : "Missing website — high opportunity gap.",
    },
    reasoningSummary: `Scored ${metrics.opportunityScore}/100 based on rating quality and digital presence gap analysis.`,
    emailSubject: subject,
    emailBody,
    reviewNotes: `Generated via Local Lead OS Engine. (Start agent-service on ${AGENT_SERVICE_URL} for LangGraph/Ollama)`,
    iterations: 1,
  };
}
