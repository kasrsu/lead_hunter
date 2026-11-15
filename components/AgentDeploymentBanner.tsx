"use client";

import React, { useEffect, useState } from "react";
import type { AgentDeploymentState } from "@/lib/types";

interface AgentDeploymentBannerProps {
  onStatusChange?: (status: AgentDeploymentState) => void;
}

export default function AgentDeploymentBanner({ onStatusChange }: AgentDeploymentBannerProps) {
  const [status, setStatus] = useState<AgentDeploymentState | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/agent/deploy");
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      if (onStatusChange) onStatusChange(data.status);
    } catch {
      // best-effort polling
    }
  };

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handlePauseResume = async () => {
    if (!status) return;
    try {
      const action = status.isPaused ? "resume" : "pause";
      await fetch("/api/agent/deploy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await fetchStatus();
    } catch {
      // best-effort
    }
  };

  const handleStop = async () => {
    try {
      await fetch("/api/agent/deploy", { method: "DELETE" });
      await fetchStatus();
    } catch {
      // best-effort
    }
  };

  if (!status || !status.isRunning) return null;

  const pct = status.totalLeads > 0 ? Math.round((status.processedCount / status.totalLeads) * 100) : 0;

  return (
    <div className="mb-6 overflow-hidden bg-white/80 backdrop-blur-xl border border-orange-200/80 rounded-2xl p-4 shadow-xl shadow-orange-500/5 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Status Info */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shrink-0 shadow-md shadow-orange-500/20">
            <svg
              className={`w-5 h-5 ${status.isPaused ? "" : "animate-spin"}`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold text-orange-950 px-2 py-0.5 rounded-md bg-orange-100/80 border border-orange-200/60">
                Robot Dept {status.isPaused ? "Paused" : "Active"}
              </span>
              {status.autoSendMode ? (
                <span className="font-mono text-[10px] font-bold text-amber-950 px-2 py-0.5 rounded-md bg-amber-100/80 border border-amber-200/60">
                  Auto-Send ON
                </span>
              ) : (
                <span className="font-mono text-[10px] text-orange-800/80 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200/60">
                  Queue Mode
                </span>
              )}
              {status.telegramEnabled && (
                <span className="font-mono text-[10px] font-medium text-orange-900 px-2 py-0.5 rounded-md bg-orange-100/60 border border-orange-200/60">
                  Telegram ON
                </span>
              )}
            </div>

            <h4 className="font-display font-semibold text-sm text-slate-900">
              {status.currentLeadName
                ? `Processing: "${status.currentLeadName}"`
                : "Robot department execution active..."}
            </h4>

            {status.currentStepMessage && (
              <p className="text-xs text-orange-800/80 font-mono">
                {status.currentStepMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right Progress & Pause/Stop Controls */}
        <div className="flex items-center gap-3 min-w-[280px]">
          <div className="flex-1 space-y-1 text-right">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-orange-800/70">Progress</span>
              <span className="text-orange-950 font-bold">
                {status.processedCount} / {status.totalLeads} ({pct}%)
              </span>
            </div>
            <div className="h-2 w-full bg-orange-100/60 rounded-full overflow-hidden border border-orange-200/60">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePauseResume}
              className="px-3 py-1.5 bg-white hover:bg-orange-50 text-orange-950 border border-orange-200 text-xs font-mono font-bold rounded-xl transition-all shadow-xs"
            >
              {status.isPaused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={handleStop}
              className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-md shadow-orange-500/20"
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
