import { NextRequest, NextResponse } from "next/server";
import { createCampaignFromSearch } from "@/lib/services/campaignService";

export const runtime = "nodejs";

/**
 * POST /api/search — query official Google Places API (New) with field masking,
 * 30-day cache check, and daily/monthly quota enforcement.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const body = await req.json();
    const {
      categories = [],
      keyword,
      includedTypes = [],
      location,
      apiKey: requestApiKey,
      minRating = 0,
      minReviews = 0,
      hasWebsite = "all",
      maxResults = 60,
      mapBounds,
    } = body ?? {};

    const sessionId = req.headers.get("x-session-id") ?? "sess_default";
    const apiKey = requestApiKey || process.env.GOOGLE_PLACES_API_KEY;

    // Standardize category array
    const catList: string[] = Array.isArray(categories) && categories.length > 0
      ? categories
      : (keyword ? [keyword] : ["businesses"]);

    console.log(`\n==================================================`);
    console.log(`⚡ [BACKEND LOG] Google Places API (New) Search Request`);
    console.log(`🕒 Timestamp     : ${timestamp}`);
    console.log(`🏷️ Categories    : ${catList.join(", ")}`);
    console.log(`📍 Location      : "${location}"`);
    console.log(`📊 Max Results   : ${maxResults} | Min Rating: ${minRating}★ | Min Reviews: ${minReviews}`);
    console.log(`🔑 Session ID    : ${sessionId}`);
    console.log(`==================================================\n`);

    if (!apiKey || apiKey.trim() === "") {
      console.warn(`⚠️ [BACKEND LOG] Error: Google Places API key missing.`);
      return NextResponse.json(
        { error: "Google Places API Key is required. Please set GOOGLE_PLACES_API_KEY in .env or enter your key in the UI." },
        { status: 400 }
      );
    }

    if (!location || location.trim() === "") {
      console.warn(`⚠️ [BACKEND LOG] Error: Location missing.`);
      return NextResponse.json(
        { error: "Location is required." },
        { status: 400 }
      );
    }

    const result = await createCampaignFromSearch({
      categories: catList,
      includedTypes: Array.isArray(includedTypes) ? includedTypes : [],
      location,
      apiKey,
      minRating: Number(minRating) || 0,
      minReviews: Number(minReviews) || 0,
      hasWebsite,
      maxResults: Number(maxResults) || 60,
      sessionId,
      mapBounds,
    });

    const durationMs = Date.now() - startTime;
    console.log(`\n==================================================`);
    console.log(`✅ [BACKEND LOG] Google Places API Search Succeeded!`);
    console.log(`📊 Campaign ID   : ${result.campaign.id}`);
    console.log(`👥 Total Leads   : ${result.leads.length}`);
    console.log(`⚡ Cache Hit     : ${result.isCacheHit ? "YES (0 API Cost)" : "NO (Live API Query)"}`);
    console.log(`💵 Est. API Cost : $${result.estimatedCostUsd?.toFixed(4)}`);
    console.log(`⏱️ Duration       : ${(durationMs / 1000).toFixed(2)}s`);
    console.log(`==================================================\n`);

    return NextResponse.json({
      campaign: result.campaign,
      leads: result.leads,
      isCacheHit: result.isCacheHit,
      estimatedCostUsd: result.estimatedCostUsd,
      totalRequests: result.totalRequests,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const message = err.message ?? "Search failed";
    console.error(`❌ [BACKEND LOG ERROR] Search failed after ${(durationMs / 1000).toFixed(2)}s:`, message);

    const status = message.includes("QUOTA EXCEEDED") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
