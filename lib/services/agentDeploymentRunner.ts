import fs from "node:fs";
import path from "node:path";
import { insertCampaign } from "../repositories/campaigns";
import { insertLeads, listAllLeads } from "../repositories/leads";
import { enrichLeadById, sendLeadById } from "./leadService";
import {
  getTelegramConfig,
  notifyDeploymentComplete,
  notifyDeploymentStart,
  notifyEmailDispatched,
  notifyLeadEnriched,
} from "./telegramService";
import type { AgentDeploymentState, RobotLogEntry } from "../types";
import { DEFAULT_SENDER } from "../useSenderProfile";

let state: AgentDeploymentState = {
  isRunning: false,
  isPaused: false,
  autoSendMode: false,
  totalLeads: 0,
  processedCount: 0,
  successCount: 0,
  sentCount: 0,
  telegramEnabled: false,
  error: null,
  logs: [],
};

let cancelRequested = false;

function addRobotLog(
  robot: RobotLogEntry["robot"],
  message: string,
  type: RobotLogEntry["type"] = "info"
) {
  const entry: RobotLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    robot,
    message,
    type,
  };
  state.logs = [entry, ...state.logs.slice(0, 49)];
}

export function getDeploymentStatus(): AgentDeploymentState {
  const telegramConfig = getTelegramConfig();
  return {
    ...state,
    telegramEnabled: telegramConfig.enabled,
  };
}

export function stopDeployment(): AgentDeploymentState {
  if (state.isRunning) {
    cancelRequested = true;
    state.isPaused = false;
    state.currentStepMessage = "Stopping Robot Department execution...";
    addRobotLog("System", "Deployment stop requested by user.", "warning");
  }
  return getDeploymentStatus();
}

export function pauseDeployment(): AgentDeploymentState {
  if (state.isRunning && !state.isPaused) {
    state.isPaused = true;
    state.currentStepMessage = "⏸️ Robot Department Paused";
    addRobotLog("System", "Robot Department paused.", "warning");
  }
  return getDeploymentStatus();
}

export function resumeDeployment(): AgentDeploymentState {
  if (state.isRunning && state.isPaused) {
    state.isPaused = false;
    addRobotLog("System", "Robot Department resumed execution.", "info");
  }
  return getDeploymentStatus();
}

export function setAutoSendMode(enabled: boolean): AgentDeploymentState {
  state.autoSendMode = enabled;
  addRobotLog(
    "System",
    enabled
      ? "⚡ Auto-Send Robot Mode ENABLED (Emails will be sent automatically in parallel)"
      : "🛡️ Human Approval Mode ENABLED (Emails queued in Approval Queue)",
    "info"
  );
  return getDeploymentStatus();
}

/**
 * Starts autonomous batch execution over leads with live robot department state.
 */
