"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import SearchForm from "@/components/SearchForm";

export default function ImportPage() {
  const router = useRouter();

  // Preset Seeder State
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  // Bulk JSON Import State
  const [jsonText, setJsonText] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Google Places Search State
  const [apiKey, setApiKey] = useState("");
  const [keyword, setKeyword] = useState("restaurant");
  const [location, setLocation] = useState("Colombo, Sri Lanka");
  const [minRating, setMinRating] = useState(3.5);
  const [minReviews, setMinReviews] = useState(10);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const sampleJson = `[
  {
    "name": "Cafe Ceylon",
    "category": "Fine Dining & Cafe",
    "address": "42 Galle Road, Colombo 03",
    "phone": "+94 77 123 4567",
    "email": "owner@cafeceylon.lk",
    "rating": 4.6,
    "reviews": 214,
    "hasWebsite": false,
    "priceRange": "$$$",
    "source": "manual-import"
  }
]`;

  const handleSeedArchived = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to seed archived leads");
      setSeedMsg(`Success! Loaded ${data.count} production leads from archived_programming.`);
      setTimeout(() => {
        router.push("/leads");
      }, 1500);
    } catch (err: any) {
      setSeedMsg(`Error: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleJsonImport = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error("Invalid JSON syntax. Please verify JSON format.");
      }

      // Handle both raw lead array [...] or wrapped object { campaignName, leads: [...] }
      const isWrapped = parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.leads);
      const leadsPayload = isWrapped ? parsed.leads : parsed;
      const effectiveCampaignName = campaignName || (isWrapped ? parsed.campaignName : undefined);

      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: leadsPayload,
          campaignName: effectiveCampaignName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportMsg(`Successfully imported ${data.count} leads into campaign "${data.campaign.name}"!`);
      setTimeout(() => {
        router.push(`/campaigns/${data.campaign.id}`);
      }, 1500);
    } catch (err: any) {
      setImportMsg(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSearchChange = (field: string, value: string | number) => {
    const setters: Record<string, (v: any) => void> = {
      apiKey: setApiKey,
      keyword: setKeyword,
      location: setLocation,
      minRating: setMinRating,
      minReviews: setMinReviews,
    };
    setters[field]?.(value);
  };

  const handleSearchSubmit = async () => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, keyword, location, minRating, minReviews }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="space-y-8 max-w-5xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Flexible Lead Ingestion
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Import existing lead lists via JSON without API keys, load archived production data, or run live Google Maps scans.
          </p>
        </div>

        {/* Section 1: Pre-Loaded Production Data */}
        <section className="bg-gradient-to-r from-amber-500/10 via-[#121723] to-[#121723] border border-amber-500/30 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                Production Data Seeder
              </span>
              <h2 className="font-display font-semibold text-lg text-slate-100 mt-2">
                Load 88 Production Leads from Archived Data
              </h2>
              <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                Instantly populate your management system with all 88 rich Sri Lankan hospitality leads from <code className="text-amber-400 font-mono">archived_programming/lead_details.json</code> and <code className="text-amber-400 font-mono">scored_leads.json</code>, complete with ratings, review snippets, phone, email, price ranges, and pre-drafted emails!
              </p>
            </div>

            <button
              onClick={handleSeedArchived}
              disabled={seeding}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {seeding ? (
                <span>Loading 88 Leads...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Load 88 Production Leads</span>
                </>
              )}
            </button>
          </div>

          {seedMsg && (
            <div
              className={`p-3 rounded-lg text-xs font-mono ${
                seedMsg.startsWith("Error")
                  ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              }`}
            >
              {seedMsg}
            </div>
          )}
        </section>

        {/* Section 2: Bulk JSON Import */}
        <section className="bg-[#121723] border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-100">
              Bulk JSON Import (No API Key Required)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Paste any JSON lead array below. Fields like name, category, address, phone, rating, email, website will be normalized automatically into the scoring engine.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Campaign Name (Optional)
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Q3 Hospitality Outreach Import"
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono uppercase text-slate-400">
                  JSON Lead Payload
                </label>
                <button
                  type="button"
                  onClick={() => setJsonText(sampleJson)}
                  className="text-[11px] text-amber-400 hover:underline font-mono"
                >
                  Insert Sample JSON Schema
                </button>
              </div>
              <textarea
                rows={7}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='[\n  {\n    "name": "Cafe Ceylon",\n    "rating": 4.6,\n    "reviews": 200\n  }\n]'
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 leading-relaxed"
              />
            </div>

            {importMsg && (
              <div
                className={`p-3 rounded-lg text-xs font-mono ${
                  importMsg.startsWith("Error")
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                }`}
              >
                {importMsg}
              </div>
            )}

            <button
              onClick={handleJsonImport}
              disabled={importing || !jsonText.trim()}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {importing ? "Importing & Scoring Leads..." : "Import JSON Leads"}
            </button>
          </div>
        </section>

        {/* Section 3: Live Google Maps Discovery Search */}
        <section className="bg-[#121723] border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-100">
              Live Google Maps Discovery
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Search a city on Google Maps for businesses missing a website and add them as a new campaign.
            </p>
          </div>

          <SearchForm
            apiKey={apiKey}
            keyword={keyword}
            location={location}
            minRating={minRating}
            minReviews={minReviews}
            loading={searchLoading}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
          />
          {searchError && <p className="text-xs text-rose-400 font-mono">{searchError}</p>}
        </section>
      </div>
    </SidebarLayout>
  );
}
