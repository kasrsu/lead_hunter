import SidebarLayout from "@/components/SidebarLayout";
import CampaignList from "@/components/CampaignList";
import { getDb } from "@/lib/db";
import { listCampaignsWithStats } from "@/lib/repositories/campaigns";

export const dynamic = "force-dynamic";

export default function CampaignsPage() {
  getDb();
  const campaigns = listCampaignsWithStats();

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Campaigns Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Overview of all active and archived lead intelligence campaigns.
          </p>
        </div>

        <CampaignList campaigns={campaigns} />
      </div>
    </SidebarLayout>
  );
}
