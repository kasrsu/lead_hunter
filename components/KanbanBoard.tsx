"use client";

import { useState } from "react";
import { canTransition, PIPELINE } from "@/lib/kanban";
import type { PipelineStage, PersistedLead } from "@/lib/types";
import KanbanCard from "./KanbanCard";

interface KanbanBoardProps {
  leads: PersistedLead[];
  onMove: (leadId: string, to: PipelineStage) => Promise<void>;
  /** Fired when a card is dropped on "Sent" — the parent decides how to send. */
  onSend: (leadId: string) => void;
  onOpen: (leadId: string) => void;
}

export default function KanbanBoard({ leads, onMove, onSend, onOpen }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStage | null>(null);

  const byStage = new Map<PipelineStage, PersistedLead[]>();
  for (const col of PIPELINE) byStage.set(col.stage, []);
  for (const lead of leads) {
    const bucket = byStage.get(lead.pipelineStage);
    if (bucket) bucket.push(lead);
  }

  function canDrop(from: PipelineStage, to: PipelineStage): boolean {
    return to === "sent" || canTransition(from, to);
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, leadId: string) {
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, to: PipelineStage) {
    e.preventDefault();
    setOverStage(null);
    const leadId = draggingId ?? e.dataTransfer.getData("text/plain");
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    setDraggingId(null);
    if (to === "sent") {
      onSend(leadId); // sending is a real action — the parent confirms first
      return;
    }
    if (canTransition(lead.pipelineStage, to)) {
      void onMove(leadId, to);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE.map((col) => {
        const count = (byStage.get(col.stage) ?? []).length;
        const highlight =
          draggingId && overStage === col.stage && canDrop(leads.find((l) => l.id === draggingId)?.pipelineStage ?? "new", col.stage);

        return (
          <div
            key={col.stage}
            onDragOver={(e) => {
              const lead = leads.find((l) => l.id === draggingId);
              if (lead && canDrop(lead.pipelineStage, col.stage)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverStage(col.stage);
              }
            }}
            onDragLeave={() => setOverStage((s) => (s === col.stage ? null : s))}
            onDrop={(e) => handleDrop(e, col.stage)}
            className={`flex min-h-[260px] w-64 shrink-0 flex-col rounded-xl border bg-ink-surface/60 transition ${
              highlight ? "border-signal/60 ring-1 ring-signal/40" : "border-ink-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-ink-border px-3.5 py-2.5">
              <span className={`flex items-center gap-2 text-xs font-medium ${col.text}`}>
                <span className={`h-2 w-2 rounded-full ${col.dot}`} aria-hidden />
                {col.label}
              </span>
              <span className="rounded-full bg-ink-border px-2 py-0.5 font-mono text-[11px] text-paper-muted">
                {count}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
              {count === 0 ? (
                <p className="px-1 py-6 text-center font-mono text-[11px] text-paper-muted/50">
                  {col.stage === "ready" ? "drafts waiting for your approval" : "no leads here yet"}
                </p>
              ) : (
                (byStage.get(col.stage) ?? []).map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    dragging={draggingId === lead.id}
                    onDragStart={handleDragStart}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                    onOpen={onOpen}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
