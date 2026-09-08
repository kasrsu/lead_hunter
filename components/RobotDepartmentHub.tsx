"use client";

import React, { useEffect, useState } from "react";
import type { AgentDeploymentState } from "@/lib/types";

export default function RobotDepartmentHub() {
  const [status, setStatus] = useState<AgentDeploymentState | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/agent/deploy");
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
    } catch {
      // best-effort polling
    }
  };

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (autoSend = false) => {
    setLoadingAction(true);
    try {
      await fetch("/api/agent/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSend }),
      });
      await fetchStatus();
    } catch {
      // best-effort
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePauseResume = async () => {
    if (!status) return;
    setLoadingAction(true);
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
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleAutoSend = async () => {
    if (!status) return;
    setLoadingAction(true);
    try {
      await fetch("/api/agent/deploy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleAutoSend", autoSend: !status.autoSendMode }),
      });
      await fetchStatus();
    } catch {
      // best-effort
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStop = async () => {
    setLoadingAction(true);
    try {
      await fetch("/api/agent/deploy", { method: "DELETE" });
      await fetchStatus();
    } catch {
      // best-effort
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSeed = async () => {
    setLoadingAction(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      await fetchStatus();
    } catch {
      // best-effort
    } finally {
      setLoadingAction(false);
    }
  };

  const isRunning = status?.isRunning ?? false;
  const isPaused = status?.isPaused ?? false;
  const autoSend = status?.autoSendMode ?? false;
  const pct = status && status.totalLeads > 0 ? Math.round((status.processedCount / status.totalLeads) * 100) : 0;


  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0F131C] p-6 shadow-2xl space-y-6">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
      />

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg shadow-amber-500/20">
            🤖
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-amber-400 px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                Robot Department Command Center
              </span>
              {isRunning && !isPaused && (
                <span className="font-mono text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 animate-pulse">
                  ● ACTIVE RUNNING
                </span>
              )}
              {isRunning && isPaused && (
                <span className="font-mono text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                  ⏸️ PAUSED
                </span>
              )}
              {!isRunning && (
                <span className="font-mono text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                  IDLE
                </span>
              )}
            </div>

            <h2 className="font-display text-xl font-bold text-slate-100 mt-1">
              Autonomous Multi-Robot Lead Processing Pipeline
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switch Toggle */}
          <button
            onClick={handleToggleAutoSend}
            disabled={loadingAction}
            className={`px-3 py-2 rounded-lg text-xs font-mono font-semibold border transition-all flex items-center gap-1.5 ${
              autoSend
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Toggle between Human Approval Queue and Autonomous Parallel Auto-Send"
          >
            <span>{autoSend ? "⚡ Auto-Send: ON" : "🛡️ Approval Queue: ON"}</span>
          </button>

          {/* Pause / Resume Button */}
          {isRunning && (
            <button
              onClick={handlePauseResume}
              disabled={loadingAction}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-mono text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>{isPaused ? "▶️ Resume Dept" : "⏸️ Pause Dept"}</span>
            </button>
          )}

          {/* Seed Sample Leads Button */}
          {!isRunning && (
            <button
              onClick={handleSeed}
              disabled={loadingAction}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              title="Seed production sample leads into the database"
            >
              <span>🌱 Seed Leads</span>
            </button>
          )}

          {/* Deploy / Stop Button */}
          {!isRunning ? (
            <button
              onClick={() => void handleStart(autoSend)}
              disabled={loadingAction}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>🚀 Deploy Robot Dept</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loadingAction}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold rounded-lg transition-colors"
            >
              Stop Robot Dept
            </button>
          )}
        </div>
      </div>

      {/* Error alert banner */}
      {status?.error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-rose-300 text-xs font-mono flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{status.error}</span>
          </div>
          <button
            onClick={handleSeed}
            disabled={loadingAction}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all text-xs flex items-center gap-1 shrink-0"
          >
            <span>🌱 Seed Sample Leads</span>
          </button>
        </div>
      )}


      {/* 3 Robot Department Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase font-semibold">
              🔍 Research Robot
            </span>
            <span className="text-xs font-mono text-amber-400 font-bold">Active</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-100">
            {status?.processedCount || 0} <span className="text-xs font-normal text-slate-500">/ {status?.totalLeads || 0} leads</span>
          </p>
          <span className="text-[10px] text-slate-400 font-mono block">
            Calculates 4-part metrics & digital gap signals
          </span>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase font-semibold">
              📝 Copywriter Robot
            </span>
            <span className="text-xs font-mono text-amber-400 font-bold">Active</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-100">
            {status?.successCount || 0} <span className="text-xs font-normal text-slate-500">drafts generated</span>
          </p>
          <span className="text-[10px] text-slate-400 font-mono block">
            Runs LangGraph AI drafting & critique loop
          </span>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase font-semibold">
              ✉️ Outbound Dispatcher
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {autoSend ? "Auto-Send" : "Queue Mode"}
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400">
            {status?.sentCount || 0} <span className="text-xs font-normal text-slate-500">emails sent</span>
          </p>
          <span className="text-[10px] text-slate-400 font-mono block">
            {autoSend ? "Parallel automated email dispatch active" : "Drafts queued in Approval Queue"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400 font-medium">Batch Progress</span>
            <span className="text-amber-400 font-bold">{pct}% Complete ({status?.processedCount} of {status?.totalLeads})</span>
          </div>
          <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Live Robot Terminal Feed Console */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <span>📜</span> Live Robot Terminal Stream
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Real-time log events</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
          {(!status?.logs || status.logs.length === 0) ? (
            <p className="text-slate-400 italic">No activity logs yet. Click &quot;🚀 Deploy Robot Dept&quot; to launch execution.</p>
          ) : (
            status.logs.map((log) => {
              const isErr = log.type === "error";
              const isSucc = log.type === "success";
              const isWarn = log.type === "warning";

              return (
                <div key={log.id} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                  <span className="text-slate-400 shrink-0">[{log.timestamp}]</span>
                  <span className="text-amber-400 font-semibold shrink-0">[{log.robot}]</span>
                  <span
                    className={
                      isErr
                        ? "text-rose-400 font-semibold"
                        : isSucc
                        ? "text-emerald-300 font-medium"
                        : isWarn
                        ? "text-amber-300"
                        : "text-slate-300"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
