"use client";

import { useEffect, useState } from "react";
import { useSenderProfile } from "@/lib/useSenderProfile";

/** Editable sender profile card with explicit Save button & status UX feedback. */
export default function SenderProfileCard() {
  const [savedSender, save] = useSenderProfile();
  const [formState, setFormState] = useState(savedSender);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync formState with initial savedSender load
  useEffect(() => {
    setFormState(savedSender);
  }, [savedSender]);

  function handleChange(field: keyof typeof savedSender, value: string) {
    const next = { ...formState, [field]: value };
    setFormState(next);
    setHasChanges(
      next.senderName !== savedSender.senderName ||
        next.senderCompany !== savedSender.senderCompany ||
        next.senderEmail !== savedSender.senderEmail ||
        next.offerDescription !== savedSender.offerDescription
    );
    setSaveSuccess(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    save(formState);
    setHasChanges(false);
    setSaveSuccess(true);

    // Hide success state after 3 seconds
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  }

  return (
    <section className="rounded-2xl border border-orange-200/80 bg-white/80 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-orange-200/80 pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Sender & Outreach Configurations</span>
            {hasChanges && (
              <span className="font-mono text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                Unsaved Changes
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            The AI department writes personalized emails signed with this identity.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-xl self-start sm:self-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          Resend: evosolutions.lk
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
            <span>Sender Name</span>
            <input
              type="text"
              value={formState.senderName}
              onChange={(e) => handleChange("senderName", e.target.value)}
              placeholder="e.g. Kasr Perera"
              className="rounded-xl border border-orange-200/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-colors font-medium shadow-xs"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
            <span>Company Name</span>
            <input
              type="text"
              value={formState.senderCompany}
              onChange={(e) => handleChange("senderCompany", e.target.value)}
              placeholder="e.g. EVO Solutions"
              className="rounded-xl border border-orange-200/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-colors font-medium shadow-xs"
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
          <div className="flex items-center justify-between">
            <span>Reply-To Email Address</span>
            <span className="text-[10px] text-slate-500 font-mono">Must end in @evosolutions.lk</span>
          </div>
          <input
            type="email"
            value={formState.senderEmail}
            onChange={(e) => handleChange("senderEmail", e.target.value)}
            placeholder="outreach@evosolutions.lk"
            className="rounded-xl border border-orange-200/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-colors font-medium shadow-xs"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
          <span>Core Offer / Value Proposition</span>
          <textarea
            rows={2}
            value={formState.offerDescription}
            onChange={(e) => handleChange("offerDescription", e.target.value)}
            placeholder="Describe your offer so AI can draft tailored lead hooks..."
            className="rounded-xl border border-orange-200/80 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-colors resize-none font-medium shadow-xs"
          />
        </label>

        <div className="flex items-center justify-between pt-2">
          {saveSuccess ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl animate-fade-in">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>Configurations saved successfully!</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic font-medium">
              {hasChanges ? "You have unsaved changes." : "Saved locally on this browser."}
            </span>
          )}

          <button
            type="submit"
            disabled={!hasChanges && !saveSuccess}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
              hasChanges
                ? "bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold border-t border-white/30 shadow-orange-500/20 scale-105 cursor-pointer"
                : "bg-orange-100 text-slate-400 border border-orange-200 cursor-not-allowed opacity-80"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span>Save Configurations</span>
          </button>
        </div>
      </form>
    </section>
  );
}
