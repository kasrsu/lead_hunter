interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export default function StatCard({ label, value, hint }: StatCardProps) {
  const cleanLabel = label.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();

  return (
    <div className="apple-card px-5 py-4 hover:scale-[1.02] transition-transform">
      <p className="font-mono text-[11px] uppercase tracking-widest text-orange-800 font-bold">{cleanLabel}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 font-mono font-medium">{hint}</p>}
    </div>
  );
}
