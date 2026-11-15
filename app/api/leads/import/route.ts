import { NextResponse } from "next/server";
import { getCampaign, insertCampaign } from "@/lib/repositories/campaigns";
import { insertLeads } from "@/lib/repositories/leads";
import type { Lead } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let rawLeads: any[] | null = null;
    let campaignNameOverride = body.campaignName;

    if (Array.isArray(body)) {
      rawLeads = body;
    } else if (Array.isArray(body.leads)) {
      rawLeads = body.leads;
    } else if (body.leads && typeof body.leads === "object") {
      if (Array.isArray(body.leads.leads)) {
        rawLeads = body.leads.leads;
        if (!campaignNameOverride && body.leads.campaignName) {
          campaignNameOverride = body.leads.campaignName;
        }
      }
    }

    if (!rawLeads || rawLeads.length === 0) {
      return NextResponse.json(
        { error: "No valid leads array found in JSON payload. Provide an array [ { ... } ] or { leads: [ ... ] }" },
        { status: 400 }
      );
    }

    let campaignId = body.campaignId;
    let campaign = campaignId ? getCampaign(campaignId) : null;

    if (!campaign) {
      const name = campaignNameOverride || body.campaignName || `JSON Import (${rawLeads.length} leads)`;
      campaign = insertCampaign({
        name,
        keyword: "Bulk JSON Import",
        location: "Imported Data",
        minRating: 0,
        minReviews: 0,
      });
    }

    const normalizedLeads: Partial<Lead>[] = rawLeads.map((item: any, idx: number) => {
      const name = item.name || item.lead_name || item.title || `Imported Lead ${idx + 1}`;
      const website = item.website || item.url || "";
      const hasWebsite = item.hasWebsite !== undefined ? Boolean(item.hasWebsite) : Boolean(website);

      return {
        placeId: item.placeId || item.place_id || `imp_${Date.now()}_${idx}`,
        name,
        category: item.category || item.type || "Restaurant & Hospitality",
        address: item.address || item.location || "",
        phone: item.phone || item.contact || item.mobile || "",
        contactEmail: item.email || item.contact_email || "",
        rating: typeof item.rating === "number" ? item.rating : item.rating ? parseFloat(item.rating) : 4.5,
        reviews: typeof item.reviews === "number" ? item.reviews : item.review_count ? parseInt(item.review_count, 10) : 50,
        mapsUrl: item.mapsUrl || item.maps_url || "",
        website,
        hasWebsite,
        priceRange: item.priceRange || item.price_range || "",
        reviewSnippet: item.reviewSnippet || item.review_snippet || "",
        features: Array.isArray(item.features) ? item.features : [],
        instagram: item.instagram || "",
        facebook: item.facebook || "",
        hoursLabel: item.hoursLabel || item.hours_label || "",
        imageUrl: item.imageUrl || item.image_url || "",
        source: item.source || "json-import",
        // Pre-existing draft / scorecard fields if present from archived data
        leadScore: item.lead_score ?? item.leadScore,
        classification: item.classification,
        channel: item.channel,
        templateType: item.template_type || item.templateType,
        rubricScores: item.rubric_scores || item.rubricScores,
        rubricJustification: item.rubric_justification || item.rubricJustification,
        reasoningSummary: item.reasoning_summary || item.reasoningSummary,
        emailBody: item.email_body || item.emailBody,
        pipelineStage: item.pipelineStage || "new",
      } as any;
    });

    const importedLeads = insertLeads(campaign.id, normalizedLeads);

    return NextResponse.json({
      success: true,
      campaign,
      count: importedLeads.length,
      leads: importedLeads,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to import leads" },
      { status: 500 }
    );
  }
}
