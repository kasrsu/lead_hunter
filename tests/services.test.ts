import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { getCampaignWithStats, insertCampaign } from "@/lib/repositories/campaigns";
import { getLead, insertLeads, listLeadsByCampaign, updateLead } from "@/lib/repositories/leads";
import { moveLeadById } from "@/lib/services/leadService";
import type { Lead } from "@/lib/types";

const sampleLead: Lead = {
  placeId: "p1",
  name: "Cafe X",
  address: "1 Main St",
  phone: "+94 000 0000",
  rating: 4.5,
  reviews: 120,
  mapsUrl: "https://maps.google.com/?cid=1",
  category: "cafe",
};

describe("lead storage + services (SQLite :memory:)", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = ":memory:";
    closeDb(); // drop any earlier connection so the env var takes effect
    getDb(); // initialise schema
  });

  afterAll(() => closeDb());

  it("persists leads under a campaign", () => {
    const campaign = insertCampaign({ name: "Cafe sweep", keyword: "cafe", location: "Colombo", minRating: 0, minReviews: 0 });
    const [lead] = insertLeads(campaign.id, [sampleLead]);

    const stored = getLead(lead.id);
    expect(stored).not.toBeNull();
    expect(stored!.campaignId).toBe(campaign.id);
    expect(stored!.placeId).toBe("p1");
    expect(stored!.pipelineStage).toBe("new");
    expect(listLeadsByCampaign(campaign.id)).toHaveLength(1);
  });

  it("moves a lead through the pipeline and rejects invalid moves", () => {
    const campaign = insertCampaign({ name: "Pipeline", keyword: "k", location: "l", minRating: 0, minReviews: 0 });
    const [lead] = insertLeads(campaign.id, [sampleLead]);

    const ready = moveLeadById(lead.id, "ready");
    expect(ready.pipelineStage).toBe("ready");

    // new → won is not allowed
    const archived = moveLeadById(lead.id, "archived");
    expect(archived.pipelineStage).toBe("archived");

    // moves into "sent" never happen via a column move
    const [fresh] = insertLeads(campaign.id, [{ ...sampleLead, placeId: "p2" }]);
    expect(() => moveLeadById(fresh.id, "won")).toThrow();
    expect(() => moveLeadById(fresh.id, "sent")).toThrow();
  });

  it("edits the editable fields (contact email, draft) and stamps updated_at", () => {
    const campaign = insertCampaign({ name: "Edit", keyword: "k", location: "l", minRating: 0, minReviews: 0 });
    const [lead] = insertLeads(campaign.id, [sampleLead]);

    const updated = updateLead(lead.id, {
      contactEmail: "owner@cafex.com",
      emailSubject: "Outreach & Partnership Proposal - Cafe X",
      emailBody: "Dear Cafe X Team,\n\nYou don't have a website listed on Google…",
    });

    expect(updated.contactEmail).toBe("owner@cafex.com");
    expect(updated.emailSubject).toMatch(/Outreach & Partnership Proposal/);
    expect(updated.updatedAt).toBeTruthy();
  });

  it("computes campaign stats from persisted leads", () => {
    const campaign = insertCampaign({ name: "Stats", keyword: "k", location: "l", minRating: 0, minReviews: 0 });
    insertLeads(campaign.id, [
      sampleLead,
      { ...sampleLead, placeId: "p2" },
      { ...sampleLead, placeId: "p3" },
    ]);
    const stats = getCampaignWithStats(campaign.id);
    expect(stats).not.toBeNull();
    expect(stats!.leadCount).toBe(3);
    expect(stats!.stageCounts.new).toBe(3);
  });
});
