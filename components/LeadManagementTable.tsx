"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import DispatchAgentButton from "@/components/DispatchAgentButton";
import type { PersistedLead, PipelineStage, PriorityTier } from "@/lib/types";

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
    const headers = [
      "ID",
      "Name",
      "Category",
      "Address",
      "Phone",
      "Email",
      "Rating",
      "Reviews",
      "HasWebsite",
      "OpportunityScore",
      "PriorityTier",
      "PipelineStage",
    ];

    const rows = targetLeads.map((l) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${(l.category || "").replace(/"/g, '""')}"`,
      `"${(l.address || "").replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${l.contactEmail || ""}"`,
      l.rating,
      l.reviews,
      l.hasWebsite ? "Yes" : "No",
      l.opportunityScore ?? l.leadScore ?? 0,
      l.priorityTier || "Cold",
      l.pipelineStage,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leadhunt_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        return "bg-slate-800 text-slate-300 border-slate-700";
      case "drafting":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "ready":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "sent":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "won":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "archived":
        return "bg-slate-900 text-slate-500 border-slate-800";
    }
  };

  const tierBadge = (tier?: PriorityTier | null) => {
    switch (tier) {
      case "Hot":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "Warm":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "Cold":
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-[#121723] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="w-4 h-4 absolute left-3.5 top-3 text-slate-400"
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
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Quick Stats & Export Buttons */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredLeads.length} of {leads.length} leads
            </span>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV Export
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              JSON Export
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Priority Tier
            </label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Tiers</option>
              <option value="Hot">🔥 Hot (75+ Score)</option>
              <option value="Warm">🟧 Warm (50-74 Score)</option>
              <option value="Cold">🟦 Cold (&lt;50 Score)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Pipeline Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
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
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Contact Method
            </label>
            <select
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Contact Methods</option>
              <option value="email">Has Email 📧</option>
              <option value="phone_only">Has Phone Only 📞</option>
              <option value="social_only">Has Socials Only 📱</option>
              <option value="missing_email">Missing Email ⚠️</option>
              <option value="no_contact">No Contact Info ❌</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Data Source
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
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
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
            >
              <option value="score">Opportunity Score</option>
              <option value="rating">Rating (High to Low)</option>
              <option value="reviews">Review Volume</option>
              <option value="name">Business Name</option>
            </select>
          </div>

          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={onlyMissingWebsite}
                onChange={(e) => setOnlyMissingWebsite(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
              />
              <span>No Website Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Leads Table */}
      <div className="bg-[#121723] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[10px] uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-4 w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredLeads.length > 0 &&
                      selectedIds.length === filteredLeads.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
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
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
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
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(lead.id)}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 text-sm">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="hover:text-amber-400 hover:underline transition-colors"
                          >
                            {lead.name}
                          </Link>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
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
                          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                score >= 75
                                  ? "bg-rose-500"
                                  : score >= 50
                                  ? "bg-amber-500"
                                  : "bg-slate-600"
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-200">
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
                            ? "🔥 Hot"
                            : lead.priorityTier === "Warm"
                            ? "🟧 Warm"
                            : "🟦 Cold"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs font-mono space-y-0.5">
                        {lead.contactEmail ? (
                          <div className="text-emerald-400 font-medium">{lead.contactEmail}</div>
                        ) : (
                          <div className="text-slate-500 italic text-[11px]">No email listed</div>
                        )}
                        {lead.phone && <div className="text-slate-400 text-[11px]">{lead.phone}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-amber-400 font-medium">
                          <span>★ {lead.rating > 0 ? lead.rating.toFixed(1) : "N/A"}</span>
                          <span className="text-slate-500 text-[11px] font-normal">
                            ({lead.reviews} reviews)
                          </span>
                        </div>
                        {lead.priceRange && (
                          <div className="text-[10px] text-slate-400 font-mono">
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
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition-colors"
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
