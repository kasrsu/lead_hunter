"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import AgentTrace from "@/components/AgentTrace";
import Scorecard from "@/components/Scorecard";
import AIActionButton from "@/components/AIActionButton";
import Toast from "@/components/Toast";
import { pipelineLabel } from "@/lib/kanban";
import { useSenderProfile } from "@/lib/useSenderProfile";
import type { PersistedLead } from "@/lib/types";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sender] = useSenderProfile();

  const [lead, setLead] = useState<PersistedLead | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${id}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load lead");
      const data = await res.json();
      setLead(data.lead);
      setContactEmail(data.lead.contactEmail ?? "");
      setSubject(data.lead.emailSubject ?? "");
      setBody(data.lead.emailBody ?? "");
    } catch (err: any) {
      setToastMsg(err.message);
      setToastType("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Persist the editable fields (contact email, subject, body). */
  async function persist() {
    if (!lead) return;
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactEmail, emailSubject: subject, emailBody: body }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
    setLead((prev) => (prev ? { ...prev, contactEmail, emailSubject: subject, emailBody: body } : prev));
  }

  async function generateDraft() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${id}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Enrichment failed");

      // Brief pause for step completion feedback
      await new Promise((resolve) => setTimeout(resolve, 600));

      setLead(data.lead);
      setSubject(data.lead.emailSubject ?? "");
      setBody(data.lead.emailBody ?? "");
      setToastMsg("✨ AI Agent drafted outreach email successfully!");
      setToastType("success");
    } catch (err: any) {
      setToastMsg(err.message);
      setToastType("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!lead) return;
    if (!contactEmail.trim()) {
      setToastMsg("Please provide a business contact email first.");
      setToastType("error");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setToastMsg("Generate a draft before sending.");
      setToastType("error");
      return;
    }
    if (!window.confirm(`Send this email to ${lead.name} at ${contactEmail}?`)) return;

    setBusy(true);
    try {
      await persist();
      const res = await fetch(`/api/leads/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setLead(data.lead);
      setToastMsg(`Email sent successfully to ${contactEmail}!`);
      setToastType("success");
    } catch (err: any) {
      setToastMsg(err.message);
      setToastType("error");
    } finally {
      setBusy(false);
    }
  }

  if (!lead && !toastMsg) {
    return (
      <SidebarLayout>
        <p className="py-16 text-center font-mono text-xs text-slate-500">Loading lead intelligence…</p>
      </SidebarLayout>
    );
  }

  if (!lead) {
    return (
      <SidebarLayout>
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-mono text-rose-400">
          {toastMsg}
        </p>
      </SidebarLayout>
    );
  }

  const oppScore = lead.opportunityScore ?? lead.leadScore ?? 50;

  return (
    <SidebarLayout>
      {/* Vanishing Toast Notification */}
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />

      <div className="space-y-6 max-w-4xl">
        <button
          onClick={() => router.push("/leads")}
          className="font-mono text-xs text-orange-800/80 hover:text-orange-950 transition-colors font-semibold"
        >
          &larr; Back to Lead Management
        </button>

        {/* Lead Header Card */}
        <section className="bg-white/80 backdrop-blur-xl border border-orange-200/80 rounded-2xl p-6 shadow-xl shadow-orange-500/5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-bold text-slate-900">{lead.name}</h1>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs">
                  {lead.priorityTier ? `${lead.priorityTier} Priority` : "Lead"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600 font-medium">{lead.address}</p>
              <p className="mt-1 font-mono text-xs text-orange-950/80">
                ★ {lead.rating.toFixed(1)} • {lead.reviews} reviews
                {lead.phone && <> • {lead.phone}</>}
                {lead.category && <> • {lead.category}</>}
                {lead.priceRange && <> • {lead.priceRange}</>}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <span className="text-xs text-orange-800/70 font-mono font-bold block">Opportunity Score</span>
                <span className="text-2xl font-bold font-mono bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{oppScore}/100</span>
              </div>

              <div className="flex items-center gap-2">
                {lead.mapsUrl && (
                  <a
                    href={lead.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-orange-600 underline hover:text-orange-700 font-mono font-bold"
                  >
                    Google Maps ↗
                  </a>
                )}
                <span className="rounded-full border border-orange-200 bg-orange-100/80 px-3 py-1 text-xs font-mono text-orange-900 font-semibold">
                  Stage: <span className="text-orange-950 font-bold">{pipelineLabel(lead.pipelineStage)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Extended Metadata Pills */}
          {(lead.reviewSnippet || (lead.features && lead.features.length > 0)) && (
            <div className="pt-4 border-t border-orange-200/80 space-y-2">
              {lead.reviewSnippet && (
                <div className="text-xs text-slate-700 italic bg-orange-50/60 p-3 rounded-xl border border-orange-200/80 font-medium">
                  &ldquo;{lead.reviewSnippet}&rdquo;
                </div>
              )}
              {lead.features && lead.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lead.features.map((f, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-orange-100 text-orange-900 text-[10px] font-mono font-semibold rounded-md border border-orange-200">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-6">
          <Scorecard lead={lead} />
          <AgentTrace lead={lead} />
        </div>

        {/* Draft & Send Section */}
        <section className="rounded-2xl border border-orange-200/80 bg-white/80 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Draft &amp; Send Outreach</h2>
              <p className="text-xs text-slate-500 font-medium">Editable before sending — human approval required.</p>
            </div>

            {/* Interactive Animated AI Button */}
            <AIActionButton
              onClick={generateDraft}
              isBusy={busy}
              hasDraft={Boolean(lead.emailBody)}
            />
          </div>

          <div className="space-y-4 pt-2">
            <label className="grid gap-1 text-xs font-mono uppercase text-orange-800 font-bold">
              <span>Business Contact Email</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                onBlur={() => void persist().catch((err) => setToastMsg(err.message))}
                placeholder="owner@business.com"
                className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 font-sans normal-case font-medium shadow-xs"
              />
            </label>

            <label className="grid gap-1 text-xs font-mono uppercase text-orange-800 font-bold">
              <span>Subject (Editable)</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onBlur={() => void persist().catch((err) => setToastMsg(err.message))}
                className="w-full rounded-xl border border-orange-200/80 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 font-sans font-semibold normal-case shadow-xs"
              />
            </label>

            <label className="grid gap-1 text-xs font-mono uppercase text-orange-800 font-bold">
              <span>Message Body (Editable)</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onBlur={() => void persist().catch((err) => setToastMsg(err.message))}
                rows={9}
                className="w-full rounded-xl border border-orange-200/80 bg-white p-3.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 font-sans normal-case font-medium shadow-xs"
              />
            </label>

            <button
              type="button"
              onClick={handleSend}
              disabled={busy || lead.pipelineStage === "sent"}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs border-t border-white/30 shadow-md shadow-orange-500/20 transition-all disabled:opacity-40"
            >
              {lead.pipelineStage === "sent" ? "Email Sent ✓" : busy ? "Sending Email…" : "Approve & Send Outreach Email"}
            </button>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}
