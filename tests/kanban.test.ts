import { describe, expect, it } from "vitest";
import { canTransition, PIPELINE } from "@/lib/kanban";

describe("canTransition", () => {
  it("allows free moves among new / drafting / ready", () => {
    expect(canTransition("new", "ready")).toBe(true);
    expect(canTransition("new", "drafting")).toBe(true);
    expect(canTransition("drafting", "ready")).toBe(true);
    expect(canTransition("drafting", "new")).toBe(true);
    expect(canTransition("ready", "new")).toBe(true);
  });

  it("never lets a plain column move reach 'sent' — that's the send action", () => {
    for (const from of PIPELINE.map((c) => c.stage)) {
      if (from === "sent") continue; // a card already on "sent" can stay there
      expect(canTransition(from, "sent")).toBe(false);
    }
  });

  it("allows archiving from anywhere", () => {
    for (const from of PIPELINE.map((c) => c.stage)) {
      expect(canTransition(from, "archived")).toBe(true);
    }
  });

  it("only allows 'won' from 'sent'", () => {
    expect(canTransition("sent", "won")).toBe(true);
    expect(canTransition("ready", "won")).toBe(false);
    expect(canTransition("new", "won")).toBe(false);
    expect(canTransition("drafting", "won")).toBe(false);
    expect(canTransition("archived", "won")).toBe(false);
  });

  it("allows reopening a sent / won / archived lead back to the board", () => {
    expect(canTransition("sent", "new")).toBe(true);
    expect(canTransition("sent", "ready")).toBe(true);
    expect(canTransition("won", "new")).toBe(true);
    expect(canTransition("archived", "new")).toBe(true);
  });
});
