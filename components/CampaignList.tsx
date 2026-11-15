import Link from "next/link";
import { PIPELINE } from "@/lib/kanban";
import type { CampaignWithStats } from "@/lib/types";

interface CampaignListProps {
  campaigns: CampaignWithStats[];
}

/** Active + archived campaigns with a mini pipeline bar, linking to each board. */
export default function CampaignList({ campaigns }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <p className="py-6 text-xs text-slate-500 font-mono font-medium">
        No campaigns yet. Run your first scan below — each scan becomes a campaign with its own
        kanban board.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {campaigns.map((campaign) => {
        const total = campaign.leadCount || 1;
        return (
          <Link
            key={campaign.id}
            href={`/campaigns/${campaign.id}`}
            className="group rounded-xl border border-orange-200/80 bg-white/80 backdrop-blur-xl px-5 py-4 transition hover:border-orange-400 shadow-sm hover:shadow-md shadow-orange-500/5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                  {campaign.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-500 font-medium">
                  {campaign.keyword} · {campaign.location} · {new Date(campaign.createdAt).toLocaleDateString()}
                  {campaign.status === "archived" && <span className="ml-2 text-rose-600 font-bold">archived</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="flex items-center gap-4 font-mono text-xs text-slate-600 font-medium">
                  <span>
                    <span className="text-slate-900 font-bold">{campaign.leadCount}</span> leads
                  </span>
                  {campaign.avgScore != null && <span className="font-bold text-orange-600">avg {campaign.avgScore}/100</span>}
                  <span>
                    <span className="text-emerald-700 font-bold">{campaign.stageCounts.sent}</span> sent
                  </span>
                </div>

                <span className="px-3 py-1.5 rounded-xl bg-orange-100 border border-orange-200 text-orange-900 font-bold text-xs group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-amber-600 group-hover:text-white transition-all flex items-center gap-1.5 shadow-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Deploy Agent &rarr;
                </span>
              </div>
            </div>

            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-orange-100/80 border border-orange-200/60">
              {PIPELINE.filter((c) => campaign.stageCounts[c.stage] > 0).map((c) => (
                <div
                  key={c.stage}
                  className={`h-full ${c.dot}`}
                  style={{ width: `${(campaign.stageCounts[c.stage] / total) * 100}%` }}
                />
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
