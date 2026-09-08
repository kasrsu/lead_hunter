import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/services/dashboardService";

export const runtime = "nodejs";

/** GET /api/dashboard — aggregate stats for the dashboard screen. */
export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json({ stats: getDashboardStats() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to load dashboard" }, { status: 500 });
  }
}
