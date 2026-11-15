import { NextRequest, NextResponse } from "next/server";
import { createSavedSearch, deleteSavedSearch, listSavedSearches } from "@/lib/repositories/savedSearches";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.headers.get("x-session-id") ?? "sess_default";
    const searches = listSavedSearches(sessionId);
    return NextResponse.json({ searches });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list saved searches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, categories, location, mapBounds, minRating, minReviews, hasWebsite } = body ?? {};

    if (!categories || !location) {
      return NextResponse.json({ error: "categories and location are required" }, { status: 400 });
    }

    const sessionId = req.headers.get("x-session-id") ?? "sess_default";

    const catArray = Array.isArray(categories) ? categories : [categories];
    const saved = createSavedSearch({
      sessionId,
      name,
      categories: catArray,
      location,
      mapBounds,
      minRating: Number(minRating) || 0,
      minReviews: Number(minReviews) || 0,
      hasWebsite: hasWebsite || "all",
    });

    return NextResponse.json({ savedSearch: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save search" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing search ID parameter" }, { status: 400 });
    }

    const sessionId = req.headers.get("x-session-id") ?? "sess_default";
    const success = deleteSavedSearch(id, sessionId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete saved search" }, { status: 500 });
  }
}
