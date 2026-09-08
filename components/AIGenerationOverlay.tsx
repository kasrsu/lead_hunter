"use client";

import React, { useEffect, useState } from "react";

interface AIGenerationOverlayProps {
  isOpen: boolean;
  leadName?: string;
  onComplete?: () => void;
}

const STEPS = [
  { id: 1, text: "Analyzing business profile & Google Maps signals...", icon: "🔍" },
  { id: 2, text: "Evaluating 4-part metrics (Opportunity, Reachability)...", icon: "📊" },
  { id: 3, text: "Drafting personalized cold outreach message...", icon: "📝" },
  { id: 4, text: "Running AI Critique Node & verifying rubric score...", icon: "🧐" },
  { id: 5, text: "Finalizing draft & loading into Human Approval Queue!", icon: "✨" },
];

export default function AIGenerationOverlay({
  isOpen,
  leadName = "Business Lead",
}: AIGenerationOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      return;
    }

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 900);

    return () => clearInterval(stepInterval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0F131C] border border-amber-500/30 rounded-2xl p-8 shadow-2xl space-y-6 overflow-hidden">
        {/* Glow effect behind modal */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-25 blur-3xl animate-pulse"
          style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
        />

        {/* Spinner Header */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <svg
              className="w-6 h-6 text-amber-400 animate-spin"
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

          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
              LangGraph AI Agent Active
            </span>
            <h3 className="font-display font-semibold text-lg text-slate-100 mt-1">
              Generating Outreach for &ldquo;{leadName}&rdquo;
            </h3>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500 rounded-full"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step Ticker List */}
        <div className="space-y-3 pt-2">
          {STEPS.map((step, idx) => {
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs transition-all duration-300 ${
                  isCurrent
                    ? "bg-amber-500/10 border-amber-500/30 text-slate-100 font-medium translate-x-1"
                    : isDone
                    ? "bg-slate-900/60 border-slate-800 text-slate-400 opacity-75"
                    : "bg-slate-950/40 border-slate-900 text-slate-600"
                }`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 font-mono">
                  {isDone ? (
                    <span className="text-emerald-400 font-bold text-xs">✓</span>
                  ) : isCurrent ? (
                    <span className="animate-bounce">{step.icon}</span>
                  ) : (
                    <span className="text-slate-600 text-[10px]">{step.id}</span>
                  )}
                </div>

                <span className="flex-1 font-sans">{step.text}</span>

                {isCurrent && (
                  <span className="text-[10px] font-mono text-amber-400 animate-pulse">
                    Processing...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
