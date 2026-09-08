"use client";

import { humanizeLabel } from "@/lib/format";
import type { PersistedLead } from "@/lib/types";
import DispatchAgentButton from "./DispatchAgentButton";

interface KanbanCardProps {
  lead: PersistedLead;
  dragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, leadId: string) => void;
  onDragEnd: () => void;
  onOpen: (leadId: string) => void;
}

export default function KanbanCard({ lead, dragging, onDragStart, onDragEnd, onOpen }: KanbanCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(lead.id)}
      className={`group relative cursor-grab rounded-lg border border-ink-border bg-ink px-3.5 py-3 transition active:cursor-grabbing ${
        dragging ? "rotate-1 opacity-40" : "hover:border-cyan-500/50 hover:bg-ink-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-paper">{lead.name}</p>
        {lead.leadScore != null && (
          <span
            className={`shrink-0 font-mono text-sm font-semibold ${
              lead.leadScore >= 70 ? "text-noise" : lead.leadScore >= 40 ? "text-signal" : "text-paper-muted"
            }`}
          >
            {lead.leadScore}
          </span>
        )}
      </div>

      {lead.address && (
        <p className="mt-1 truncate text-xs text-paper-muted">{lead.address}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-paper-muted">
            {lead.rating.toFixed(1)}★ · {lead.reviews}
          </span>
          {lead.classification && (
            <span className="rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 text-[10px] font-medium text-signal">
              {humanizeLabel(lead.classification)}
            </span>
          )}
        </div>

        {/* AI Agent Quick Dispatch Button on Card */}
        {lead.pipelineStage !== "sent" && lead.pipelineStage !== "archived" && (
          <div className="mt-1 w-full pt-1.5 border-t border-ink-border/50 flex justify-end">
            <DispatchAgentButton
              leadId={lead.id}
              leadName={lead.name}
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
