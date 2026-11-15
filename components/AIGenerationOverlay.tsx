"use client";

import React, { useEffect, useState } from "react";

interface AIGenerationOverlayProps {
  isOpen: boolean;
  leadName?: string;
  onComplete?: () => void;
}

const STEPS = [
  { id: 1, text: "Analyzing business profile & Google Maps signals..." },
  { id: 2, text: "Evaluating 4-part metrics (Opportunity, Reachability)..." },
  { id: 3, text: "Drafting personalized cold outreach message..." },
  { id: 4, text: "Running AI Critique Node & verifying rubric score..." },
  { id: 5, text: "Finalizing draft & loading into Human Approval Queue!" },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-orange-950/20 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white/95 border border-orange-200/80 rounded-2xl p-8 shadow-xl shadow-orange-500/10 space-y-6 overflow-hidden">
        {/* Glow effect behind modal */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl animate-pulse"
          style={{ background: "radial-gradient(circle, #F97316 0%, transparent 70%)" }}
        />

        {/* Spinner Header */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20">
            <svg
              className="w-6 h-6 text-white animate-spin"
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
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-800 px-2 py-0.5 rounded bg-orange-100 border border-orange-200">
              LangGraph AI Agent Active
            </span>
            <h3 className="font-display font-bold text-lg text-slate-900 mt-1">
              Generating Outreach for &ldquo;{leadName}&rdquo;
            </h3>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-1.5 bg-orange-100 rounded-full overflow-hidden border border-orange-200">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 rounded-full"
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
                className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs transition-all duration-300 ${
                  isCurrent
                    ? "bg-gradient-to-b from-orange-500 to-amber-600 text-white font-bold border-t border-white/30 shadow-xs"
                    : isDone
                    ? "bg-orange-50/80 border-orange-200 text-orange-900 font-semibold"
                    : "bg-white border-orange-100 text-slate-400 font-medium"
                }`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 font-mono">
                  {isDone ? (
                    <span className="text-orange-700 font-bold text-xs">✓</span>
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  ) : (
                    <span className="text-slate-400 text-[10px]">{step.id}</span>
                  )}
                </div>

                <span className="flex-1 font-sans">{step.text}</span>

                {isCurrent && (
                  <span className="text-[10px] font-mono text-white font-semibold">
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
