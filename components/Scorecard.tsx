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
      <div className="rounded-xl border border-ink-border bg-ink-surface p-6">
        <p className="text-sm text-paper-muted">
          No scorecard yet — run the agent on this lead to generate one.
        </p>
      </div>
    );
  }

  const dimensions = Object.entries(lead.rubricScores);
  return (
    <div className="rounded-xl border border-ink-border bg-ink-surface p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-paper-muted">
            Agent scorecard
          </p>
          <p className="mt-1 text-xs text-paper-muted">deterministic rubric · no LLM involved</p>
        </div>
        <p className="font-mono text-4xl font-semibold text-signal">
          {lead.leadScore}
          <span className="text-base text-paper-muted">/100</span>
        </p>
      </div>

      {lead.reasoningSummary && (
        <p className="mt-3 border-t border-ink-border pt-3 text-sm text-paper-muted">
          {lead.reasoningSummary}
        </p>
      )}

      <div className="mt-4 grid gap-2.5">
        {dimensions.map(([key, value]) => {
          const def = RUBRIC[key];
          const max = def?.max ?? 20;
          const label = def?.label ?? key.replace(/_/g, " ");
          const justification = lead.rubricJustification?.[key];
          return (
            <div key={key}>
              <div className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-xs text-paper-muted">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-border">
                  <div
                    className="h-full rounded-full bg-signal/70"
                    style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-paper-muted">
                  {value}/{max}
                </span>
              </div>
              {justification && (
                <p className="ml-[172px] mt-0.5 text-xs text-paper-muted/60">{justification}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
