"use client";

import React, { useEffect } from "react";

interface ToastProps {
  message: string | null;
  type?: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "success",
  onClose,
  duration = 3500,
}: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isError = type === "error" || message.toLowerCase().includes("error");

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-medium ${
          isError
            ? "bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/50"
            : "bg-slate-900/90 border-amber-500/40 text-slate-100 shadow-amber-500/10"
        }`}
      >
        <span className="text-base">{isError ? "⚠️" : "✨"}</span>
        <span className="font-sans">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-slate-400 hover:text-slate-200 text-sm font-bold"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
