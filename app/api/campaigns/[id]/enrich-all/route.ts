import { NextRequest, NextResponse } from "next/server";
import { getCampaign } from "@/lib/repositories/campaigns";
import { listLeadsByCampaign, updateLeadStage } from "@/lib/repositories/leads";
import { enrichLeadById } from "@/lib/services/leadService";
import type { SenderProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max timeout for local LLM batching

/**
 * POST /api/campaigns/[id]/enrich-all — run the agent over every lead that
 * still needs a scorecard + draft (New/Drafting), one at a time against the
 * local Ollama model. Sequential on purpose: Ollama is local and each lead is
 * several LLM calls, so hammering it in parallel just makes everything slower.
 * Failures leave the lead in "New" so a retry picks it back up.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaign = getCampaign(params.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const sender = body?.sender as SenderProfile;
    if (!sender?.senderName || !sender?.senderCompany || !sender?.offerDescription) {
      return NextResponse.json(
        { error: "sender.senderName, senderCompany, and offerDescription are required" },
        { status: 400 }
      );
    }

    const force = Boolean(body?.force);
    const leads = listLeadsByCampaign(params.id).filter(
      (l) => force || l.pipelineStage === "new" || l.pipelineStage === "drafting"
    );

    const errors: { leadId: string; name: string; error: string }[] = [];
    for (const lead of leads) {
      updateLeadStage(lead.id, "drafting");
      try {
        await enrichLeadById(lead.id, sender);
      } catch (err: any) {
        errors.push({ leadId: lead.id, name: lead.name, error: err.message });
        updateLeadStage(lead.id, "new"); // back in the queue for a retry
      }
    }

    return NextResponse.json({
      updated: leads.length - errors.length,
      failed: errors.length,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Enrich-all failed" }, { status: 500 });
  }
}
