import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/repositories/leads";
import { moveLeadById } from "@/lib/services/leadService";
import type { PipelineStage } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/leads/[id] — one lead, for the detail page. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = getLead(params.id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to load lead" }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/[id] — edit a lead's editable fields (contact email, draft
 * subject/body) or move it between pipeline columns. Moving to "Sent" is
 * rejected here — that only happens through the send action.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { contactEmail, emailSubject, emailBody, stage } = body ?? {};

    if (stage != null) {
      if (!["new", "drafting", "ready", "sent", "won", "archived"].includes(stage)) {
        return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 });
      }
      const lead = moveLeadById(params.id, stage as PipelineStage);
      return NextResponse.json({ lead });
    }

    const lead = updateLead(params.id, {
      contactEmail: contactEmail ?? undefined,
      emailSubject: emailSubject ?? undefined,
      emailBody: emailBody ?? undefined,
    });
    return NextResponse.json({ lead });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to update lead" }, { status: 400 });
  }
}
