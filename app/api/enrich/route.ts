import { NextRequest, NextResponse } from "next/server";
import { generateColdOpener } from "@/lib/enrichment";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/enrich — Generate a 2-3 sentence cold outreach email opener for a lead in the background.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { lead, leadId, provider, anthropicApiKey } = body ?? {};

    if (!lead && !leadId) {
      console.warn(`⚠️ [BACKEND LOG] Enrich Error: Lead object or leadId is required`);
      return NextResponse.json({ error: "Lead object or leadId is required" }, { status: 400 });
    }

    let targetLead = lead;
    if (!targetLead && leadId) {
      const db = getDb();
      const row = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId) as any;
      if (row) {
        targetLead = {
          placeId: row.place_id,
          name: row.name,
          address: row.address,
          phone: row.phone,
          rating: row.rating,
          reviews: row.reviews,
          mapsUrl: row.maps_url,
          category: row.category,
          website: row.website,
          hasWebsite: Boolean(row.has_website),
        };
      }
    }

    if (!targetLead) {
      console.warn(`⚠️ [BACKEND LOG] Enrich Error: Target lead not found in DB.`);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    console.log(`🤖 [BACKEND LOG] AI Opener Generation Request: "${targetLead.name}" via provider: ${provider || "auto"}`);

    const generatedOpener = await generateColdOpener(targetLead, {
      provider: provider || "auto",
      anthropicApiKey,
    });

    // Update database if leadId provided
    if (leadId) {
      const db = getDb();
      db.prepare(`UPDATE leads SET generated_opener = ?, email_body = ? WHERE id = ?`).run(
        generatedOpener,
        generatedOpener,
        leadId
      );
    }

    const durationMs = Date.now() - startTime;
    console.log(`✨ [BACKEND LOG] AI Opener Generated for "${targetLead.name}" in ${(durationMs / 1000).toFixed(2)}s:`);
    console.log(`   📝 "${generatedOpener.slice(0, 80)}..."`);

    return NextResponse.json({
      success: true,
      leadId,
      generatedOpener,
    });
  } catch (err: any) {
    console.error(`❌ [BACKEND LOG ERROR] Enrich failed:`, err.message || err);
    return NextResponse.json({ error: err.message || "Enrichment failed" }, { status: 500 });
  }
}
