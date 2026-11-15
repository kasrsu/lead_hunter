import { NextRequest, NextResponse } from "next/server";
import { listCampaignsWithStats } from "@/lib/repositories/campaigns";

export const runtime = "nodejs";

/** GET /api/campaigns — all campaigns with lead counts, for the dashboard. */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.headers.get("x-session-id") ?? undefined;
    return NextResponse.json({ campaigns: listCampaignsWithStats(sessionId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to load campaigns" }, { status: 500 });
  }
}
