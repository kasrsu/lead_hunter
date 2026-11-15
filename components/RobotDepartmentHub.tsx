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
    <section className="relative overflow-hidden glass-panel rounded-2xl p-6 shadow-xl shadow-orange-500/5 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-orange-200/80 pb-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-orange-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-orange-800 px-2.5 py-0.5 rounded bg-orange-100 border border-orange-200">
                Robot Department Command Center
              </span>
              {isRunning && !isPaused && (
                <span className="font-mono text-[10px] font-bold text-white px-2 py-0.5 rounded bg-gradient-to-r from-orange-500 to-amber-500 animate-pulse shadow-xs">
                  ● ACTIVE RUNNING
                </span>
              )}
              {isRunning && isPaused && (
                <span className="font-mono text-[10px] font-bold text-amber-900 px-2 py-0.5 rounded bg-amber-100 border border-amber-200">
                  PAUSED
                </span>
              )}
              {!isRunning && (
                <span className="font-mono text-[10px] font-bold text-slate-600 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                  IDLE
                </span>
              )}
            </div>

            <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
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
            className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all flex items-center gap-1.5 ${
              autoSend
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white border-orange-500 shadow-xs"
                : "bg-white text-slate-700 border-orange-200 hover:bg-orange-50"
            }`}
            title="Toggle between Human Approval Queue and Autonomous Parallel Auto-Send"
          >
            <span>{autoSend ? "Auto-Send: ON" : "Approval Queue: ON"}</span>
          </button>

          {/* Pause / Resume Button */}
          {isRunning && (
            <button
              onClick={handlePauseResume}
              disabled={loadingAction}
              className="px-3.5 py-2 bg-white hover:bg-orange-50 text-slate-800 border border-orange-200 font-mono text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>{isPaused ? "Resume Dept" : "Pause Dept"}</span>
            </button>
          )}

          {/* Seed Sample Leads Button */}
          {!isRunning && (
            <button
              onClick={handleSeed}
              disabled={loadingAction}
              className="px-3.5 py-2 bg-white hover:bg-orange-50 text-slate-700 border border-orange-200/80 font-mono text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
              title="Seed production sample leads into the database"
            >
              <span>Seed Leads</span>
            </button>
          )}

          {/* Deploy / Stop Button */}
          {!isRunning ? (
            <button
              onClick={() => void handleStart(autoSend)}
              disabled={loadingAction}
              className="px-5 py-2 bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 border-t border-white/30 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Deploy Robot Dept</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loadingAction}
              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-200 text-xs font-mono font-bold rounded-xl transition-colors"
            >
              Stop Robot Dept
            </button>
          )}
        </div>
      </div>

      {/* Error alert banner */}
      {status?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 text-xs font-mono font-semibold flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>[ALERT]</span>
            <span>{status.error}</span>
          </div>
          <button
            onClick={handleSeed}
            disabled={loadingAction}
            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold rounded-lg transition-all text-xs flex items-center gap-1 shrink-0 shadow-xs"
          >
            <span>Seed Sample Leads</span>
          </button>
        </div>
      )}


      {/* 3 Robot Department Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white/90 border border-orange-200/80 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-orange-800 uppercase font-bold">
              Research Robot
            </span>
            <span className="text-xs font-mono text-orange-600 font-bold">Active</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {status?.processedCount || 0} <span className="text-xs font-normal text-slate-500">/ {status?.totalLeads || 0} leads</span>
          </p>
          <span className="text-[10px] text-slate-500 font-mono font-medium block">
            Calculates 4-part metrics & digital gap signals
          </span>
        </div>

        <div className="p-4 bg-white/90 border border-orange-200/80 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-orange-800 uppercase font-bold">
              Copywriter Robot
            </span>
            <span className="text-xs font-mono text-orange-600 font-bold">Active</span>
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900">
            {status?.successCount || 0} <span className="text-xs font-normal text-slate-500">drafts generated</span>
          </p>
          <span className="text-[10px] text-slate-500 font-mono font-medium block">
            Runs LangGraph AI drafting & critique loop
          </span>
        </div>

        <div className="p-4 bg-white/90 border border-orange-200/80 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-orange-800 uppercase font-bold">
              Outbound Dispatcher
            </span>
            <span className="text-xs font-mono text-emerald-700 font-bold">
              {autoSend ? "Auto-Send" : "Queue Mode"}
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-700">
            {status?.sentCount || 0} <span className="text-xs font-normal text-slate-500">emails sent</span>
          </p>
          <span className="text-[10px] text-slate-500 font-mono font-medium block">
            {autoSend ? "Parallel automated email dispatch active" : "Drafts queued in Approval Queue"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono font-semibold">
            <span className="text-slate-600 font-medium">Batch Progress</span>
            <span className="text-orange-600 font-bold">{pct}% Complete ({status?.processedCount} of {status?.totalLeads})</span>
          </div>
          <div className="h-2.5 w-full bg-orange-100 rounded-full overflow-hidden border border-orange-200">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Live Robot Terminal Feed Console */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-orange-800 uppercase tracking-wider font-bold flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Live Robot Terminal Stream</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono font-medium">Real-time log events</span>
        </div>

        <div className="bg-orange-50/50 border border-orange-200/80 rounded-xl p-4 font-mono text-xs space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
          {(!status?.logs || status.logs.length === 0) ? (
            <p className="text-slate-500 italic">No activity logs yet. Click &quot;Deploy Robot Dept&quot; to launch execution.</p>
          ) : (
            status.logs.map((log) => {
              const isErr = log.type === "error";
              const isSucc = log.type === "success";
              const isWarn = log.type === "warning";

              return (
                <div key={log.id} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span className="text-orange-700 font-bold shrink-0">[{log.robot}]</span>
                  <span
                    className={
                      isErr
                        ? "text-rose-700 font-semibold"
                        : isSucc
                        ? "text-emerald-700 font-semibold"
                        : isWarn
                        ? "text-amber-800 font-semibold"
                        : "text-slate-800 font-medium"
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
