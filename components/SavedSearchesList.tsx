"use client";

import { useEffect, useState } from "react";
import type { SavedSearch } from "@/lib/repositories/savedSearches";
import { exportSavedSearchesToCsv } from "@/lib/csvExport";

interface SavedSearchesListProps {
  onSelectSearch: (search: SavedSearch) => void;
}

export default function SavedSearchesList({ onSelectSearch }: SavedSearchesListProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSavedSearches = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saved-searches");
      if (!res.ok) return;
      const data = await res.json();
      setSearches(data.searches || []);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSavedSearches();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved-searches?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // best-effort
    }
  };

  const handleExportCsv = () => {
    exportSavedSearchesToCsv(searches, `saved_searches_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (searches.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
          <span>⭐ Saved Searches ({searches.length})</span>
        </h3>

        <button
          type="button"
          onClick={handleExportCsv}
          className="text-xs font-mono font-bold text-orange-600 hover:underline"
        >
          📥 Export CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {searches.map((search) => (
          <div
            key={search.id}
            onClick={() => onSelectSearch(search)}
            className="p-3.5 bg-slate-50 hover:bg-orange-50/50 border border-slate-200 hover:border-orange-300 rounded-xl cursor-pointer transition-all space-y-2 group relative shadow-2xs"
          >
            <div className="flex items-start justify-between">
              <h4 className="font-bold text-sm text-slate-900 group-hover:text-orange-700 truncate pr-6">
                {search.name}
              </h4>
              <button
                type="button"
                onClick={(e) => handleDelete(search.id, e)}
                className="text-slate-400 hover:text-red-600 text-sm font-bold absolute top-3 right-3"
                title="Delete saved search"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {search.categories.map((c) => (
                <span key={c} className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded text-[10px] font-semibold">
                  {c}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
              <span>📍 {search.location}</span>
              <span>{new Date(search.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
