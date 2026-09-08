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
        className={`group relative overflow-hidden rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-md shadow-cyan-500/20 transition-all hover:scale-[1.03] active:scale-[0.97] flex items-center gap-2 ${sizeClasses} ${className}`}
      >
        {/* Glow sheen */}
        <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 pointer-events-none" />

        {/* Robot Icon */}
        <span className="text-base leading-none animate-bounce">🤖</span>

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