export async function startDeployment(autoSend = false): Promise<AgentDeploymentState> {
  if (state.isRunning) {
    if (state.isPaused) {
      return resumeDeployment();
    }
    return getDeploymentStatus();
  }

  let allLeads = listAllLeads();

  // If database is empty, auto-seed from archived lead details if available
  if (allLeads.length === 0) {
    try {
      const archiveDir = path.join(process.cwd(), "archived_programming");
      const detailsPath = path.join(archiveDir, "lead_details.json");
      if (fs.existsSync(detailsPath)) {
        const campaign = insertCampaign({
          name: "Archived Hospitality Leads (Sri Lanka)",
          keyword: "Fine Dining & Restaurants",
          location: "Colombo / Galle, Sri Lanka",
          minRating: 4.0,
          minReviews: 10,
        });
        const leadDetails: any[] = JSON.parse(fs.readFileSync(detailsPath, "utf-8"));
        const normalized = leadDetails.map((lead: any, idx: number) => ({
          placeId: `arch_${idx + 1}`,
          name: lead.name || `Restaurant ${idx + 1}`,
          category: lead.category || "Fine Dining",
          address: lead.address || "",
          phone: lead.phone || "",
          contactEmail: lead.email || "",
          rating: typeof lead.rating === "number" ? lead.rating : 4.5,
          reviews: typeof lead.review_count === "number" ? lead.review_count : 100,
          mapsUrl: lead.maps_url || "",
          website: lead.website || "",
          hasWebsite: Boolean(lead.website),
          priceRange: lead.price_range || "",
          reviewSnippet: lead.review_snippet || "",
          features: Array.isArray(lead.features) ? lead.features : [],
          instagram: lead.instagram || "",
          facebook: lead.facebook || "",
          hoursLabel: lead.hours_label || "",
          imageUrl: lead.image_url || "",
          source: "archived-preset" as const,
          pipelineStage: "new",
        }));
        insertLeads(campaign.id, normalized);
        allLeads = listAllLeads();
      }
    } catch {
      // best-effort auto-seed
    }
  }

  const targetLeads = allLeads.filter(
    (l) => l.pipelineStage === "new" || l.pipelineStage === "drafting" || !l.emailBody
  );

  const leadsToProcess = targetLeads.length > 0 ? targetLeads : allLeads;

  if (leadsToProcess.length === 0) {
    state.error = "No leads available in database. Add or search leads first!";
    return getDeploymentStatus();
  }


  const telegramConfig = getTelegramConfig();

  cancelRequested = false;
  state = {
    isRunning: true,
    isPaused: false,
    autoSendMode: autoSend,
    totalLeads: leadsToProcess.length,
    processedCount: 0,
    successCount: 0,
    sentCount: 0,
    startTime: new Date().toISOString(),
    telegramEnabled: telegramConfig.enabled,
    error: null,
    logs: [],
  };

  addRobotLog("System", `🚀 Robot Department deployed over ${leadsToProcess.length} leads!`, "success");

  // Asynchronous background execution
  void (async () => {
    try {
      await notifyDeploymentStart(leadsToProcess.length);

      for (let i = 0; i < leadsToProcess.length; i++) {
        if (cancelRequested) {
          addRobotLog("System", "Robot execution halted by user.", "warning");
          break;
        }

        // Handle pause wait loop cleanly
        while (state.isPaused) {
          if (cancelRequested) break;
          await new Promise((r) => setTimeout(r, 500));
        }

        if (cancelRequested) break;

        const lead = leadsToProcess[i];
        state.currentLeadId = lead.id;
        state.currentLeadName = lead.name;

        // Robot 1: Research & Metrics
        state.currentStepMessage = `[${i + 1}/${leadsToProcess.length}] 🔍 Research Robot: Analyzing "${lead.name}"...`;
        addRobotLog("Research Robot", `Calculating 4-part metrics & digital presence for "${lead.name}"...`, "info");
        await new Promise((r) => setTimeout(r, 350));

        // Robot 2: LangGraph Copywriter
        state.currentStepMessage = `[${i + 1}/${leadsToProcess.length}] 📝 Copywriter Robot: Drafting outreach for "${lead.name}"...`;
        addRobotLog("Copywriter Robot", `Generating customized outreach email for "${lead.name}"...`, "info");

        try {
          const enriched = await enrichLeadById(lead.id, DEFAULT_SENDER);
          state.successCount++;

          addRobotLog(
            "Copywriter Robot",
            `✨ Drafted: "${enriched.emailSubject}" (Score: ${enriched.opportunityScore ?? 50}/100)`,
            "success"
          );

          // Robot 3: Outbound Dispatcher (if Auto-Send Mode is ON & Contact Email exists)
          if (state.autoSendMode && enriched.contactEmail) {
            state.currentStepMessage = `[${i + 1}/${leadsToProcess.length}] ✉️ Outbound Robot: Sending email to ${enriched.contactEmail}...`;
            addRobotLog("Outbound Robot", `Dispatching email to ${enriched.contactEmail}...`, "info");

            try {
              await sendLeadById(enriched.id, DEFAULT_SENDER);
              state.sentCount++;
              addRobotLog("Outbound Robot", `📬 Email dispatched to ${enriched.contactEmail}!`, "success");
              await notifyEmailDispatched(enriched, enriched.contactEmail);
            } catch (sendErr: any) {
              addRobotLog("Outbound Robot", `Failed to send email to ${enriched.contactEmail}: ${sendErr.message}`, "warning");
            }
          } else {
            // Queue for Human Approval
            await notifyLeadEnriched(enriched);
            addRobotLog("System", `Queued "${lead.name}" in Approval Queue.`, "info");
          }
        } catch (err: any) {
          addRobotLog("Copywriter Robot", `Enrichment failed for "${lead.name}": ${err.message}`, "error");
        }

        state.processedCount = i + 1;
      }

      await notifyDeploymentComplete(state.processedCount, state.totalLeads, state.successCount);
      addRobotLog("System", `🎉 Batch completed: ${state.processedCount} processed, ${state.sentCount} emails sent!`, "success");
    } catch (err: any) {
      state.error = err.message;
      addRobotLog("System", `Fatal error: ${err.message}`, "error");
    } finally {
      state.isRunning = false;
      state.isPaused = false;
      state.currentLeadId = undefined;
      state.currentLeadName = undefined;
      state.currentStepMessage = undefined;
    }
  })();

  return getDeploymentStatus();
}
