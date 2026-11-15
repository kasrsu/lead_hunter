"use client";

interface SearchFormProps {
  keyword: string;
  location: string;
  apiKey: string;
  minRating: number;
  minReviews: number;
  targetSegment?: string;
  loading: boolean;
  onChange: (field: string, value: string | number) => void;
  onSubmit: () => void;
}

export default function SearchForm({
  keyword,
  location,
  apiKey,
  minRating,
  minReviews,
  targetSegment = "underdog",
  loading,
  onChange,
  onSubmit,
}: SearchFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-5 rounded-2xl border border-orange-200/80 bg-white/90 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-mono uppercase text-orange-950 font-bold">
          <span>Google Places API key</span>
          <input
            type="password"
            required
            value={apiKey}
            onChange={(e) => onChange("apiKey", e.target.value)}
            placeholder="AIzaSy..."
            className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none font-medium shadow-xs"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-mono uppercase text-orange-950 font-bold">
          <span>Business type / Cuisine</span>
          <input
            required
            value={keyword}
            onChange={(e) => onChange("keyword", e.target.value)}
            placeholder="French restaurant"
            className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2.5 font-sans text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none font-medium shadow-xs"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-mono uppercase text-orange-950 font-bold">
          <span>Target City / Location</span>
          <input
            required
            value={location}
            onChange={(e) => onChange("location", e.target.value)}
            placeholder="New York, NY"
            className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2.5 font-sans text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none font-medium shadow-xs"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-mono uppercase text-orange-950 font-bold">
          <span>Target Audience Segment</span>
          <select
            value={targetSegment}
            onChange={(e) => onChange("targetSegment", e.target.value)}
            className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2.5 font-sans text-sm text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none font-medium shadow-xs"
          >
            <option value="underdog">🎯 Underdogs (No Website / Small Spots - Original Plan)</option>
            <option value="established">🏆 Established High-Review Icons (Ops/VIP Pitch)</option>
            <option value="all">🌐 All Matching Businesses</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-mono uppercase text-orange-950 font-bold">
          <span>Minimum rating</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={minRating}
            onChange={(e) => onChange("minRating", Number(e.target.value))}
            className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none font-medium shadow-xs"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-mono uppercase text-orange-950 font-bold">
          <span>Minimum reviews</span>
          <input
            type="number"
            min={0}
            value={minReviews}
            onChange={(e) => onChange("minReviews", Number(e.target.value))}
            className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none font-medium shadow-xs"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full py-3 rounded-xl bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs border-t border-white/30 shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>{loading ? "Scanning Google Maps…" : "Scan Google Maps for Leads"}</span>
      </button>
    </form>
  );
}
