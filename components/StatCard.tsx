interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-ink-border bg-ink-surface px-5 py-4">
      <p className="font-mono text-[11px] uppercase tracking-widest text-paper-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-paper">{value}</p>
      {hint && <p className="mt-1 text-xs text-paper-muted/70">{hint}</p>}
    </div>
  );
}
