import SidebarLayout from "@/components/SidebarLayout";
import LeadManagementTable from "@/components/LeadManagementTable";
import StatCard from "@/components/StatCard";
import { getDb } from "@/lib/db";
import { listAllLeads } from "@/lib/repositories/leads";
import { getDashboardStats } from "@/lib/services/dashboardService";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  getDb();
  const leads = listAllLeads();
  const stats = getDashboardStats();

  const hotCount = stats.tierCounts?.Hot || 0;
  const warmCount = stats.tierCounts?.Warm || 0;
  const coldCount = stats.tierCounts?.Cold || 0;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Lead Intelligence Management System
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Search, filter, score, and manage all leads across your campaigns in one unified management grid.
            </p>
          </div>
        </div>

        {/* Tier & Status Summary Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Leads" value={stats.totalLeads} />
          <StatCard label="Hot Leads" value={hotCount} hint="Opportunity >= 75" />
          <StatCard label="Warm Leads" value={warmCount} hint="Opportunity 50-74" />
          <StatCard label="Ready for Approval" value={stats.readyCount} hint="Awaiting review" />
          <StatCard label="Emails Sent" value={stats.sentCount} hint="Human-approved" />
        </div>

        {/* Unified Table */}
        <LeadManagementTable initialLeads={leads} />
      </div>
    </SidebarLayout>
  );
}
