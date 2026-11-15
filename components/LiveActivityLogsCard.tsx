"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityLog } from "@/lib/repositories/activityLogs";

export default function LiveActivityLogsCard() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  async function handleClear() {
    if (!window.confirm("Clear all activity logs?")) return;
    setLoading(true);
    try {
      await fetch("/api/logs", { method: "DELETE" });
      setLogs([]);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (filterCategory === "ALL") return true;
    return log.category === filterCategory;
  });

  const getLevelBadge = (level: ActivityLog["level"]) => {
    switch (level) {
      case "SUCCESS":
        return "bg-emerald-100 text-emerald-900 border-emerald-200";
      case "WARN":
        return "bg-amber-100 text-amber-900 border-amber-200";
      case "ERROR":
        return "bg-rose-100 text-rose-900 border-rose-200";
      default:
        return "bg-orange-100 text-orange-900 border-orange-200";
    }
  };

  const getCategoryBadge = (cat: ActivityLog["category"]) => {
    switch (cat) {
      case "AGENT":
        return "bg-orange-100 text-orange-900 border-orange-200";
      case "TELEGRAM":
        return "bg-cyan-100 text-cyan-900 border-cyan-200";
      case "RESEND":
        return "bg-emerald-100 text-emerald-900 border-emerald-200";
      case "CAMPAIGN":
        return "bg-amber-100 text-amber-900 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <section className="glass-panel rounded-2xl p-6 shadow-xl shadow-orange-500/5 space-y-4 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {autoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoRefresh ? "bg-orange-500" : "bg-slate-400"}`}></span>
            </span>
            <h2 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
              <span>System Activity & Debugging Console</span>
            </h2>
          </div>
          <span className="text-[10px] text-orange-800 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded font-bold">
            Live Feed ({filteredLogs.length})
          </span>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white border border-orange-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1 focus:outline-none focus:border-orange-500"
          >
            <option value="ALL">All Categories</option>
            <option value="AGENT">AGENT</option>
            <option value="TELEGRAM">TELEGRAM</option>
            <option value="RESEND">RESEND</option>
            <option value="CAMPAIGN">CAMPAIGN</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
              autoRefresh
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white border-orange-500 shadow-xs"
                : "bg-white text-slate-600 border-orange-200"
            }`}
          >
            {autoRefresh ? "Auto-Refresh: ON" : "Auto-Refresh: OFF"}
          </button>

          {/* Refresh Manual Button */}
          <button
            onClick={() => void fetchLogs()}
            className="p-1.5 rounded-xl bg-white hover:bg-orange-50 border border-orange-200 text-slate-700 transition-colors"
            title="Refresh Logs Now"
          >
            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Clear Logs */}
          <button
            onClick={() => void handleClear()}
            disabled={loading || logs.length === 0}
            className="px-2.5 py-1 text-xs text-rose-800 hover:text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-200 font-bold rounded-lg transition-colors disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Feed Terminal Window */}
      <div className="bg-orange-50/50 border border-orange-200/80 rounded-xl p-4 max-h-72 overflow-y-auto space-y-2.5 text-xs font-mono scrollbar-thin">
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 italic">
            No activity logs recorded yet. Run a campaign deployment or process a lead to view live system debug logs.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-orange-100 pb-2 hover:bg-orange-100/40 p-1.5 rounded transition-colors"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>

                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getLevelBadge(log.level)}`}>
                    {log.level}
                  </span>

                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getCategoryBadge(log.category)}`}>
                    {log.category}
                  </span>
                </div>

                <p className="text-slate-900 break-words leading-relaxed font-medium">{log.message}</p>

                {log.details && (
                  <p className="text-[11px] text-slate-600 italic bg-white border border-orange-200/80 p-1.5 rounded">
                    {log.details}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
