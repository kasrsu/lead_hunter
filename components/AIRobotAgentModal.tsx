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
  { id: 1, label: "Fetch Lead Context", desc: "Reading Google Maps signals & rating data..." },
  { id: 2, label: "Evaluate Scoring & Tier", desc: "Analyzing 4-part scoring rubric & classification..." },
  { id: 3, label: "LangGraph LLM Critique", desc: "Running local Ollama critique pass on draft..." },
  { id: 4, label: "Telegram Dispatch", desc: "Submitting interactive message to Telegram bot..." },
  { id: 5, label: "Awaiting Human Approval", desc: "Waiting for your click on Telegram..." },
  { id: 6, label: "Dispatch Completed", desc: "Pipeline stage updated & result saved to database!" },
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
    if (errorMsg) return `Execution Error: ${errorMsg}`;
    if (!isDone) return "ReAct Loop active · Ollama + Telegram";

    const status = dispatchResult?.dispatch?.dispatch_status;
    const approval = dispatchResult?.dispatch?.approval_status;

    if (status === "sent") {
      return "Approved on Telegram & Email Sent via Resend!";
    } else if (status === "archived") {
      if (approval === "rejected") {
        return "Rejected on Telegram -> Lead moved to Archived";
      }
      return "Lead moved to Archived (No email or max retries)";
    } else if (status === "timed_out") {
      return "Approval timed out -> Moved to Ready stage";
    }
    return "Agent Workflow Completed!";
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
          <g fill="#F97316">
            <line x1="22" y1="25" x2="32" y2="25" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
            <line x1="48" y1="25" x2="58" y2="25" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
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
          <g fill="#F97316">
            <ellipse cx="27" cy="24" rx="6" ry="3" />
            <ellipse cx="53" cy="24" rx="6" ry="3" />
          </g>
        );
      default: // thinking
        return (
          <g fill="#F97316">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-orange-950/20 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white/95 border border-orange-200/80 rounded-2xl p-7 shadow-xl shadow-orange-500/10 space-y-6 overflow-hidden">
        {/* Futuristic glowing backdrop */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl animate-pulse" />

        {/* Top Header with Cute Robot Mascot */}
        <div className="flex items-center gap-4 border-b border-orange-100 pb-5">
          {/* Animated Cute SVG Robot Avatar */}
          <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-orange-500/20 to-amber-500/20 blur-md animate-pulse" />

            <svg viewBox="0 0 80 80" className="w-16 h-16 relative z-10 drop-shadow-lg">
              {/* Antenna */}
              <line x1="40" y1="12" x2="40" y2="2" stroke="#F97316" strokeWidth="2.5" />
              <circle cx="40" cy="2" r="3.5" fill={robotState === "waiting" ? "#F59E0B" : "#F97316"} className="animate-ping" />

              {/* Ears */}
              <rect x="8" y="24" width="6" height="12" rx="3" fill="#FFF7ED" stroke="#F97316" strokeWidth="1.5" />
              <rect x="66" y="24" width="6" height="12" rx="3" fill="#FFF7ED" stroke="#F97316" strokeWidth="1.5" />

              {/* Head Box */}
              <rect x="14" y="12" width="52" height="38" rx="10" fill="#FFFFFF" stroke="#F97316" strokeWidth="2" />
              {/* Screen Face */}
              <rect x="18" y="16" width="44" height="28" rx="7" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1" />

              {/* Dynamic Animated Eyes */}
              {renderRobotEyes()}

              {/* Cute Mouth */}
              <path
                d={robotState === "success" ? "M30 36 Q40 43 50 36" : robotState === "error" ? "M30 40 Q40 34 50 40" : "M32 38 L48 38"}
                stroke={robotState === "error" ? "#EF4444" : robotState === "success" ? "#10B981" : "#EA580C"}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* Robot Body */}
              <rect x="22" y="52" width="36" height="24" rx="6" fill="#FFFFFF" stroke="#F97316" strokeWidth="2" />
              {/* Heart/Status Chest LED */}
              <circle cx="40" cy="62" r="4" fill={isDone ? (robotState === "archived" ? "#F59E0B" : "#10B981") : "#F97316"} className="animate-pulse" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-800 px-2 py-0.5 rounded bg-orange-100 border border-orange-200">
                LangGraph ReAct Agent
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-medium">v0.2.0</span>
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900 mt-1 truncate max-w-[280px]">
              {leadName}
            </h3>
            <p className="text-xs text-slate-600 font-mono mt-0.5 font-semibold">
              {getStatusText()}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 font-medium">
            <span>Agent Progress</span>
            <span className="text-orange-600 font-bold">
              {Math.round(((currentStep + 1) / AGENT_STEPS.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-orange-100 rounded-full overflow-hidden border border-orange-200">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                errorMsg
                  ? "bg-rose-500"
                  : isDone
                  ? robotState === "archived"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  : "bg-gradient-to-r from-orange-500 to-amber-500 animate-pulse"
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
                    ? "bg-gradient-to-b from-orange-500 to-amber-600 border-t border-white/30 text-white font-bold shadow-md shadow-orange-500/10"
                    : isFinished
                    ? "bg-orange-50/80 border-orange-200/80 text-orange-900 font-semibold"
                    : "bg-white border-orange-100 text-slate-400 font-medium"
                }`}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs mt-0.5">
                  {isFinished ? (
                    <span className="text-orange-800 font-bold">✓</span>
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  ) : (
                    <span className="text-slate-400 text-[10px]">{step.id}</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{step.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-white animate-pulse font-bold">
                        Executing...
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 leading-relaxed font-sans ${isCurrent ? "text-orange-100" : "text-slate-600"}`}>
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Result summary banner if finished */}
        {isDone && dispatchResult && (
          <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200/80 text-xs space-y-1">
            <span className="font-mono text-[10px] text-orange-800 uppercase tracking-wider font-bold block">
              Agent Execution Summary
            </span>
            <p className="text-slate-800 leading-relaxed font-mono text-[11px] font-medium">
              Stage Result: <span className="font-bold text-orange-700">{dispatchResult.dispatch?.dispatch_status}</span> |
              Telegram: <span className="font-bold text-slate-900">{dispatchResult.dispatch?.approval_status}</span> |
              Regen Count: <span className="font-bold text-slate-900">{dispatchResult.dispatch?.regen_count}</span>
            </p>
          </div>
        )}

        {/* Error message box if failed */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-mono space-y-1">
            <span className="font-bold uppercase tracking-wider block">Dispatch Error</span>
            <p className="text-slate-800 font-sans font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-orange-100">
          <span className="text-[10px] font-mono text-slate-500 font-medium">
            Powered by Ollama + LangGraph + Telegram
          </span>

          <button
            type="button"
            onClick={handleClose}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
              isDone
                ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/20"
                : errorMsg
                ? "bg-white hover:bg-orange-50 text-slate-800 border border-orange-200"
                : "bg-white hover:bg-orange-50 text-slate-800 border border-orange-200"
            }`}
          >
            {isDone ? "Done & Sync UI" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
