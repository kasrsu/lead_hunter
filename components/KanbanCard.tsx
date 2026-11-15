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
      className={`group relative cursor-grab rounded-xl border border-orange-200/80 bg-white/90 backdrop-blur-xl p-3.5 shadow-sm transition hover:border-orange-400 hover:shadow-md shadow-orange-500/5 active:cursor-grabbing ${
        dragging ? "rotate-1 opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold leading-snug text-slate-900 group-hover:text-orange-600 transition-colors">{lead.name}</p>
        {lead.leadScore != null && (
          <span
            className={`shrink-0 font-mono text-xs font-extrabold px-2 py-0.5 rounded-full border ${
              lead.leadScore >= 70
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-xs"
                : lead.leadScore >= 40
                ? "bg-orange-100 text-orange-950 border-orange-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {lead.leadScore}/100
          </span>
        )}
      </div>

      {lead.address && (
        <p className="mt-1 truncate text-xs text-slate-600 font-medium">{lead.address}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-orange-100">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-orange-950 font-bold">
            {lead.rating.toFixed(1)}★ · {lead.reviews}
          </span>
          {lead.classification && (
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-900">
              {humanizeLabel(lead.classification)}
            </span>
          )}
        </div>

        {/* AI Agent Quick Dispatch Button on Card */}
        {lead.pipelineStage !== "sent" && lead.pipelineStage !== "archived" && (
          <div className="mt-1 w-full pt-1.5 border-t border-orange-100 flex justify-end">
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
