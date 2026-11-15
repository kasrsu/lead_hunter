import { NextRequest, NextResponse } from "next/server";
import { enrichLeadById } from "@/lib/services/leadService";
import type { SenderProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max timeout for local LLM

/** POST /api/leads/[id]/enrich — run the agent for one lead, persist scorecard + draft. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const sender = body?.sender as SenderProfile;
    if (!sender) {
      return NextResponse.json({ error: "sender is required" }, { status: 400 });
    }
    const lead = await enrichLeadById(params.id, sender);
    return NextResponse.json({ lead });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Enrichment failed" }, { status: 500 });
  }
}
