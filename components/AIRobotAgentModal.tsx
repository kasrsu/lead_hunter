"use client";

import React, { useEffect, useState } from "react";

interface AIRobotAgentModalProps {
  isOpen: boolean;
  leadId?: string;
  leadName?: string;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

const AGENT_STEPS = [
  { id: 1, label: "Fetch Lead Context", desc: "Reading Google Maps signals & rating data...", icon: "🔍" },
  { id: 2, label: "Evaluate Scoring & Tier", desc: "Analyzing 4-part scoring rubric & classification...", icon: "📊" },
  { id: 3, label: "LangGraph LLM Critique", desc: "Running local Ollama critique pass on draft...", icon: "🧐" },
  { id: 4, label: "Telegram Dispatch", desc: "Submitting interactive message to Telegram bot...", icon: "📲" },
  { id: 5, label: "Awaiting Human Approval", desc: "Waiting for your click on Telegram (✅ Approve / ❌ Reject)...", icon: "⏳" },
  { id: 6, label: "Dispatch Completed", desc: "Pipeline stage updated & result saved to database!", icon: "🚀" },
];

export default function AIRobotAgentModal({
  isOpen,
  leadId,
  leadName = "Business Lead",
  onClose,
  onSuccess,
}: AIRobotAgentModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // Robot expression state: "thinking" | "critiquing" | "waiting" | "success" | "archived" | "error"
  const [robotState, setRobotState] = useState<"thinking" | "critiquing" | "waiting" | "success" | "archived" | "error">("thinking");

  useEffect(() => {
    if (!isOpen || !leadId) {
      setCurrentStep(0);
      setIsDone(false);
      setErrorMsg(null);
      setDispatchResult(null);
      setRobotState("thinking");
      return;
    }

    let isMounted = true;

    // Step animation interval while waiting for backend
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < 3) return prev + 1; // Advance steps 0->3 quickly
        return prev;
      });
    }, 1200);

    // Call Next.js /api/leads/[id]/dispatch
    async function triggerDispatch() {
      try {
        setRobotState("critiquing");
        const res = await fetch(`/api/leads/${leadId}/dispatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Dispatch failed");
        }

        if (isMounted) {
          setDispatchResult(data);
          setCurrentStep(5); // Step 6: Complete
          setIsDone(true);

          const status = data.dispatch?.dispatch_status || "";
          if (status === "archived") {
            setRobotState("archived");
          } else {
            setRobotState("success");
          }

          if (onSuccess) {
            onSuccess(data);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || "Failed to execute agent dispatch");
          setRobotState("error");
        }
      } finally {
        clearInterval(interval);
      }
    }

    // Advance step 4 (Telegram waiting) after 3.5s while request processes
    const timer = setTimeout(() => {
      if (isMounted && !isDone && !errorMsg) {
        setCurrentStep(4);
        setRobotState("waiting");
      }
    }, 3500);

    triggerDispatch();

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [isOpen, leadId]);

  if (!isOpen) return null;

  // Status message rendering
  const getStatusText = () => {
    if (errorMsg) return "❌ Execution encountered an error";
    if (!isDone) return "🤖 ReAct Loop active · Ollama + Telegram";

    const status = dispatchResult?.dispatch?.dispatch_status;
    const approval = dispatchResult?.dispatch?.approval_status;

    if (status === "sent") {
      return "✅ Approved on Telegram & Email Sent via Resend!";
    } else if (status === "archived") {
      if (approval === "rejected") {
        return "❌ Rejected on Telegram → Lead moved to Archived";
      }
      return "📦 Lead moved to Archived (No email or max retries)";
    } else if (status === "timed_out") {
      return "⏳ Approval timed out → Moved to Ready stage";
    }
    return "✨ Agent Workflow Completed!";
  };

  // Eyes rendering depending on state
  const renderRobotEyes = () => {
    switch (robotState) {
      case "success":
        return (
          <g fill="#10B981">
            <path d="M22 25 L28 20 L34 25" stroke="#10B981" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M46 25 L52 20 L58 25" stroke="#10B981" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
        );
      case "archived":
        return (
          <g fill="#F59E0B">
            <line x1="22" y1="25" x2="32" y2="25" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            <line x1="48" y1="25" x2="58" y2="25" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          </g>
        );
      case "error":
        return (
          <g stroke="#EF4444" strokeWidth="3" strokeLinecap="round">
            <line x1="22" y1="20" x2="32" y2="30" />
            <line x1="32" y1="20" x2="22" y2="30" />
            <line x1="48" y1="20" x2="58" y2="30" />
            <line x1="58" y1="20" x2="48" y2="30" />
          </g>
        );
      case "waiting":
        return (
          <g fill="#F59E0B">
            <circle cx="27" cy="24" r="5" className="animate-ping" />
            <circle cx="53" cy="24" r="5" className="animate-ping" />
          </g>
        );
      case "critiquing":
        return (
          <g fill="#06B6D4">
            <ellipse cx="27" cy="24" rx="6" ry="3" />
            <ellipse cx="53" cy="24" rx="6" ry="3" />
          </g>
        );
      default: // thinking
        return (
          <g fill="#3B82F6">
            <circle cx="27" cy="24" r="4.5" className="animate-pulse" />
            <circle cx="53" cy="24" r="4.5" className="animate-pulse" />
          </g>
        );
    }
  };

  const handleClose = () => {
    onClose();
    // Trigger a window reload or soft refresh if completed to sync UI tables
    if (isDone && typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0F1420] border border-cyan-500/30 rounded-2xl p-7 shadow-2xl space-y-6 overflow-hidden">
        {/* Futuristic glowing backdrop */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl animate-pulse" />

        {/* Top Header with Cute Robot Mascot */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
          {/* Animated Cute SVG Robot Avatar */}
          <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-amber-500/20 blur-md animate-pulse" />

            <svg viewBox="0 0 80 80" className="w-16 h-16 relative z-10 drop-shadow-lg">
              {/* Antenna */}
              <line x1="40" y1="12" x2="40" y2="2" stroke="#06B6D4" strokeWidth="2.5" />
              <circle cx="40" cy="2" r="3.5" fill={robotState === "waiting" ? "#F59E0B" : "#06B6D4"} className="animate-ping" />

              {/* Ears */}
              <rect x="8" y="24" width="6" height="12" rx="3" fill="#1E293B" stroke="#06B6D4" strokeWidth="1.5" />
              <rect x="66" y="24" width="6" height="12" rx="3" fill="#1E293B" stroke="#06B6D4" strokeWidth="1.5" />

              {/* Head Box */}
              <rect x="14" y="12" width="52" height="38" rx="10" fill="#0F172A" stroke="#06B6D4" strokeWidth="2" />
              {/* Screen Face */}
              <rect x="18" y="16" width="44" height="28" rx="7" fill="#020617" stroke="#1E293B" strokeWidth="1" />

              {/* Dynamic Animated Eyes */}
              {renderRobotEyes()}

              {/* Cute Mouth */}
              <path
                d={robotState === "success" ? "M30 36 Q40 43 50 36" : robotState === "error" ? "M30 40 Q40 34 50 40" : "M32 38 L48 38"}
                stroke={robotState === "error" ? "#EF4444" : robotState === "success" ? "#10B981" : "#94A3B8"}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* Robot Body */}
              <rect x="22" y="52" width="36" height="24" rx="6" fill="#0F172A" stroke="#06B6D4" strokeWidth="2" />
              {/* Heart/Status Chest LED */}
              <circle cx="40" cy="62" r="4" fill={isDone ? (robotState === "archived" ? "#F59E0B" : "#10B981") : "#F59E0B"} className="animate-pulse" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                LangGraph ReAct Agent
              </span>
              <span className="text-[10px] font-mono text-slate-400">v0.2.0</span>
            </div>
            <h3 className="font-display font-semibold text-lg text-slate-100 mt-1 truncate max-w-[280px]">
              {leadName}
            </h3>
            <p className="text-xs text-slate-300 font-mono mt-0.5 font-medium">
              {getStatusText()}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Agent Progress</span>
            <span className="text-cyan-400 font-bold">
              {Math.round(((currentStep + 1) / AGENT_STEPS.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                errorMsg
                  ? "bg-rose-500"
                  : isDone
                  ? robotState === "archived"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  : "bg-gradient-to-r from-cyan-500 via-blue-500 to-amber-500 animate-pulse"
              }`}
              style={{ width: `${((currentStep + 1) / AGENT_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Ticker List */}
        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {AGENT_STEPS.map((step, idx) => {
            const isFinished = idx < currentStep || isDone;
            const isCurrent = idx === currentStep && !isDone && !errorMsg;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs transition-all duration-300 ${
                  isCurrent
                    ? "bg-cyan-500/10 border-cyan-500/40 text-slate-100 translate-x-1 shadow-lg shadow-cyan-500/5"
                    : isFinished
                    ? "bg-slate-900/60 border-slate-800/80 text-slate-300 opacity-90"
                    : "bg-slate-950/40 border-slate-900 text-slate-600"
                }`}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs mt-0.5">
                  {isFinished ? (
                    <span className="text-emerald-400 font-bold">✓</span>
                  ) : isCurrent ? (
                    <span className="animate-bounce">{step.icon}</span>
                  ) : (
                    <span className="text-slate-600 text-[10px]">{step.id}</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{step.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-cyan-400 animate-pulse font-bold">
                        Executing...
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-sans">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Result summary banner if finished */}
        {isDone && dispatchResult && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
            <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider font-semibold block">
              Agent Execution Summary
            </span>
            <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
              Stage Result: <span className="font-bold text-amber-300">{dispatchResult.dispatch?.dispatch_status}</span> |
              Telegram: <span className="font-bold text-slate-200">{dispatchResult.dispatch?.approval_status}</span> |
              Regen Count: <span className="font-bold text-slate-200">{dispatchResult.dispatch?.regen_count}</span>
            </p>
          </div>
        )}

        {/* Error message box if failed */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-1">
            <span className="font-bold uppercase tracking-wider block">Dispatch Error</span>
            <p className="text-slate-300 font-sans">{errorMsg}</p>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="text-[10px] font-mono text-slate-500">
            Powered by Ollama + LangGraph + Telegram
          </span>

          <button
            type="button"
            onClick={handleClose}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              isDone
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                : errorMsg
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
            }`}
          >
            {isDone ? "Done & Sync UI" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
