"use client";

import { useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import GoogleCategorySelect from "@/components/GoogleCategorySelect";
import LocationMapPicker from "@/components/LocationMapPicker";
import QuotaCostBadge from "@/components/QuotaCostBadge";
import LeadTable from "@/components/LeadTable";
import SavedSearchesList from "@/components/SavedSearchesList";
import TelegramConfigModal from "@/components/TelegramConfigModal";
import DeepScraperCard from "@/components/DeepScraperCard";
import type { Lead } from "@/lib/types";

export default function LeadHunterPage() {
  const [searchMode, setSearchMode] = useState<"deep_miner" | "places_api">("deep_miner");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["roofers"]);

  const [selectedIncludedTypes, setSelectedIncludedTypes] = useState<string[]>(["roofing_contractor"]);
  const [location, setLocation] = useState("Chicago, IL");
  const [mapBounds, setMapBounds] = useState<{ lat?: number; lng?: number; radiusMeters?: number }>({
    radiusMeters: 10000,
  });

  const [apiKey, setApiKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"auto" | "claude" | "ollama">("auto");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");

  const [minRating, setMinRating] = useState<number>(0);
  const [minReviews, setMinReviews] = useState<number>(0);
  const [hasWebsiteFilter, setHasWebsiteFilter] = useState<"all" | "yes" | "no">("all");

  const [leads, setLeads] = useState<(Lead & { generatedOpener?: string; isEnriching?: boolean })[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [searchStatusMsg, setSearchStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [lastSearchCost, setLastSearchCost] = useState<number>(0);
  const [lastSearchCacheHit, setLastSearchCacheHit] = useState<boolean>(false);

  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const handleRunSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setSearchStatusMsg("");
    setLoadingSearch(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: selectedCategories,
          includedTypes: selectedIncludedTypes,
          location,
          apiKey: apiKey || undefined,
          minRating,
          minReviews,
          hasWebsite: hasWebsiteFilter,
          maxResults: 60,
          mapBounds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch leads");
      }

      const fetchedLeads: Lead[] = data.leads || [];
      setLeads(fetchedLeads.map((l) => ({ ...l })));
      setLastSearchCost(data.estimatedCostUsd || 0);
      setLastSearchCacheHit(Boolean(data.isCacheHit));

      setSearchStatusMsg(
        data.isCacheHit
          ? `⚡ Returned ${fetchedLeads.length} cached leads (0 API cost).`
          : `✅ Fetched ${fetchedLeads.length} live leads via Google Places API (New) (Est cost: $${data.estimatedCostUsd?.toFixed(4)}).`
      );

      // Auto-trigger background opener enrichment for retrieved leads
      if (fetchedLeads.length > 0) {
        void enrichLeadsInBackground(fetchedLeads);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Search failed");
    } finally {
      setLoadingSearch(false);
    }
  };

  const enrichLeadsInBackground = async (targetLeads: Lead[]) => {
    setIsEnrichingAll(true);
    for (const lead of targetLeads) {
      setLeads((prev) =>
        prev.map((l) => (l.placeId === lead.placeId ? { ...l, isEnriching: true } : l))
      );

      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead,
            provider: llmProvider,
            anthropicApiKey: anthropicApiKey || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.generatedOpener) {
            setLeads((prev) =>
              prev.map((l) =>
                l.placeId === lead.placeId
                  ? { ...l, generatedOpener: data.generatedOpener, isEnriching: false }
                  : l
              )
            );
          }
        }
      } catch {
        setLeads((prev) =>
          prev.map((l) => (l.placeId === lead.placeId ? { ...l, isEnriching: false } : l))
        );
      }
    }
    setIsEnrichingAll(false);
  };

  const handleSaveCurrentSearch = async () => {
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${selectedCategories.join(", ")} in ${location}`,
          categories: selectedCategories,
          location,
          mapBounds,
          minRating,
          minReviews,
          hasWebsite: hasWebsiteFilter,
        }),
      });

      if (res.ok) {
        setSearchStatusMsg("⭐ Search saved successfully!");
      }
    } catch {
      // best effort
    }
  };

  const handleSelectSavedSearch = (saved: any) => {
    if (saved.categories) setSelectedCategories(saved.categories);
    if (saved.location) setLocation(saved.location);
    if (saved.minRating !== undefined) setMinRating(saved.minRating);
    if (saved.minReviews !== undefined) setMinReviews(saved.minReviews);
    if (saved.hasWebsite) setHasWebsiteFilter(saved.hasWebsite);
  };

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Header Hero */}
        <section className="relative overflow-hidden glass-panel rounded-2xl p-8 shadow-xl shadow-orange-500/5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-orange-800 font-bold px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200">
                Google Places API (New) • Field Masked & Cost Controlled
              </span>
              <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">
                B2B Lead Generation & Intelligence Studio
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 leading-relaxed font-medium">
                Search multi-category local businesses via official Places API (New), enforce strict field masking & 30-day cache limits, generate personalized cold openers via Claude/Ollama, and export complete result sets to CSV.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowTelegramModal(true)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2"
              >
                ✈️ Workspace Telegram Bot
              </button>
            </div>
          </div>
        </section>

        {/* Cost & Quota HUD Badge */}
        <QuotaCostBadge lastSearchCost={lastSearchCost} lastSearchCacheHit={lastSearchCacheHit} />

        {/* Saved Searches Drawer */}
        <SavedSearchesList onSelectSearch={handleSelectSavedSearch} />

        {/* Mode Switcher Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => setSearchMode("deep_miner")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              searchMode === "deep_miner"
                ? "bg-white text-orange-950 shadow-md border border-orange-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🌐 Deep Web & Map Miner</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-extrabold">
              NO API KEY
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSearchMode("places_api")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              searchMode === "places_api"
                ? "bg-white text-orange-950 shadow-md border border-orange-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>⚡ Official Places API</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-extrabold">
              FAST API
            </span>
          </button>
        </div>

        {searchMode === "deep_miner" ? (
          <DeepScraperCard
            onLeadsFetched={(newLeads, msg) => {
              setLeads(newLeads.map((l) => ({ ...l })));
              setSearchStatusMsg(msg);
              if (newLeads.length > 0) {
                void enrichLeadsInBackground(newLeads);
              }
            }}
          />
        ) : (
          /* Main Search Panel (Places API) */
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xl shadow-slate-900/5 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                🔍 Parameterized Lead Search Query (Google Places API)
              </h2>
              <button
                type="button"
                onClick={handleSaveCurrentSearch}
                className="text-xs font-mono font-bold text-orange-600 hover:text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl transition-colors"
              >
                ⭐ Save This Search
              </button>
            </div>

            <form onSubmit={handleRunSearch} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Category Dropdown & Custom Tag Input */}
                <GoogleCategorySelect
                  selectedCategories={selectedCategories}
                  onChange={setSelectedCategories}
                  selectedIncludedTypes={selectedIncludedTypes}
                  onIncludedTypesChange={setSelectedIncludedTypes}
                />

                {/* Location Input & Visual Radius Picker */}
                <LocationMapPicker
                  location={location}
                  onLocationChange={setLocation}
                  mapBounds={mapBounds}
                  onMapBoundsChange={setMapBounds}
                />
              </div>

              {/* Filter & Advanced Parameters Bar */}
              <div className="grid gap-4 sm:grid-cols-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div>
                  <label className="block text-[11px] font-mono font-bold text-slate-600 uppercase">Min Rating</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold text-slate-600 uppercase">Min Review Count</label>
                  <input
                    type="number"
                    min="0"
                    value={minReviews}
                    onChange={(e) => setMinReviews(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold text-slate-600 uppercase">Website Requirement</label>
                  <select
                    value={hasWebsiteFilter}
                    onChange={(e) => setHasWebsiteFilter(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                  >
                    <option value="all">All Businesses</option>
                    <option value="no">No Website Only (Pitch Lead)</option>
                    <option value="yes">Has Website Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold text-slate-600 uppercase">LLM Engine</label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none font-medium text-orange-800"
                  >
                    <option value="auto">Auto (Claude or Ollama)</option>
                    <option value="claude">Anthropic Claude API</option>
                    <option value="ollama">Local Ollama API</option>
                  </select>
                </div>
              </div>

              {/* Optional Credentials Panel */}
              <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-[11px] font-mono text-slate-500">Google Places API Key (Optional if set in .env):</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                </div>

                <div className="flex-1 min-w-[220px]">
                  <label className="block text-[11px] font-mono text-slate-500">Anthropic Claude API Key (Optional if set in .env):</label>
                  <input
                    type="password"
                    value={anthropicApiKey}
                    onChange={(e) => setAnthropicApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                  ⚠️ {errorMsg}
                </div>
              )}

              {searchStatusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
                  {searchStatusMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingSearch}
                className="w-full py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 border-t border-white/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingSearch ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Querying Google Places API (New)...
                  </>
                ) : (
                  `⚡ Search Leads (${selectedCategories.join(", ") || "All Categories"} in ${location})`
                )}
              </button>
            </form>
          </section>
        )}

        {/* Lead Results Table View */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-slate-900">
              Discovered Businesses ({leads.length})
            </h2>
          </div>

          <LeadTable
            leads={leads}
            onEnrichSingleLead={(lead) => enrichLeadsInBackground([lead])}
            onEnrichAll={() => enrichLeadsInBackground(leads.filter((l) => !l.generatedOpener))}
            isEnrichingAll={isEnrichingAll}
          />
        </section>
      </div>

      {/* Session-isolated Telegram Bot Modal */}
      <TelegramConfigModal
        isOpen={showTelegramModal}
        onClose={() => setShowTelegramModal(false)}
      />
    </SidebarLayout>
  );
}
