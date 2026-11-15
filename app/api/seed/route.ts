import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { insertCampaign, listCampaignsWithStats } from "@/lib/repositories/campaigns";
import { insertLeads } from "@/lib/repositories/leads";
import type { CampaignWithStats } from "@/lib/types";

export async function POST() {
  try {
    const archiveDir = path.join(process.cwd(), "archived_programming");
    const detailsPath = path.join(archiveDir, "lead_details.json");
    const scoredPath = path.join(archiveDir, "scored_leads.json");

    if (!fs.existsSync(detailsPath)) {
      return NextResponse.json(
        { error: "archived_programming/lead_details.json file not found" },
        { status: 404 }
      );
    }

    const leadDetails: any[] = JSON.parse(fs.readFileSync(detailsPath, "utf-8"));
    let scoredLeads: any[] = [];
    if (fs.existsSync(scoredPath)) {
      scoredLeads = JSON.parse(fs.readFileSync(scoredPath, "utf-8"));
    }

    // Check if campaign already exists
    const existing = listCampaignsWithStats().find(
      (c: CampaignWithStats) => c.name === "Archived Hospitality Leads (Sri Lanka)"
    );

    const campaign =
      existing ||
      insertCampaign({
        name: "Archived Hospitality Leads (Sri Lanka)",
        keyword: "Fine Dining & Restaurants",
        location: "Colombo / Galle, Sri Lanka",
        minRating: 4.0,
        minReviews: 10,
      });

    // Map scored leads by lead_name for easy join
    const scoreMap = new Map<string, any>();
    for (const s of scoredLeads) {
      if (s.lead_name) scoreMap.set(s.lead_name.toLowerCase().trim(), s);
    }

    const normalized: any[] = leadDetails.map((lead: any, idx: number) => {
      const name = lead.name || `Restaurant ${idx + 1}`;
      const scored = scoreMap.get(name.toLowerCase().trim()) || scoredLeads[idx] || {};

      return {
        placeId: `arch_${idx + 1}`,
        name,
        category: lead.category || "Fine Dining",
        address: lead.address || "",
        phone: lead.phone || "",
        contactEmail: lead.email || "",
        rating: typeof lead.rating === "number" ? lead.rating : 4.5,
        reviews: typeof lead.review_count === "number" ? lead.review_count : 100,
        mapsUrl: lead.maps_url || "",
        website: lead.website || "",
        hasWebsite: Boolean(lead.website),
        priceRange: lead.price_range || "",
        reviewSnippet: lead.review_snippet || "",
        features: Array.isArray(lead.features) ? lead.features : [],
        instagram: lead.instagram || "",
        facebook: lead.facebook || "",
        hoursLabel: lead.hours_label || "",
        imageUrl: lead.image_url || "",
        source: "archived-preset",
        // Scored / drafted data
        leadScore: scored.lead_score || null,
        classification: scored.classification || null,
        channel: scored.channel || null,
        templateType: scored.template_type || null,
        rubricScores: scored.rubric_scores || null,
        rubricJustification: scored.rubric_justification || null,
        reasoningSummary: scored.reasoning_summary || null,
        emailSubject: scored.email_body ? `Quick question regarding ${name}'s digital presence` : null,
        emailBody: scored.email_body || null,
        pipelineStage: scored.email_body ? "ready" : "new",
      };
    });

    const inserted = insertLeads(campaign.id, normalized);

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${inserted.length} production leads from archived_programming`,
      campaign,
      count: inserted.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to seed archived leads" },
      { status: 500 }
    );
  }
}
