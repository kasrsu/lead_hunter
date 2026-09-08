"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSenderProfile } from "@/lib/useSenderProfile";
import AIActionButton from "@/components/AIActionButton";
import DispatchAgentButton from "@/components/DispatchAgentButton";
import Toast from "@/components/Toast";
import type { PersistedLead } from "@/lib/types";

interface ApprovalQueueProps {
  initialLeads: PersistedLead[];
}

export default function ApprovalQueue({ initialLeads }: ApprovalQueueProps) {
  const [leads, setLeads] = useState<PersistedLead[]>(initialLeads);
  const [profile] = useSenderProfile();

  const [activeLeadId, setActiveLeadId] = useState<string | null>(
    initialLeads.length > 0 ? initialLeads[0].id : null
  );

  const activeLead = leads.find((l) => l.id === activeLeadId) || leads[0];

  // Editable state for active lead
  const [subject, setSubject] = useState(activeLead?.emailSubject || "");
  const [body, setBody] = useState(activeLead?.emailBody || "");
  const [email, setEmail] = useState(activeLead?.contactEmail || "");

  const [sending, setSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Sync active lead fields when activeLeadId changes
  React.useEffect(() => {
    if (activeLead) {
      setSubject(activeLead.emailSubject || `Outreach for ${activeLead.name}`);
      setBody(activeLead.emailBody || "");
      setEmail(activeLead.contactEmail || "");
    }
  }, [activeLeadId]);

  const handleRegenerate = async () => {
    if (!activeLead) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/leads/${activeLead.id}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate draft");

      await new Promise((resolve) => setTimeout(resolve, 600));

      setSubject(data.lead.emailSubject || "");
      setBody(data.lead.emailBody || "");
      setLeads((prev) => prev.map((l) => (l.id === activeLead.id ? data.lead : l)));

      setToastMsg("✨ AI Agent regenerated draft successfully!");
      setToastType("success");
    } catch (err: any) {
      setToastMsg(`Error: ${err.message}`);
      setToastType("error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeLead) return;
    try {
      const res = await fetch(`/api/leads/${activeLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSubject: subject,
          emailBody: body,
          contactEmail: email,
        }),
      });
      if (!res.ok) throw new Error("Failed to save draft");
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === activeLead.id ? updated.lead : l)));
      setToastMsg("Edits saved successfully.");
      setToastType("success");
    } catch (err: any) {
      setToastMsg(`Error: ${err.message}`);
      setToastType("error");
    }
  };

  const handleSend = async () => {
    if (!activeLead) return;
    if (!email) {
      setToastMsg("Please provide a contact email before sending.");
      setToastType("error");
      return;
    }
    setSending(true);
    try {
      // Save edits
      await fetch(`/api/leads/${activeLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSubject: subject,
          emailBody: body,
          contactEmail: email,
        }),
      });

      // Send email
      const res = await fetch(`/api/leads/${activeLead.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");

      // Remove from approval queue
      setLeads((prev) => prev.filter((l) => l.id !== activeLead.id));
      setToastMsg(`Email approved & sent to ${email}!`);
      setToastType("success");

      // Set next active lead
      const remaining = leads.filter((l) => l.id !== activeLead.id);
      if (remaining.length > 0) {
        setActiveLeadId(remaining[0].id);
      } else {
        setActiveLeadId(null);
      }
    } catch (err: any) {
      setToastMsg(`Error sending email: ${err.message}`);
      setToastType("error");
    } finally {
      setSending(false);
    }
  };

  const handleWhatsAppSend = async () => {
    if (!activeLead) return;
    if (!activeLead.phone) {
      setToastMsg("Lead has no phone number on file for WhatsApp outreach.");
      setToastType("error");
      return;
    }
    setSending(true);
    try {
      await fetch(`/api/leads/${activeLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSubject: subject,
          emailBody: body,
          contactEmail: email,
        }),
      });

      const res = await fetch(`/api/leads/${activeLead.id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send WhatsApp message");

      const waRes = data.whatsappResult;
      if (waRes?.url && waRes?.status === "link_generated") {
        window.open(waRes.url, "_blank");
        setToastMsg(`WhatsApp click-to-chat link opened for ${activeLead.phone}!`);
      } else {
        setToastMsg(`WhatsApp message dispatched to ${activeLead.phone}!`);
      }
      setToastType("success");

      setLeads((prev) => prev.filter((l) => l.id !== activeLead.id));
      const remaining = leads.filter((l) => l.id !== activeLead.id);
      if (remaining.length > 0) {
        setActiveLeadId(remaining[0].id);
      } else {
        setActiveLeadId(null);
      }
    } catch (err: any) {
      setToastMsg(`WhatsApp Error: ${err.message}`);
      setToastType("error");
    } finally {
      setSending(false);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="bg-[#121723] border border-slate-800 rounded-xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto text-xl font-bold">
          ✓
        </div>
        <h3 className="font-display font-medium text-xl text-slate-100">
          Approval Queue is Clean!
        </h3>
        <p className="text-sm text-slate-400">
          There are no leads currently awaiting human approval. Score and draft new leads from your lead management table or run a campaign scan.
        </p>
        <Link
          href="/leads"
          className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
        >
          View All Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-12 gap-8 items-start">
      {/* Vanishing Toast Notification */}
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />

      {/* Left List of Ready Leads */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Leads Awaiting Review ({leads.length})
          </span>
        </div>

        <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {leads.map((lead) => {
            const isActive = lead.id === activeLead?.id;
            const score = lead.opportunityScore ?? lead.leadScore ?? 50;
            const isWhatsApp = lead.channel === "WHATSAPP" || (lead.phone && !lead.contactEmail);

            return (
              <button
                key={lead.id}
                onClick={() => setActiveLeadId(lead.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  isActive
                    ? "bg-amber-500/10 border-amber-500/40 shadow-lg"
                    : "bg-[#121723] border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-100 truncate max-w-[180px]">
                    {lead.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isWhatsApp && (
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        💬 WA
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {score}/100
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 mt-1 truncate">
                  {lead.category} • {lead.address || "No address"}
                </div>

                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] font-mono text-slate-400">
                    ★ {lead.rating} ({lead.reviews} reviews)
                  </span>
                  {lead.classification && (
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                      {lead.classification}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Draft & Review Pane */}
      {activeLead && (
        <div className="lg:col-span-8 bg-[#121723] border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-display font-semibold text-xl text-slate-100">
                  {activeLead.name}
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Awaiting Approval
                </span>
                {activeLead.channel === "WHATSAPP" || (activeLead.phone && !activeLead.contactEmail) ? (
                  <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {activeLead.whatsappStatus === "verified" ? "✓ WhatsApp Verified" : "💬 WhatsApp Target"}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    📧 Email Target
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {activeLead.category} • {activeLead.address} • 📞 {activeLead.phone || "No phone"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Interactive Cute AI Robot Dispatch Agent Button */}
              <DispatchAgentButton
                leadId={activeLead.id}
                leadName={activeLead.name}
                size="sm"
                onDispatchComplete={() => {
                  setLeads((prev) => prev.filter((l) => l.id !== activeLead.id));
                  setToastMsg("🤖 AI Agent completed dispatch & Telegram approval workflow!");
                  setToastType("success");
                }}
              />

              {/* Interactive AI Animated Action Button */}
              <AIActionButton
                onClick={handleRegenerate}
                isBusy={isGenerating}
                hasDraft={Boolean(activeLead.emailBody)}
                size="sm"
              />

              <div className="text-right">
                <span className="text-xs text-slate-400 font-mono block">Opportunity Score</span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {activeLead.opportunityScore ?? activeLead.leadScore ?? 50}/100
                </span>
              </div>
            </div>
          </div>

          {/* Research Brief Preview */}
          {activeLead.researchBrief && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 text-xs space-y-1">
              <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider font-semibold block">
                AI Research Brief & Angle
              </span>
              <p className="text-slate-300 leading-relaxed font-sans">{activeLead.researchBrief}</p>
            </div>
          )}

          {/* Recipient Contact Email & Phone Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-400">
                Recipient Contact Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. owner@restaurant.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-slate-400">
                Phone Number (WhatsApp)
              </label>
              <input
                type="text"
                value={activeLead.phone || ""}
                disabled
                placeholder="No phone number"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Email Subject Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono uppercase text-slate-400">
              Outreach Subject / Pitch Angle
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 font-medium focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Email Body Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono uppercase text-slate-400">
                Outreach Message Body (Editable)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {body.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-amber-500/50 font-sans"
            />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition-colors"
            >
              Save Edits
            </button>

            <div className="flex flex-wrap items-center gap-3">
              {activeLead.phone && (
                <button
                  onClick={handleWhatsAppSend}
                  disabled={sending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <span className="text-sm">💬</span>
                  <span>Approve & Send WhatsApp</span>
                </button>
              )}

              <button
                onClick={handleSend}
                disabled={sending}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? (
                  <span>Sending Outreach...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Approve & Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
