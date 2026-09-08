import { enrichLead as runAgent } from "@/lib/agent";
import { sendOutreachEmail } from "@/lib/email";
import { sendOutreachWhatsApp, getWhatsAppUrl } from "@/lib/whatsapp";
import { canTransition } from "@/lib/kanban";
import { getLead, updateLead } from "@/lib/repositories/leads";
import type { PipelineStage, SenderProfile } from "@/lib/types";

/**
 * Lead orchestration (Services layer): run the agent, send the email or whatsapp message, move
 * cards — and enforce the business rules that make those actions meaningful.
 */

export async function enrichLeadById(
  leadId: string,
  sender?: Partial<SenderProfile>
): Promise<ReturnType<typeof updateLead>> {
  const lead = getLead(leadId);
  if (!lead) throw new Error("Lead not found");

  const activeSender: SenderProfile = {
    senderName: sender?.senderName || "EVO Solutions Outreach",
    senderCompany: sender?.senderCompany || "EVO Solutions",
    offerDescription: sender?.offerDescription || "Digital storefront optimization, dynamic menu pricing & lead intelligence",
    senderEmail: sender?.senderEmail || "hello@evosolutions.lk",
  };

  const enriched = await runAgent(lead, activeSender);

  // The agent ran: scorecard + draft are real now. The lead lands in
  // "Awaiting approval" — the Human Approval step of the AI workflow.
  const updatedLead = updateLead(leadId, {
    pipelineStage: "ready",
    leadScore: enriched.leadScore,
    classification: enriched.classification,
    channel: enriched.channel,
    whatsappStatus: enriched.whatsappStatus,
    templateType: enriched.templateType,
    rubricScores: enriched.rubricScores,
    rubricJustification: enriched.rubricJustification,
    reasoningSummary: enriched.reasoningSummary,
    researchBrief: enriched.researchBrief,
    emailSubject: enriched.emailSubject,
    emailBody: enriched.emailBody,
    reviewNotes: enriched.reviewNotes,
    iterations: enriched.iterations,
  });

  try {
    const { logActivity } = await import("@/lib/repositories/activityLogs");
    logActivity({
      category: "AGENT",
      level: "SUCCESS",
      message: `Enriched lead "${updatedLead.name}" (Score: ${updatedLead.leadScore}/100, Channel: ${updatedLead.channel})`,
      details: `Subject: "${updatedLead.emailSubject}"`,
    });
  } catch {}

  // Dispatch interactive approval message to Telegram
  try {
    const { notifyLeadEnriched } = await import("@/lib/services/telegramService");
    await notifyLeadEnriched(updatedLead);
  } catch (err: any) {
    console.warn(`[Lead Service] Telegram approval notification warning: ${err.message}`);
  }

  return updatedLead;
}

export async function sendLeadById(
  leadId: string,
  sender: SenderProfile
): Promise<ReturnType<typeof updateLead>> {
  const lead = getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  if (lead.pipelineStage === "sent") throw new Error("This lead has already been sent");
  if (!lead.contactEmail) {
    throw new Error("Add a business contact email before sending — Places doesn't expose one.");
  }
  if (!lead.emailSubject || !lead.emailBody) {
    throw new Error("Generate a draft before sending.");
  }

  await sendOutreachEmail({
    to: lead.contactEmail,
    subject: lead.emailSubject,
    body: lead.emailBody,
    senderName: sender.senderName,
    senderEmail: sender.senderEmail,
  });

  const updated = updateLead(leadId, { pipelineStage: "sent", sentAt: new Date().toISOString() });

  try {
    const { logActivity } = await import("@/lib/repositories/activityLogs");
    logActivity({
      category: "RESEND",
      level: "SUCCESS",
      message: `Dispatched outreach email to ${lead.contactEmail} via Resend (${sender.senderEmail})`,
      details: `Subject: "${lead.emailSubject}"`,
    });
  } catch {}

  return updated;
}

export async function sendWhatsAppLeadById(
  leadId: string,
  sender: SenderProfile
): Promise<{ lead: ReturnType<typeof updateLead>; whatsappResult: any }> {
  const lead = getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  if (lead.pipelineStage === "sent") throw new Error("This lead has already been sent");
  if (!lead.phone) {
    throw new Error("Lead missing phone number for WhatsApp dispatch.");
  }
  if (!lead.emailBody) {
    throw new Error("Generate a draft before sending.");
  }

  const result = await sendOutreachWhatsApp({
    toPhone: lead.phone,
    text: lead.emailBody,
    senderName: sender.senderName,
  });

  const updated = updateLead(leadId, { pipelineStage: "sent", sentAt: new Date().toISOString() });
  return { lead: updated, whatsappResult: result };
}

export function moveLeadById(
  leadId: string,
  to: PipelineStage
): ReturnType<typeof updateLead> {
  const lead = getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  if (!canTransition(lead.pipelineStage, to)) {
    throw new Error(`Can't move a lead from "${lead.pipelineStage}" to "${to}"`);
  }
  if (to === "sent") {
    // Guard is redundant with canTransition (always false) but keeps intent obvious.
    throw new Error('Reach "Sent" through the send action, not a column move.');
  }
  return updateLead(leadId, { pipelineStage: to });
}
