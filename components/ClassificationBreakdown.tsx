import { humanizeLabel } from "@/lib/format";

interface ClassificationBreakdownProps {
  items: { classification: string; count: number }[];
}

/** Which lead classifications the agent has produced, as horizontal bars. */
export default function ClassificationBreakdown({ items }: ClassificationBreakdownProps) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-paper-muted">No scored leads yet.</p>;
  }
  const total = items.reduce((a, b) => a + b.count, 0);

  return (
    <div className="grid gap-2.5">
      {items.map((item) => {
        const pct = Math.round((item.count / total) * 100);
        return (
          <div key={item.classification} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate text-xs text-paper-muted" title={item.classification}>
              {humanizeLabel(item.classification)}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-border">
              <div
                className="h-full rounded-full bg-signal/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-xs text-paper-muted">
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
