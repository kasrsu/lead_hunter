import type { PersistedLead } from "@/lib/types";

/**
 * The agent's auto-generated scorecard (agent-service/app/scoring.py): total
 * /100 plus each rubric dimension scored out of its own max, with the
 * justification the rubric produced for that dimension.
 */

const RUBRIC: Record<string, { label: string; max: number }> = {
  rating_quality: { label: "Rating quality", max: 20 },
  review_volume: { label: "Review volume", max: 15 },
  premium_positioning: { label: "Premium positioning", max: 15 },
  digital_presence: { label: "Digital presence", max: 15 },
  contact_availability: { label: "Contact availability", max: 10 },
  brand_strength: { label: "Brand strength", max: 10 },
  market_opportunity: { label: "Market opportunity", max: 10 },
  weakness_exposure: { label: "Weakness exposure", max: 5 },
  ease_of_closing: { label: "Ease of closing", max: 5 },
};

export default function Scorecard({ lead }: { lead: PersistedLead }) {
  if (lead.leadScore == null || !lead.rubricScores) {
    return (
      <div className="rounded-2xl border border-orange-200/80 bg-white/90 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5">
        <p className="text-sm text-slate-600 font-medium">
          No scorecard yet — run the agent on this lead to generate one.
        </p>
      </div>
    );
  }

  const dimensions = Object.entries(lead.rubricScores);
  return (
    <div className="rounded-2xl border border-orange-200/80 bg-white/90 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-orange-950 font-bold">
            Agent Scorecard
          </p>
          <p className="mt-0.5 text-xs text-slate-600 font-medium">Deterministic rubric · 4-part scoring engine</p>
        </div>
        <p className="font-mono text-4xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
          {lead.leadScore}
          <span className="text-base text-slate-500 font-bold">/100</span>
        </p>
      </div>

      {lead.reasoningSummary && (
        <p className="border-t border-orange-200/60 pt-3 text-xs text-slate-800 font-medium leading-relaxed">
          {lead.reasoningSummary}
        </p>
      )}

      <div className="grid gap-3 pt-2">
        {dimensions.map(([key, value]) => {
          const def = RUBRIC[key];
          const max = def?.max ?? 20;
          const label = def?.label ?? key.replace(/_/g, " ");
          const justification = lead.rubricJustification?.[key];
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-xs font-mono text-slate-900 font-bold">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-orange-100/80 border border-orange-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                    style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-xs font-bold text-orange-950">
                  {value}/{max}
                </span>
              </div>
              {justification && (
                <p className="ml-44 text-[11px] text-slate-600 italic font-medium">{justification}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
