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
      <div className="rounded-xl border border-ink-border bg-ink-surface p-6">
        <p className="text-sm text-paper-muted">No agent activity yet for this lead.</p>
      </div>
    );
  }

  const justifications = lead.rubricJustification
    ? Object.entries(lead.rubricJustification)
    : [];

  return (
    <div className="rounded-xl border border-ink-border bg-ink-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-widest text-paper-muted">
        Agent thinking &amp; execution
      </p>

      <div className="mt-4 grid gap-4">
        {lead.researchBrief && (
          <div>
            <p className="mb-1.5 text-xs text-paper-muted">Research brief</p>
            <pre className="whitespace-pre-wrap rounded-lg border border-ink-border bg-ink p-3 font-mono text-xs text-paper-muted">
              {lead.researchBrief}
            </pre>
          </div>
        )}

        {justifications.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-paper-muted">Rubric reasoning</p>
            <ul className="grid gap-1.5">
              {justifications.map(([key, value]) => (
                <li key={key} className="text-xs text-paper-muted">
                  <span className="font-mono text-paper-muted/60">{key.replace(/_/g, " ")}</span>
                  <span className="text-paper-muted"> — {value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lead.reasoningSummary && (
          <div>
            <p className="mb-1.5 text-xs text-paper-muted">Score summary</p>
            <p className="text-sm text-paper-muted">{lead.reasoningSummary}</p>
          </div>
        )}

        {(lead.reviewNotes || lead.iterations != null) && (
          <div>
            <p className="mb-1.5 text-xs text-paper-muted">
              Critique loop ({lead.iterations ?? 0} pass{lead.iterations === 1 ? "" : "es"})
            </p>
            <p className="text-sm text-paper-muted">{lead.reviewNotes ?? "No critique recorded."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
