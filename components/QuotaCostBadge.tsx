"use client";

import { useEffect, useState } from "react";
import { exportCostLogsToCsv } from "@/lib/csvExport";

interface QuotaCostBadgeProps {
  lastSearchCost?: number;
  lastSearchCacheHit?: boolean;
}

export default function QuotaCostBadge({ lastSearchCost, lastSearchCacheHit }: QuotaCostBadgeProps) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadQuotaSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/quota");
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuotaSummary();
  }, [lastSearchCost, lastSearchCacheHit]);

  const dailyCount = summary?.quota?.currentDailyCount ?? 0;
  const dailyLimit = summary?.quota?.dailyLimit ?? 1000;
  const monthlyCount = summary?.quota?.currentMonthlyCount ?? 0;
  const totalCost = summary?.totalCostUsd ?? 0;
  const dailyPercent = Math.min(100, Math.round((dailyCount / dailyLimit) * 100));

  const handleExportCostLogs = () => {
    if (summary?.logs && summary.logs.length > 0) {
      exportCostLogsToCsv(summary.logs, `api_cost_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Cost Control & Quota HUD
          </span>
          {lastSearchCacheHit && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">
              ⚡ Cache Hit ($0.00)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleExportCostLogs}
          disabled={!summary?.logs?.length}
          className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 font-mono disabled:opacity-40"
        >
          📥 Export Cost Logs CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Daily Usage</span>
          <p className="text-xl font-bold font-mono text-white">
            {dailyCount} <span className="text-xs text-slate-400 font-normal">/ {dailyLimit}</span>
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Monthly Total</span>
          <p className="text-xl font-bold font-mono text-slate-200">
            {monthlyCount} <span className="text-xs text-slate-400 font-normal">calls</span>
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Est. Running Cost</span>
          <p className="text-xl font-bold font-mono text-emerald-400">
            ${totalCost.toFixed(4)} <span className="text-[10px] text-slate-400 font-normal">USD</span>
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Current SKU Tier</span>
          <p className="text-xs font-bold font-mono text-amber-300 pt-1">
            Text Search (Pro)
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>Quota Consumption</span>
          <span>{dailyPercent}% Used</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              dailyPercent > 85 ? "bg-red-500" : dailyPercent > 50 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${dailyPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
