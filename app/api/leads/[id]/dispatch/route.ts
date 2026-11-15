import { NextRequest, NextResponse } from "next/server";
import { getLead } from "@/lib/repositories/leads";

export const runtime = "nodejs";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://127.0.0.1:8000";

/** POST /api/leads/[id]/dispatch — trigger the Review & Dispatch Agent for one lead. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const leadId = params.id;
    const existing = getLead(leadId);
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const res = await fetch(`${AGENT_SERVICE_URL}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Agent service error" }));
      return NextResponse.json(
        { error: err.detail || "Dispatch agent service error" },
        { status: res.status }
      );
    }

    const dispatchData = await res.json();
    const updatedLead = getLead(leadId);

    return NextResponse.json({
      success: true,
      dispatch: dispatchData,
      lead: updatedLead,
    });
  } catch (err: any) {
    console.error("Dispatch endpoint error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to reach dispatch agent service" },
      { status: 500 }
    );
  }
}
