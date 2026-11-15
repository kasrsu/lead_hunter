import { NextRequest, NextResponse } from "next/server";
import { getUsageSummary } from "@/lib/repositories/quotaAndUsage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.headers.get("x-session-id") ?? "sess_default";
    const summary = getUsageSummary(sessionId);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch usage summary" }, { status: 500 });
  }
}
