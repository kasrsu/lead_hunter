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
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-xl text-xs font-semibold ${
          isError
            ? "bg-rose-50 border-rose-200 text-rose-900 shadow-rose-500/10"
            : "bg-white/95 border-orange-200/80 text-slate-900 shadow-orange-500/10"
        }`}
      >
        <svg className={`w-4 h-4 shrink-0 ${isError ? "text-rose-600" : "text-orange-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isError ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          )}
        </svg>
        <span className="font-sans">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-slate-400 hover:text-slate-700 text-sm font-bold"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
