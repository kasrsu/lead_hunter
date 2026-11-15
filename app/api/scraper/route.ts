import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { insertCampaign, getCampaignWithStats } from "@/lib/repositories/campaigns";
import { insertLeads } from "@/lib/repositories/leads";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const body = await req.json();
    const {
      businessType = "Business",
      location = "Colombo, Sri Lanka",
      minRating = 0,
      maxLeads = 25,
      hasWebsite = "all",
      targetSegment = "underdog",
      skipEnrichment = false,
      lat,
      lng,
      zoom = 14,
    } = body ?? {};

    const sessionId = req.headers.get("x-session-id") ?? "sess_default";

    console.log(`\n==================================================`);
    console.log(`🚀 [BACKEND LOG] Google Maps Deep Scraper Request Initialized`);
    console.log(`🕒 Timestamp     : ${timestamp}`);
    console.log(`🏷️ Business Type : "${businessType}"`);
    console.log(`📍 Location      : "${location}"`);
    console.log(`📊 Max Volume    : ${maxLeads} leads | Min Rating: ${minRating}★`);
    console.log(`🎯 Target Segment: ${targetSegment}`);
    console.log(`🌐 Website Filter: ${hasWebsite}`);
    console.log(`🤖 AI Enrichment : ${skipEnrichment ? "OFF (Skipped)" : "ON (Enabled)"}`);
    console.log(`🔑 Session ID    : ${sessionId}`);
    console.log(`==================================================\n`);

    if (!location || location.trim() === "") {
      console.warn(`⚠️ [BACKEND LOG] Validation Error: Missing location parameter.`);
      return NextResponse.json(
        { error: "Location is required for Google Maps lead extraction." },
        { status: 400 }
      );
    }

    // 1. Build Google Maps search URL dynamically (use + for spaces and keep clean commas)
    const cleanSearchStr = `${businessType} ${location}`.trim().replace(/\s+/g, "+");
    const geoPart = (lat && lng) ? `/@${lat},${lng},${zoom}z` : "";
    const mapsUrl = `https://www.google.com/maps/search/${cleanSearchStr}${geoPart}`;

    console.log(`📡 [BACKEND LOG] Generated Google Maps URL: ${mapsUrl}`);

    // 2. Prepare temporary output file path
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const outputFilePath = path.join(dataDir, `gmaps_scrape_${Date.now()}.json`);
    const mainScriptPath = path.join(process.cwd(), "full_lead_processing", "main.py");

    // 3. Detect Python executable (prefer user's venv)
    const pythonBinary = fs.existsSync("/home/kasr/Storage/Study_Dir/venvs/vz_rag/bin/python3")
      ? "/home/kasr/Storage/Study_Dir/venvs/vz_rag/bin/python3"
      : "python3";

    console.log(`⚙️ [BACKEND LOG] Executing Python Engine using: ${pythonBinary}`);
    console.log(`📁 [BACKEND LOG] Temporary Output File Path : ${outputFilePath}`);

    // 4. Execute python orchestrator CLI with real-time live terminal streaming
    console.log(`\n--- 🟢 [REAL-TIME PYTHON SCRAPER LOGS START] ---`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(pythonBinary, [mainScriptPath, mapsUrl, outputFilePath, String(maxLeads)], {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          SKIP_ENRICHMENT: skipEnrichment ? "1" : "0",
          MAX_LEADS: String(maxLeads),
          TARGET_SEGMENT: targetSegment,
        },
      });

      const timer = setTimeout(() => {
        console.warn(`⚠️ [BACKEND LOG] Timeout reached. Attempting to rescue scraped leads...`);
        child.kill("SIGTERM");
        setTimeout(() => {
          if (fs.existsSync(outputFilePath)) {
            try {
              const checkData = fs.readFileSync(outputFilePath, "utf-8");
              const parsed = JSON.parse(checkData);
              if (Array.isArray(parsed.leads) && parsed.leads.length > 0) {
                console.log(`✅ [BACKEND LOG] Rescued ${parsed.leads.length} leads scraped before timeout!`);
                return resolve();
              }
            } catch {}
          }
          reject(new Error("Python scraper execution timed out. Try requesting a lower volume (e.g. 10 or 25 leads)."));
        }, 1500);
      }, 600000);

      child.stdout.on("data", (data) => {
        process.stdout.write(`[PYTHON SCRAPER] ${data.toString()}`);
      });

      child.stderr.on("data", (data) => {
        process.stderr.write(`[PYTHON ERR] ${data.toString()}`);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        console.log(`--- 🔴 [REAL-TIME PYTHON SCRAPER LOGS END (Exit Code ${code})] ---\n`);

        if (fs.existsSync(outputFilePath)) {
          try {
            const checkData = fs.readFileSync(outputFilePath, "utf-8");
            const parsed = JSON.parse(checkData);
            if (Array.isArray(parsed.leads) && parsed.leads.length > 0) {
              console.log(`✅ [BACKEND LOG] Successfully verified ${parsed.leads.length} leads in output payload.`);
              return resolve();
            }
          } catch {}
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python scraper process exited with code ${code}`));
        }
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // 5. Read output campaign JSON file
    if (!fs.existsSync(outputFilePath)) {
      console.error(`❌ [BACKEND LOG] File Not Found: Output file ${outputFilePath} was not produced.`);
      return NextResponse.json(
        { error: "Lead extraction finished, but output campaign payload was not generated." },
        { status: 500 }
      );
    }

    const rawData = fs.readFileSync(outputFilePath, "utf-8");
    let payload: { campaignName?: string; leads?: any[] } = {};
    try {
      payload = JSON.parse(rawData);
    } catch (pErr) {
      console.error(`❌ [BACKEND LOG] JSON Parse Error: Could not parse scraper payload.`);
      throw new Error("Failed to parse scraper results JSON payload.");
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(outputFilePath); } catch {}
    }

    let rawLeads: any[] = payload.leads || [];
    console.log(`📥 [BACKEND LOG] Raw Scraped Leads Received: ${rawLeads.length} leads.`);

    // 6. Apply user filters (minRating, hasWebsite)
    if (minRating > 0) {
      rawLeads = rawLeads.filter((l) => (l.rating || 0) >= minRating);
    }
    if (hasWebsite === "no") {
      rawLeads = rawLeads.filter((l) => !l.hasWebsite && !l.website);
    } else if (hasWebsite === "yes") {
      rawLeads = rawLeads.filter((l) => l.hasWebsite || Boolean(l.website));
    }

    if (maxLeads > 0) {
      rawLeads = rawLeads.slice(0, maxLeads);
    }

    console.log(`🔍 [BACKEND LOG] Leads After User Filters: ${rawLeads.length} leads.`);

    // 7. Format leads into LeadHunter app schema
    const formattedLeads: Partial<Lead>[] = rawLeads.map((item, idx) => {
      const reviewVal = Number(item.reviews) || Number(item.reviewCount) || 0;
      return {
        placeId: item.id || `gmaps_${Date.now()}_${idx}`,
        name: item.name || `Business Lead #${idx + 1}`,
        category: item.category || businessType,
        rating: Number(item.rating) || 0,
        reviews: reviewVal,
        reviewCount: reviewVal,
        address: item.address || location,
        phone: item.phone || undefined,
        website: item.website || undefined,
        hasWebsite: Boolean(item.hasWebsite || item.website),
        leadScore: Number(item.leadScore) || 50,
        classification: item.classification || "GENERAL_OUTREACH",
        outreachChannel: item.channel || "EMAIL",
        outreachAngle: item.recommendedAngle || undefined,
        pitchDraft: item.pitchDraft || undefined,
        rubricBreakdown: item.rubricBreakdown || undefined,
        email: item.email || undefined,
        instagram: item.instagram || undefined,
        facebook: item.facebook || undefined,
        reviewSnippet: item.reviewSnippet || undefined,
        mapsUrl: item.mapsUrl || mapsUrl,
        pipelineStage: "new",
      };
    });

    // 8. Insert campaign & leads into database
    const campaignName = `${businessType} in ${location} (Deep Map Scrape)`;
    console.log(`💾 [BACKEND LOG] Persisting Campaign to SQLite DB: "${campaignName}"`);

    const campaign = insertCampaign({
      name: campaignName,
      keyword: businessType,
      location: location,
      minRating,
      minReviews: 0,
      sessionId,
    });

    const persistedLeads = insertLeads(campaign.id, formattedLeads as any);
    const campaignStats = getCampaignWithStats(campaign.id);

    const durationMs = Date.now() - startTime;
    console.log(`\n==================================================`);
    console.log(`✅ [BACKEND LOG] Google Maps Deep Scraper Completed Successfully!`);
    console.log(`📊 Campaign ID   : ${campaign.id}`);
    console.log(`👥 Persisted Leads: ${persistedLeads.length}`);
    console.log(`⏱️ Duration       : ${(durationMs / 1000).toFixed(2)} seconds`);
    console.log(`==================================================\n`);

    return NextResponse.json({
      success: true,
      campaign: campaignStats || campaign,
      leads: persistedLeads,
      scrapedCount: persistedLeads.length,
      mapsUrl,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ [BACKEND LOG ERROR] Request failed after ${(durationMs / 1000).toFixed(2)}s:`, err.message || err);
    return NextResponse.json(
      { error: err.message || "Deep Google Maps scraping failed." },
      { status: 500 }
    );
  }
}
