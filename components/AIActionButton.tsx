"use client";

import React, { useEffect, useState } from "react";

interface AIActionButtonProps {
  onClick: () => Promise<void> | void;
  isBusy: boolean;
  hasDraft?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const STEPS = [
  { icon: "🔍", text: "Analyzing business profile..." },
  { icon: "📊", text: "Scoring metrics..." },
  { icon: "📝", text: "Drafting outreach email..." },
  { icon: "🧐", text: "Running AI Critique loop..." },
  { icon: "✨", text: "Finalizing draft..." },
];

export default function AIActionButton({
  onClick,
  isBusy,
  hasDraft = false,
  className = "",
  size = "md",
}: AIActionButtonProps) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!isBusy) {
      setStepIdx(0);
      return;
    }

    const interval = setInterval(() => {
      setStepIdx((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 800);

    return () => clearInterval(interval);
  }, [isBusy]);

  const currentStep = STEPS[stepIdx];

  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : size === "lg"
      ? "px-6 py-3 text-sm"
      : "px-4 py-2 text-xs";

  if (isBusy) {
    return (
      <button
        type="button"
        disabled
        className={`relative overflow-hidden rounded-lg bg-slate-900 border border-amber-500/60 text-amber-300 font-medium shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2.5 ${sizeClasses} ${className}`}
      >
        {/* Animated gradient progress fill background */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 transition-all duration-500 pointer-events-none"
          style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
        />

        {/* Spinner icon */}
        <svg
          className="w-4 h-4 text-amber-400 animate-spin shrink-0 relative z-10"
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

        {/* Live Step Text */}
        <span className="relative z-10 font-mono font-semibold flex items-center gap-1.5 animate-pulse">
          <span>{currentStep.icon}</span>
          <span>{currentStep.text}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 ${sizeClasses} ${className}`}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      <span>{hasDraft ? "Regenerate AI Draft" : "Generate AI Draft"}</span>
    </button>
  );
}
