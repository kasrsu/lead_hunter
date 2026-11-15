"use client";

import { useState, useMemo } from "react";
import type { Lead } from "@/lib/types";
import { LOCATION_DICTIONARY, getCountryByCode } from "@/lib/constants/locationDictionary";

interface DeepScraperCardProps {
  onLeadsFetched: (leads: Lead[], statusMsg: string) => void;
}

const POPULAR_NICHES = [
  { label: "☕ Cafes & Restaurants", value: "Restaurant" },
  { label: "🏨 Boutique Hotels & Villas", value: "Boutique Hotel" },
  { label: "🦷 Dental Clinics", value: "Dental Clinic" },
  { label: "🏠 Roofing Contractors", value: "Roofing Contractor" },
  { label: "💻 Software & Web Agencies", value: "Software Agency" },
  { label: "🏋️ Gyms & Fitness Studios", value: "Gym" },
];

export default function DeepScraperCard({ onLeadsFetched }: DeepScraperCardProps) {
  const [businessType, setBusinessType] = useState("Restaurant");
  
  // Linked Location Dropdowns
  const [selectedCountryCode, setSelectedCountryCode] = useState("LK");
  const [selectedCity, setSelectedCity] = useState("Colombo");
  const [customCity, setCustomCity] = useState("");
  const [isCustomCityMode, setIsCustomCityMode] = useState(false);

  const [maxLeads, setMaxLeads] = useState<number>(25);
  const [minRating, setMinRating] = useState<number>(0);
  const [hasWebsiteFilter, setHasWebsiteFilter] = useState<"all" | "no" | "yes">("all");
  const [enableEnrichment, setEnableEnrichment] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const currentCountry = useMemo(
    () => getCountryByCode(selectedCountryCode) || LOCATION_DICTIONARY[0],
    [selectedCountryCode]
  );

  // Compute final standardized location query without typos
  const effectiveLocation = useMemo(() => {
    const cityPart = isCustomCityMode ? customCity.trim() : selectedCity;
    if (!cityPart) return currentCountry.name;
    return `${cityPart}, ${currentCountry.name}`;
  }, [selectedCity, isCustomCityMode, customCity, currentCountry]);

  const handleCountryChange = (code: string) => {
    setSelectedCountryCode(code);
    const country = getCountryByCode(code);
    if (country && country.cities.length > 0) {
      setSelectedCity(country.cities[0]);
      setIsCustomCityMode(false);
    }
  };

  const handleCityChange = (val: string) => {
    if (val === "__CUSTOM__") {
      setIsCustomCityMode(true);
      setCustomCity("");
    } else {
      setIsCustomCityMode(false);
      setSelectedCity(val);
    }
  };

  const handleStartExtraction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");

    if (!effectiveLocation || effectiveLocation.trim() === "") {
      setErrorMsg("Please select or enter a target city.");
      return;
    }

    setLoading(true);
    setStep(1);

    // Simulated progress steps for smooth UX
    const timer1 = setTimeout(() => setStep(2), 5000);
    const timer2 = setTimeout(() => setStep(3), 15000);

    console.log("🌐 [Frontend DeepScraperCard] Launching extraction request...", {
      businessType,
      location: effectiveLocation,
      maxLeads,
      minRating,
      hasWebsiteFilter,
      skipEnrichment: !enableEnrichment,
    });

    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType,
          location: effectiveLocation,
          maxLeads,
          minRating,
          hasWebsite: hasWebsiteFilter,
          skipEnrichment: !enableEnrichment,
        }),
      });

      const data = await res.json();
      console.log("📡 [Frontend DeepScraperCard] Received API response:", data);

      if (!res.ok) {
        throw new Error(data.error || "Lead extraction failed");
      }

      const fetchedLeads: Lead[] = data.leads || [];
      const msg = enableEnrichment
        ? `✅ Success! Extracted and AI-scored ${fetchedLeads.length} verified leads in ${effectiveLocation}.`
        : `⚡ Success! Fast-scraped ${fetchedLeads.length} raw leads in ${effectiveLocation} (AI Enrichment OFF).`;
      console.log(`🎉 [Frontend DeepScraperCard] Successfully loaded ${fetchedLeads.length} leads into table.`);
      setStatusMsg(msg);
      onLeadsFetched(fetchedLeads, msg);
    } catch (err: any) {
      console.error("❌ [Frontend DeepScraperCard Error]:", err.message || err);
      setErrorMsg(err.message || "Failed to run lead extraction scraper.");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoading(false);
      setStep(1);
    }
  };

  return (
    <div className="bg-gradient-to-br from-white via-orange-50/30 to-amber-50/20 border border-orange-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-orange-500/5 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-orange-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              No API Key Required • Standardized Location Dictionary
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-950 border border-orange-200">
              Deep Web & Map Scraper
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            🌐 Parameterized Google Maps Lead Hunter
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-2xl">
            Scan any location on Google Maps using pre-verified Country & City dropdowns to eliminate typos, mine emails and phone numbers from official websites, and AI-score lead quality.
          </p>
        </div>
      </div>

      <form onSubmit={handleStartExtraction} className="space-y-6">
        {/* Quick Industry Niche Selector Pills */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Quick Niche Selectors:
          </label>
          <div className="flex flex-wrap gap-2">
            {POPULAR_NICHES.map((niche) => (
              <button
                key={niche.value}
                type="button"
                onClick={() => setBusinessType(niche.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  businessType === niche.value
                    ? "bg-orange-500 text-white border-orange-600 shadow-sm shadow-orange-500/30"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-orange-50 hover:border-orange-200"
                }`}
              >
                {niche.label}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Inputs Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* 1. Business Type Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Business Industry / Niche
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400">🏷️</span>
              <input
                type="text"
                required
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="e.g., Boutique Hotel, Restaurant, Dentist"
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-xs"
              />
            </div>
            <p className="text-[11px] text-slate-500">Target business category</p>
          </div>

          {/* 2. Country Selector Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Target Country
            </label>
            <div className="relative">
              <select
                value={selectedCountryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-xs appearance-none cursor-pointer"
              >
                {LOCATION_DICTIONARY.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-3 text-slate-400">
                ▼
              </div>
            </div>
            <p className="text-[11px] text-slate-500">Standardized country dictionary</p>
          </div>

          {/* 3. City Selector Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Target City / Area
            </label>
            <div className="relative">
              <select
                value={isCustomCityMode ? "__CUSTOM__" : selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-xs appearance-none cursor-pointer"
              >
                {currentCountry.cities.map((city) => (
                  <option key={city} value={city}>
                    📍 {city}
                  </option>
                ))}
                <option value="__CUSTOM__">✍️ Custom City/Area...</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-3 text-slate-400">
                ▼
              </div>
            </div>
            <p className="text-[11px] text-slate-500">Major commercial hubs</p>
          </div>
        </div>

        {/* Optional Custom City Input when selected */}
        {isCustomCityMode && (
          <div className="p-4 bg-orange-100/50 border border-orange-200 rounded-xl space-y-1.5">
            <label className="block text-xs font-bold text-orange-950 uppercase tracking-wider">
              Enter Custom Suburb, District, or Neighborhood
            </label>
            <input
              type="text"
              required
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder={`e.g. Negombo Beach or Brooklyn (${currentCountry.name})`}
              className="w-full bg-white border border-orange-300 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-orange-500 outline-none shadow-xs"
            />
            <p className="text-[11px] text-orange-800 font-medium">
              Target query will be: <span className="font-bold underline">{effectiveLocation}</span>
            </p>
          </div>
        )}

        {/* Selected Target Summary Badge */}
        <div className="flex items-center gap-2 p-3 bg-slate-900 text-white rounded-xl text-xs font-medium shadow-sm">
          <span className="text-base">🎯</span>
          <span>Target Google Maps Search Query:</span>
          <span className="font-bold text-amber-300 font-mono text-xs sm:text-sm">
            "{businessType}" in "{effectiveLocation}"
          </span>
        </div>

        {/* Lead Depth Selector Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Lead Scan Volume
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { count: 10, label: "⚡ Quick Scan", desc: "~10 Leads (Fast test)" },
              { count: 25, label: "🔍 Standard Deep", desc: "~25 Leads (Recommended)" },
              { count: 50, label: "🚀 Max Harvest", desc: "~50 Leads (Thorough search)" },
            ].map((option) => (
              <button
                key={option.count}
                type="button"
                onClick={() => setMaxLeads(option.count)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  maxLeads === option.count
                    ? "bg-orange-500/10 border-orange-500 ring-2 ring-orange-500/20"
                    : "bg-white border-slate-200 hover:border-orange-300"
                }`}
              >
                <div className="font-bold text-sm text-slate-900">{option.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters & AI Enrichment Toggle */}
        <div className="grid gap-4 sm:grid-cols-3 p-4 bg-white/80 border border-slate-200/80 rounded-xl shadow-xs items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Minimum Star Rating ({minRating === 0 ? "Any Rating" : `${minRating}★+`})
            </label>
            <input
              type="range"
              min="0"
              max="4.5"
              step="0.5"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>All ratings</span>
              <span>3.0★</span>
              <span>4.0★</span>
              <span>4.5★</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Website Filter Focus
            </label>
            <select
              value={hasWebsiteFilter}
              onChange={(e) => setHasWebsiteFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-orange-500"
            >
              <option value="all">All Verified Businesses</option>
              <option value="no">⭐ Missing Website Only (High Pitch Opportunity)</option>
              <option value="yes">Has Listed Website Only</option>
            </select>
          </div>

          {/* AI Enrichment ON / OFF Toggle Button */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              AI Scoring & Enrichment
            </label>
            <button
              type="button"
              onClick={() => setEnableEnrichment(!enableEnrichment)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-between shadow-xs ${
                enableEnrichment
                  ? "bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100"
                  : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>{enableEnrichment ? "🤖 AI Enrichment" : "⚡ Raw Scrape"}</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
                  enableEnrichment ? "bg-purple-600 text-white" : "bg-slate-500 text-white"
                }`}
              >
                {enableEnrichment ? "ON" : "OFF"}
              </span>
            </button>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              {enableEnrichment ? "Scores quality & drafts pitch copy" : "Fastest extraction, skips AI scoring"}
            </p>
          </div>
        </div>

        {/* Loading Progress HUD Bar */}
        {loading && (
          <div className="p-4 bg-orange-500/10 border border-orange-300 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-orange-950">
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-orange-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {step === 1 && "Step 1/3: Reading Google Maps live place listings..."}
                {step === 2 && "Step 2/3: Mining official websites & web search for emails & phones..."}
                {step === 3 && "Step 3/3: AI Scoring leads & building outreach drafts..."}
              </span>
              <span className="font-mono text-orange-700">{step * 33}%</span>
            </div>
            <div className="w-full bg-orange-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-500 to-amber-500 h-full transition-all duration-700 rounded-full"
                style={{ width: `${step * 33}%` }}
              ></div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {statusMsg && !loading && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <span>🎉</span>
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Submit Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 border-t border-white/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          {loading ? (
            <span>Processing Deep Extraction...</span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Start Deep Lead Extraction ({businessType} in {effectiveLocation})</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
