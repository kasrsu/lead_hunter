import type { PersistedLead } from "@/lib/types";

interface AgentTraceProps {
  lead: PersistedLead;
}

/**
 * The agent's "thinking & executions": what it researched, what the scoring
 * rubric reasoned, and what its critique/revision loop said — the parts a
 * human should check before approving the send.
 */
export default function AgentTrace({ lead }: AgentTraceProps) {
  const hasAny = lead.researchBrief || lead.reviewNotes || lead.iterations != null;
  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-orange-200/80 bg-white/90 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5">
        <p className="text-sm text-slate-600 font-medium">No agent activity yet for this lead.</p>
      </div>
    );
  }

  const justifications = lead.rubricJustification
    ? Object.entries(lead.rubricJustification)
    : [];

  return (
    <div className="rounded-2xl border border-orange-200/80 bg-white/90 backdrop-blur-xl p-6 shadow-xl shadow-orange-500/5 space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-widest text-orange-950 font-bold">
        Agent thinking &amp; execution
      </p>

      <div className="grid gap-4">
        {lead.researchBrief && (
          <div>
            <p className="mb-1.5 text-xs text-orange-900 font-bold font-mono">Research Brief</p>
            <pre className="whitespace-pre-wrap rounded-xl border border-orange-200/80 bg-orange-50/50 p-4 font-mono text-xs text-slate-900 leading-relaxed">
              {lead.researchBrief}
            </pre>
          </div>
        )}

        {justifications.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-orange-900 font-bold font-mono">Rubric Reasoning</p>
            <ul className="grid gap-2">
              {justifications.map(([key, value]) => (
                <li key={key} className="text-xs text-slate-800 bg-orange-50/40 p-2.5 rounded-xl border border-orange-200/60 font-medium">
                  <span className="font-mono text-orange-950 font-bold">{key.replace(/_/g, " ")}:</span>
                  <span className="text-slate-800 ml-1.5">{value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lead.reasoningSummary && (
          <div>
            <p className="mb-1.5 text-xs text-orange-900 font-bold font-mono">Score Summary</p>
            <p className="text-xs text-slate-800 font-medium bg-orange-50/40 p-3 rounded-xl border border-orange-200/60">{lead.reasoningSummary}</p>
          </div>
        )}

        {(lead.reviewNotes || lead.iterations != null) && (
          <div>
            <p className="mb-1.5 text-xs text-orange-900 font-bold font-mono">
              Critique Loop ({lead.iterations ?? 0} pass{lead.iterations === 1 ? "" : "es"})
            </p>
            <p className="text-xs text-slate-800 font-medium bg-orange-50/40 p-3 rounded-xl border border-orange-200/60">{lead.reviewNotes ?? "No critique recorded."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
