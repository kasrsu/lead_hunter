"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SidebarLayout from "@/components/SidebarLayout";
import CampaignList from "@/components/CampaignList";
import ClassificationBreakdown from "@/components/ClassificationBreakdown";
import ContactBreakdown from "@/components/ContactBreakdown";
import PipelineFunnel from "@/components/PipelineFunnel";
import RobotDepartmentHub from "@/components/RobotDepartmentHub";
import LiveActivityLogsCard from "@/components/LiveActivityLogsCard";
import SenderProfileCard from "@/components/SenderProfileCard";
import StatCard from "@/components/StatCard";
import type { DashboardStats } from "@/lib/types";

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const hotCount = stats?.tierCounts?.Hot || 0;

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Executive Hero Banner */}
        <section className="relative overflow-hidden glass-panel rounded-2xl p-8 shadow-xl shadow-orange-500/5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-orange-800 font-bold px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200">
                Enterprise Lead OS • Version 2.0
              </span>
              <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">
                Lead Intelligence & Outreach Management Portal
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 leading-relaxed font-medium">
                Ingest lead lists, auto-calculate 4-part metrics (Opportunity, Reachability, Completeness, Engagement), draft personalized AI outreach, and approve or auto-send emails via the Autonomous Robot Department.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/import"
                className="px-4 py-2.5 bg-gradient-to-b from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 border-t border-white/30 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Import Leads
              </Link>
              <Link
                href="/leads"
                className="px-4 py-2.5 bg-white hover:bg-orange-50 text-slate-800 font-semibold text-xs rounded-xl border border-orange-200/80 transition-colors shadow-xs"
              >
                View Management Grid
              </Link>
            </div>
          </div>
        </section>

        {/* Robot Department Command Center HUD */}
        <RobotDepartmentHub />

        {/* Live Debugging & Execution Console */}
        <LiveActivityLogsCard />

        {/* Executive Stats Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total Campaigns" value={stats?.totalCampaigns ?? "–"} />
          <StatCard label="Total Leads" value={stats?.totalLeads ?? "–"} />
          <StatCard label="Hot Priority Leads" value={hotCount} hint="Opportunity >= 75" />
          <StatCard label="Ready for Approval" value={stats?.readyCount ?? "–"} hint="Awaiting review" />
          <StatCard label="Sent Emails" value={stats?.sentCount ?? "–"} hint="Human-approved or auto-sent" />
        </section>

        {/* Main Grid Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-orange-200/80 bg-white/80 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5">
            <h2 className="mb-4 font-display font-bold text-lg text-slate-900 flex items-center justify-between">
              <span>Pipeline Funnel</span>
              <Link href="/leads" className="text-xs text-orange-600 hover:underline font-mono font-bold">
                View leads &rarr;
              </Link>
            </h2>
            <PipelineFunnel funnel={stats?.funnel ?? { new: 0, drafting: 0, ready: 0, sent: 0, won: 0, archived: 0 }} />
          </section>

          <section className="rounded-2xl border border-orange-200/80 bg-white/80 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5">
            <h2 className="mb-4 font-display font-bold text-lg text-slate-900">
              Contact Reachability Methods
            </h2>
            <ContactBreakdown breakdown={stats?.contactBreakdown} />
          </section>

          <section className="rounded-2xl border border-orange-200/80 bg-white/80 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5">
            <h2 className="mb-4 font-display font-bold text-lg text-slate-900">
              Agent Classifications
            </h2>
            <ClassificationBreakdown items={stats?.classificationBreakdown ?? []} />
          </section>
        </div>

        {/* Sender Profile Config & Recent Campaigns */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SenderProfileCard />
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Active Campaigns ({stats?.recentCampaigns?.length || 0})
              </h2>
              <Link href="/import" className="text-xs text-orange-600 font-mono font-bold hover:underline">
                + Create / Import Campaign
              </Link>
            </div>
            <CampaignList campaigns={stats?.recentCampaigns ?? []} />
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
