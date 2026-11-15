"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";
import { exportLeadsToCsv } from "@/lib/csvExport";

interface LeadTableProps {
  leads: (Lead & { generatedOpener?: string; isEnriching?: boolean })[];
  onEnrichSingleLead?: (lead: Lead) => void;
  onEnrichAll?: () => void;
  isEnrichingAll?: boolean;
}

export default function LeadTable({
  leads,
  onEnrichSingleLead,
  onEnrichAll,
  isEnrichingAll,
}: LeadTableProps) {
  const [filterRating, setFilterRating] = useState<number>(0);
  const [filterWebsite, setFilterWebsite] = useState<"all" | "yes" | "no">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = leads.filter((lead) => {
    if (lead.rating < filterRating) return false;
    if (filterWebsite === "yes" && !lead.website) return false;
    if (filterWebsite === "no" && lead.website) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = lead.name.toLowerCase().includes(q);
      const matchAddr = lead.address.toLowerCase().includes(q);
      const matchCat = (lead.category || "").toLowerCase().includes(q);
      if (!matchName && !matchAddr && !matchCat) return false;
    }
    return true;
  });

  const handleExportCsv = () => {
    exportLeadsToCsv(filteredLeads);
  };

  return (
    <div className="space-y-4">
      {/* Table Action & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search within results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span>Website:</span>
            <select
              value={filterWebsite}
              onChange={(e) => setFilterWebsite(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none"
            >
              <option value="all">All Leads</option>
              <option value="no">No Website Only (Hot Pitch)</option>
              <option value="yes">Has Website Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span>Min Rating:</span>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none"
            >
              <option value={0}>Any Rating</option>
              <option value={3.5}>3.5+ Stars</option>
              <option value={4.0}>4.0+ Stars</option>
              <option value={4.5}>4.5+ Stars</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEnrichAll && (
            <button
              type="button"
              onClick={onEnrichAll}
              disabled={isEnrichingAll || leads.length === 0}
              className="px-3.5 py-2 bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isEnrichingAll ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Generating Openers...
                </>
              ) : (
                "✨ Enrich Openers (AI)"
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLeads.length === 0}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            📥 Export CSV ({filteredLeads.length})
          </button>
        </div>
      </div>

      {/* Main Results Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-lg shadow-slate-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Business Name & Category</th>
                <th className="py-3 px-4">Formatted Address</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Website</th>
                <th className="py-3 px-4">Rating & Reviews</th>
                <th className="py-3 px-4 min-w-[280px]">Personalized Cold Email Opener</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No matching business leads found. Run a search above to populate leads.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.placeId || lead.name} className="hover:bg-orange-50/40 transition-colors">
                    {/* Business Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">
                        <a
                          href={lead.mapsUrl || `#`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-orange-600 hover:underline flex items-center gap-1"
                        >
                          {lead.name}
                          <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                      <span className="text-[11px] text-slate-500 capitalize">{lead.category || "Local Business"}</span>
                    </td>

                    {/* Address */}
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={lead.address}>
                      {lead.address || "–"}
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-slate-800 font-semibold">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="hover:text-orange-600">
                          📞 {lead.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">No Phone</span>
                      )}
                    </td>

                    {/* Website */}
                    <td className="py-3.5 px-4">
                      {lead.website ? (
                        <a
                          href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[11px] hover:underline inline-block truncate max-w-[140px]"
                        >
                          🌐 {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-semibold text-[11px]">
                          ⚠️ No Website (Hot Lead)
                        </span>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="py-3.5 px-4 font-mono">
                      {lead.rating ? (
                        <div className="flex items-center gap-1">
                          <span className="text-amber-500 font-bold">★ {lead.rating}</span>
                          <span className="text-slate-400 text-[11px]">({lead.reviews})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unrated</span>
                      )}
                    </td>

                    {/* Generated Opener */}
                    <td className="py-3.5 px-4">
                      {lead.generatedOpener ? (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-800 text-[11px] leading-relaxed relative group">
                          <p className="font-sans font-medium">{lead.generatedOpener}</p>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(lead.generatedOpener || "")}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white border border-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold hover:bg-slate-100 shadow-2xs transition-opacity"
                            title="Copy opener text"
                          >
                            Copy
                          </button>
                        </div>
                      ) : lead.isEnriching ? (
                        <div className="flex items-center gap-2 text-orange-600 text-xs font-medium animate-pulse">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          AI Drafting Cold Opener...
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEnrichSingleLead && onEnrichSingleLead(lead)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 hover:text-orange-800 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors"
                        >
                          + Generate Opener
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
