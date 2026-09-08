import { NextRequest, NextResponse } from "next/server";
import { createCampaignFromSearch } from "@/lib/services/campaignService";

export const runtime = "nodejs";

/**
 * POST /api/search — scan a city for businesses without a website, then
 * persist the results as a new campaign (and its leads). Returns the campaign
 * with stats plus the persisted leads so the UI can jump straight to its board.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, location, apiKey, minRating, minReviews } = body ?? {};

    if (!keyword || !location || !apiKey) {
      return NextResponse.json(
        { error: "keyword, location, and apiKey are required" },
        { status: 400 }
      );
    }

    const { campaign, leads } = await createCampaignFromSearch({
      keyword,
      location,
      apiKey,
      minRating: Number(minRating) || 0,
      minReviews: Number(minReviews) || 0,
    });

    return NextResponse.json({ campaign, leads });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Search failed" }, { status: 500 });
  }
}
