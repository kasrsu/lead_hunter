"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import DispatchAgentButton from "@/components/DispatchAgentButton";
import type { PersistedLead, PipelineStage, PriorityTier } from "@/lib/types";
import { exportLeadsToCsv } from "@/lib/csvExport";

interface LeadManagementTableProps {
  initialLeads: PersistedLead[];
  onRefresh?: () => void;
}

export default function LeadManagementTable({
  initialLeads,
  onRefresh,
}: LeadManagementTableProps) {
  const [leads, setLeads] = useState<PersistedLead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<string>("all");
  const [onlyMissingWebsite, setOnlyMissingWebsite] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "rating" | "reviews" | "name">("score");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  // Sync state if initialLeads updates
  React.useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  // Filter & Sort
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        if (search) {
          const q = search.toLowerCase();
          const matchName = lead.name.toLowerCase().includes(q);
          const matchCat = (lead.category || "").toLowerCase().includes(q);
          const matchAddr = (lead.address || "").toLowerCase().includes(q);
          const matchPhone = (lead.phone || "").includes(q);
          const matchEmail = (lead.contactEmail || "").toLowerCase().includes(q);
          if (!matchName && !matchCat && !matchAddr && !matchPhone && !matchEmail) {
            return false;
          }
        }
        if (selectedTier !== "all" && lead.priorityTier !== selectedTier) {
          return false;
        }
        if (selectedStage !== "all" && lead.pipelineStage !== selectedStage) {
          return false;
        }
        if (selectedSource !== "all" && lead.source !== selectedSource) {
          return false;
        }
        if (selectedContact !== "all") {
          const hasEm = Boolean(lead.contactEmail);
          const hasPh = Boolean(lead.phone);
          const hasSoc = Boolean(lead.instagram || lead.facebook);

          if (selectedContact === "email" && !hasEm) return false;
          if (selectedContact === "phone_only" && (!hasPh || hasEm)) return false;
          if (selectedContact === "social_only" && (!hasSoc || hasEm || hasPh)) return false;
          if (selectedContact === "missing_email" && hasEm) return false;
          if (selectedContact === "no_contact" && (hasEm || hasPh)) return false;
        }
        if (onlyMissingWebsite && lead.hasWebsite) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score") {
          return (b.opportunityScore ?? b.leadScore ?? 0) - (a.opportunityScore ?? a.leadScore ?? 0);
        }
        if (sortBy === "rating") {
          return b.rating - a.rating;
        }
        if (sortBy === "reviews") {
          return b.reviews - a.reviews;
        }
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [leads, search, selectedTier, selectedStage, selectedSource, onlyMissingWebsite, sortBy]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredLeads.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Export handlers
  const exportCSV = () => {
    const targetLeads = leads.filter((l) =>
      selectedIds.length > 0 ? selectedIds.includes(l.id) : true
    );
    exportLeadsToCsv(targetLeads);
  };

  const exportJSON = () => {
    const targetLeads = leads.filter((l) =>
      selectedIds.length > 0 ? selectedIds.includes(l.id) : true
    );
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(targetLeads, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `leadhunt_export_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stageBadge = (stage: PipelineStage) => {
    switch (stage) {
      case "new":
        return "bg-orange-100/80 text-orange-900 border-orange-200";
      case "drafting":
        return "bg-amber-100 text-amber-900 border-amber-200";
      case "ready":
        return "bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold border-orange-400";
      case "sent":
        return "bg-emerald-100 text-emerald-900 border-emerald-200";
      case "won":
        return "bg-purple-100 text-purple-900 border-purple-200";
      case "archived":
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const tierBadge = (tier?: PriorityTier | null) => {
    switch (tier) {
      case "Hot":
        return "bg-rose-100 text-rose-900 border-rose-200";
      case "Warm":
        return "bg-amber-100 text-amber-900 border-amber-200";
      case "Cold":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="glass-panel rounded-2xl p-5 space-y-4 shadow-xl shadow-orange-500/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="w-4 h-4 absolute left-3.5 top-3 text-orange-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by business name, category, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-orange-200/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 shadow-xs"
            />
          </div>

          {/* Quick Stats & Export Buttons */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-orange-800 font-mono font-semibold">
              Showing {filteredLeads.length} of {leads.length} leads
            </span>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-orange-50/80 border border-orange-200/80 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV Export
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-orange-50/80 border border-orange-200/80 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              JSON Export
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 border-t border-slate-200/80 text-xs">
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1 font-semibold">
              Priority Tier
            </label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-900"
            >
              <option value="all">All Tiers</option>
              <option value="Hot">Hot (75+ Score)</option>
              <option value="Warm">Warm (50-74 Score)</option>
              <option value="Cold">Cold (&lt;50 Score)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1 font-semibold">
              Pipeline Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-900"
            >
              <option value="all">All Stages</option>
              <option value="new">New</option>
              <option value="drafting">Drafting</option>
              <option value="ready">Ready (Awaiting Approval)</option>
              <option value="sent">Sent</option>
              <option value="won">Won</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1 font-semibold">
              Contact Method
            </label>
            <select
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-900"
            >
              <option value="all">All Contact Methods</option>
              <option value="email">Has Email</option>
              <option value="phone_only">Has Phone Only</option>
              <option value="social_only">Has Socials Only</option>
              <option value="missing_email">Missing Email</option>
              <option value="no_contact">No Contact Info</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1 font-semibold">
              Data Source
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-900"
            >
              <option value="all">All Sources</option>
              <option value="archived-preset">Archived 88 Leads</option>
              <option value="json-import">JSON Import</option>
              <option value="google-maps">Google Maps</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-white border border-orange-200/80 text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500 font-medium"
            >
              <option value="score">Opportunity Score</option>
              <option value="rating">Rating (High to Low)</option>
              <option value="reviews">Review Volume</option>
              <option value="name">Business Name</option>
            </select>
          </div>

          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none font-medium">
              <input
                type="checkbox"
                checked={onlyMissingWebsite}
                onChange={(e) => setOnlyMissingWebsite(e.target.checked)}
                className="rounded border-orange-300 bg-white text-orange-600 focus:ring-orange-500/30"
              />
              <span>No Website Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Leads Table */}
      <div className="bg-white/80 backdrop-blur-xl border border-orange-200/80 rounded-2xl overflow-hidden shadow-xl shadow-orange-500/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-orange-200/80 bg-orange-50/60 font-mono text-[10px] uppercase text-orange-800 tracking-wider font-bold">
                <th className="py-3 px-4 w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredLeads.length > 0 &&
                      selectedIds.length === filteredLeads.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-orange-300 bg-white text-orange-600 focus:ring-orange-500/30"
                  />
                </th>
                <th className="py-3 px-4">Business & Category</th>
                <th className="py-3 px-4">Opportunity Score</th>
                <th className="py-3 px-4">Priority Tier</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Rating & Reviews</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100 text-slate-800">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No leads match the current filters. Import leads or start a search scan.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const score = lead.opportunityScore ?? lead.leadScore ?? 50;
                  const isSelected = selectedIds.includes(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-orange-50/60 transition-colors ${
                        isSelected ? "bg-orange-50/90" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(lead.id)}
                          className="rounded border-orange-300 bg-white text-orange-600 focus:ring-orange-500/30"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="hover:text-orange-600 hover:underline transition-colors"
                          >
                            {lead.name}
                          </Link>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 font-medium">
                          <span>{lead.category || "Hospitality"}</span>
                          {lead.address && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[180px]">{lead.address}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-orange-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                score >= 75
                                  ? "bg-gradient-to-r from-orange-500 to-amber-500"
                                  : score >= 50
                                  ? "bg-amber-400"
                                  : "bg-slate-400"
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {score}/100
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full border ${tierBadge(
                            lead.priorityTier
                          )}`}
                        >
                          {lead.priorityTier === "Hot"
                            ? "[HOT]"
                            : lead.priorityTier === "Warm"
                            ? "[WARM]"
                            : "[COLD]"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs font-mono space-y-0.5">
                        {lead.contactEmail ? (
                          <div className="text-emerald-700 font-semibold">{lead.contactEmail}</div>
                        ) : (
                          <div className="text-slate-400 italic text-[11px]">No email listed</div>
                        )}
                        {lead.phone && <div className="text-slate-600 text-[11px]">{lead.phone}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-amber-600 font-bold">
                          <span>{lead.rating > 0 ? `${lead.rating.toFixed(1)} / 5` : "N/A"}</span>
                          <span className="text-slate-500 text-[11px] font-normal">
                            ({lead.reviews} reviews)
                          </span>
                        </div>
                        {lead.priceRange && (
                          <div className="text-[10px] text-slate-500 font-mono font-medium">
                            {lead.priceRange}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-mono font-semibold rounded-full border ${stageBadge(
                            lead.pipelineStage
                          )}`}
                        >
                          {lead.pipelineStage}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {lead.pipelineStage !== "sent" && lead.pipelineStage !== "archived" && (
                            <DispatchAgentButton
                              leadId={lead.id}
                              leadName={lead.name}
                              size="sm"
                              onDispatchComplete={() => {
                                if (onRefresh) onRefresh();
                              }}
                            />
                          )}

                          <Link
                            href={`/leads/${lead.id}`}
                            className="px-2.5 py-1 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-orange-200/80 rounded-xl text-[11px] font-semibold transition-colors shadow-xs"
                          >
                            View Lead
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
