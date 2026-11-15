"use client";

import React, { useState } from "react";
import AIRobotAgentModal from "./AIRobotAgentModal";

interface DispatchAgentButtonProps {
  leadId: string;
  leadName?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  onDispatchComplete?: () => void;
}

export default function DispatchAgentButton({
  leadId,
  leadName = "Lead",
  className = "",
  size = "md",
  onDispatchComplete,
}: DispatchAgentButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sizeClasses =
    size === "sm"
      ? "px-2.5 py-1 text-[11px]"
      : size === "lg"
      ? "px-5 py-2.5 text-sm"
      : "px-3.5 py-2 text-xs";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        className={`group relative overflow-hidden rounded-xl bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold border-t border-white/30 shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 ${sizeClasses} ${className}`}
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>

        <span className="font-mono uppercase tracking-wider font-semibold">
          Dispatch Agent
        </span>
      </button>

      {/* Interactive Cute AI Robot Modal */}
      <AIRobotAgentModal
        isOpen={isModalOpen}
        leadId={leadId}
        leadName={leadName}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          if (onDispatchComplete) {
            onDispatchComplete();
          }
        }}
      />
    </>
  );
}
