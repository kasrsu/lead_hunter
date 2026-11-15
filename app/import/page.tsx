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
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Flexible Lead Ingestion
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Import existing lead lists via JSON without API keys, load archived production data, or run live Google Maps scans.
          </p>
        </div>

        {/* Section 1: Pre-Loaded Production Data */}
        <section className="bg-white/80 backdrop-blur-xl border border-orange-200/80 rounded-2xl p-6 shadow-xl shadow-orange-500/5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-orange-500/10 text-orange-900 border border-orange-300/60 uppercase tracking-wider">
                Production Data Seeder
              </span>
              <h2 className="font-display font-semibold text-lg text-slate-900 mt-2">
                Load 88 Production Leads from Archived Data
              </h2>
              <p className="text-xs text-slate-600 max-w-2xl mt-1 leading-relaxed">
                Instantly populate your management system with all 88 rich Sri Lankan hospitality leads from <code className="text-orange-700 font-mono font-bold">archived_programming/lead_details.json</code> and <code className="text-orange-700 font-mono font-bold">scored_leads.json</code>, complete with ratings, review snippets, phone, email, price ranges, and pre-drafted emails!
              </p>
            </div>

            <button
              onClick={handleSeedArchived}
              disabled={seeding}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
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
              className={`p-3 rounded-xl text-xs font-mono font-semibold ${
                seedMsg.startsWith("Error")
                  ? "bg-rose-100 text-rose-900 border border-rose-200"
                  : "bg-emerald-100 text-emerald-900 border border-emerald-200"
              }`}
            >
              {seedMsg}
            </div>
          )}
        </section>

        {/* Section 2: Bulk JSON Import */}
        <section className="bg-white/80 backdrop-blur-xl border border-orange-200/80 rounded-2xl p-6 space-y-4 shadow-xl shadow-orange-500/5">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900">
              Bulk JSON Import (No API Key Required)
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Paste any JSON lead array below. Fields like name, category, address, phone, rating, email, website will be normalized automatically into the scoring engine.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono uppercase text-orange-800 font-bold mb-1">
                Campaign Name (Optional)
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Q3 Hospitality Outreach Import"
                className="w-full max-w-md bg-white border border-orange-200/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 font-medium shadow-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono uppercase text-orange-800 font-bold">
                  JSON Lead Payload
                </label>
                <button
                  type="button"
                  onClick={() => setJsonText(sampleJson)}
                  className="text-[11px] text-orange-600 hover:underline font-mono font-bold"
                >
                  Insert Sample JSON Schema
                </button>
              </div>
              <textarea
                rows={7}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='[\n  {\n    "name": "Cafe Ceylon",\n    "rating": 4.6,\n    "reviews": 200\n  }\n]'
                className="w-full bg-white border border-orange-200/80 rounded-xl p-4 font-mono text-xs text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 leading-relaxed shadow-xs"
              />
            </div>

            {importMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-mono font-semibold ${
                  importMsg.startsWith("Error")
                    ? "bg-rose-100 text-rose-900 border border-rose-200"
                    : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                }`}
              >
                {importMsg}
              </div>
            )}

            <button
              onClick={handleJsonImport}
              disabled={importing || !jsonText.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold text-xs rounded-xl transition-all disabled:opacity-50 shadow-md shadow-orange-500/20"
            >
              {importing ? "Importing & Scoring Leads..." : "Import JSON Leads"}
            </button>
          </div>
        </section>

        {/* Section 3: Live Google Maps Discovery Search */}
        <section className="bg-white/80 backdrop-blur-xl border border-orange-200/80 rounded-2xl p-6 space-y-4 shadow-xl shadow-orange-500/5">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">
              Live Google Maps Discovery
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
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
          {searchError && <p className="text-xs text-rose-600 font-mono font-bold">{searchError}</p>}
        </section>
      </div>
    </SidebarLayout>
  );
}
