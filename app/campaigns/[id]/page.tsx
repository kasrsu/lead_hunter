"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import KanbanBoard from "@/components/KanbanBoard";
import { useSenderProfile } from "@/lib/useSenderProfile";
import type { CampaignWithStats, PersistedLead, PipelineStage } from "@/lib/types";

export default function CampaignBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sender] = useSenderProfile();

  const [campaign, setCampaign] = useState<CampaignWithStats | null>(null);
  const [leads, setLeads] = useState<PersistedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load campaign");
      const data = await res.json();
      setCampaign(data.campaign);
      setLeads(data.leads);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveLead(leadId: string, to: PipelineStage) {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: to }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Move failed");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleSend(leadId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (!lead.contactEmail || !lead.emailBody) {
      setError("Add a contact email and generate a draft first — open the lead to do that.");
      return;
    }
    if (!window.confirm(`Send the drafted email to ${lead.name}?`)) return;
    setError(null);
    void sendLead(leadId);
  }

  async function sendLead(leadId: string) {
    try {
      const res = await fetch(`/api/leads/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Send failed");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function enrichAll() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/enrich-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Enrich-all failed");
      setNotice(
        data.failed
          ? `${data.updated} drafted, ${data.failed} failed (left in New to retry)`
          : `Drafted ${data.updated} lead${data.updated === 1 ? "" : "s"}`
      );
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function archiveCampaign() {
    if (!window.confirm("Archive this campaign? It stays on the dashboard but is marked archived.")) return;
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (res.ok) await load();
  }

  const pendingDrafts = leads.filter((l) => l.pipelineStage === "new" || l.pipelineStage === "drafting").length;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <button
          onClick={() => router.push("/campaigns")}
          className="font-mono text-xs text-slate-400 hover:text-amber-400 transition-colors"
        >
          &larr; Back to Campaigns
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4 bg-[#121723] border border-slate-800 rounded-xl p-6 shadow-md">
          <div className="min-w-0 space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
              {campaign ? `Campaign • ${new Date(campaign.createdAt).toLocaleDateString()}` : "Campaign"}
            </span>
            <h1 className="truncate font-display text-2xl font-bold text-slate-100">
              {campaign?.name ?? "Loading…"}
            </h1>
            {campaign && (
              <p className="font-mono text-xs text-slate-400">
                {campaign.keyword} • {campaign.location} • {campaign.leadCount} leads
                {campaign.status === "archived" && <span className="ml-2 text-rose-400 font-bold">archived</span>}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={enrichAll}
              disabled={busy || pendingDrafts === 0}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
                busy
                  ? "bg-amber-500/50 text-slate-950 cursor-wait animate-pulse"
                  : pendingDrafts > 0
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 scale-105 cursor-pointer"
                  : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{busy ? "🤖 Deploying Agent..." : `🚀 Deploy Agent (${pendingDrafts} Pending)`}</span>
            </button>
            <button
              type="button"
              onClick={archiveCampaign}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-rose-500/40 hover:text-rose-400"
            >
              Archive
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-mono text-rose-300">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-mono text-emerald-300">
            {notice}
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center font-mono text-xs text-slate-500">Loading campaign kanban board…</p>
        ) : (
          <KanbanBoard leads={leads} onMove={moveLead} onSend={handleSend} onOpen={(leadId) => router.push(`/leads/${leadId}`)} />
        )}
      </div>
    </SidebarLayout>
  );
}
