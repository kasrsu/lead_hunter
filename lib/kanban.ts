import type { PipelineStage } from "./types";

/**
 * Kanban pipeline definition — the columns of the board, in left-to-right
 * order, mapped to the AI workflow in AI_IMPLEMENTATION.md:
 *
 *   Research → Draft → Critique → Revise → Human Approval → Send
 *
 * - `new`      the lead is found but the agent hasn't run yet (Research)
 * - `drafting` the agent is generating a scorecard + draft (Draft/Critique/Revise)
 * - `ready`    draft is done, awaiting the human's approval before sending
 * - `sent`     email sent
 * - `won`      the contact replied / the deal closed
 * - `archived` out of rotation
 */
export interface PipelineColumn {
  stage: PipelineStage;
  label: string;
  /** Tailwind accent for the column header dot. */
  dot: string;
  /** Tailwind classes for the column header text. */
  text: string;
}

export const PIPELINE: readonly PipelineColumn[] = [
  { stage: "new", label: "New", dot: "bg-slate-400", text: "text-slate-900" },
  { stage: "drafting", label: "Drafting", dot: "bg-amber-500", text: "text-slate-900" },
  { stage: "ready", label: "Awaiting approval", dot: "bg-orange-500", text: "text-slate-900" },
  { stage: "sent", label: "Sent", dot: "bg-emerald-500", text: "text-slate-900" },
  { stage: "won", label: "Won", dot: "bg-indigo-500", text: "text-slate-900" },
  { stage: "archived", label: "Archived", dot: "bg-rose-500", text: "text-slate-900" },
];

export function pipelineLabel(stage: PipelineStage): string {
  return PIPELINE.find((c) => c.stage === stage)?.label ?? stage;
}

/**
 * Pure transition rules for dragging a card between columns.
 *
 * The only column that can never be reached by a plain move is `sent` — a
 * card only gets there through the send action (which actually emails the
 * lead). That keeps the "human approval" step meaningful.
 */
export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  if (from === to) return true;
  if (to === "archived") return true; // archive from anywhere
  if (to === "won") return from === "sent"; // won only follows sent
  if (to === "sent") return false; // never via a plain column move
  if (from === "sent") return to === "new" || to === "ready"; // reopen a sent lead
  if (from === "won") return to === "new"; // reopen a won lead
  if (from === "archived") return to === "new"; // restore an archived lead
  return true; // free moves among new / drafting / ready
}
