import { NextRequest, NextResponse } from "next/server";
import {
  getCampaignWithStats,
  renameCampaign,
  setCampaignStatus,
} from "@/lib/repositories/campaigns";
import { listLeadsByCampaign } from "@/lib/repositories/leads";

export const runtime = "nodejs";

/** GET /api/campaigns/[id] — the campaign (with stats) and its leads. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaign = getCampaignWithStats(params.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const leads = listLeadsByCampaign(params.id);
    return NextResponse.json({ campaign, leads });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to load campaign" }, { status: 500 });
  }
}

/** PATCH /api/campaigns/[id] — rename or archive a campaign. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, status } = body ?? {};

    if (name != null && typeof name === "string" && name.trim()) {
      renameCampaign(params.id, name.trim());
    }
    if (status === "active" || status === "archived") {
      setCampaignStatus(params.id, status);
    }

    const campaign = getCampaignWithStats(params.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to update campaign" }, { status: 500 });
  }
}
