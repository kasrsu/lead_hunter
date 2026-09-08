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
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "WARN":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "ERROR":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      default:
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    }
  };

  const getCategoryBadge = (cat: ActivityLog["category"]) => {
    switch (cat) {
      case "AGENT":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "TELEGRAM":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      case "RESEND":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "CAMPAIGN":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default:
        return "bg-slate-700/50 text-slate-400 border-slate-700";
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b0e14] p-6 shadow-2xl space-y-4 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {autoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoRefresh ? "bg-emerald-400" : "bg-slate-600"}`}></span>
            </span>
            <h2 className="font-display font-bold text-base text-slate-100 flex items-center gap-2">
              <span>System Activity & Debugging Console</span>
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
            Live Feed ({filteredLogs.length})
          </span>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Categories</option>
            <option value="AGENT">🤖 AGENT</option>
            <option value="TELEGRAM">📲 TELEGRAM</option>
            <option value="RESEND">📬 RESEND</option>
            <option value="CAMPAIGN">🎯 CAMPAIGN</option>
            <option value="SYSTEM">⚙️ SYSTEM</option>
          </select>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
              autoRefresh
                ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40"
                : "bg-slate-900 text-slate-400 border-slate-800"
            }`}
          >
            {autoRefresh ? "Auto-Refresh: ON" : "Auto-Refresh: OFF"}
          </button>

          {/* Refresh Manual Button */}
          <button
            onClick={() => void fetchLogs()}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Refresh Logs Now"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Clear Logs */}
          <button
            onClick={() => void handleClear()}
            disabled={loading || logs.length === 0}
            className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/50 rounded-lg transition-colors disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Feed Terminal Window */}
      <div className="bg-[#05070a] border border-slate-900 rounded-xl p-4 max-h-72 overflow-y-auto space-y-2.5 text-xs font-mono scrollbar-thin scrollbar-thumb-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-600 italic">
            No activity logs recorded yet. Run a campaign deployment or process a lead to view live system debug logs.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-900/80 pb-2 hover:bg-slate-950/40 p-1.5 rounded transition-colors"
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

                <p className="text-slate-200 break-words leading-relaxed">{log.message}</p>

                {log.details && (
                  <p className="text-[11px] text-slate-400 italic bg-slate-950/80 border border-slate-900 p-1.5 rounded">
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
