import { PIPELINE } from "@/lib/kanban";
import type { PipelineStage } from "@/lib/types";

interface PipelineFunnelProps {
  funnel: Record<PipelineStage, number>;
}

/** Horizontal funnel: each pipeline stage's count as a bar of its share. */
export default function PipelineFunnel({ funnel }: PipelineFunnelProps) {
  const total = Object.values(funnel).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <p className="py-6 text-sm text-paper-muted">No leads yet — run a scan to start.</p>;
  }

  return (
    <div className="grid gap-2.5">
      {PIPELINE.map((col) => {
        const count = funnel[col.stage];
        const pct = Math.round((count / total) * 100);
        return (
          <div key={col.stage} className="flex items-center gap-3">
            <span className="flex w-40 shrink-0 items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} aria-hidden />
              <span className={`truncate text-xs ${col.text}`}>{col.label}</span>
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-border">
              <div
                className={`h-full rounded-full ${col.dot} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs text-paper-muted">
              {count} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
