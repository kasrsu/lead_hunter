import { NextRequest, NextResponse } from "next/server";
import {
  getDeploymentStatus,
  pauseDeployment,
  resumeDeployment,
  setAutoSendMode,
  startDeployment,
  stopDeployment,
} from "@/lib/services/agentDeploymentRunner";

export const runtime = "nodejs";

/** GET /api/agent/deploy — Get live Robot Department deployment status & terminal logs */
export async function GET() {
  const status = getDeploymentStatus();
  return NextResponse.json({ status });
}

/** POST /api/agent/deploy — Start autonomous Robot Department execution */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const autoSend = Boolean(body?.autoSend);
    const status = await startDeployment(autoSend);
    return NextResponse.json({ status, message: "Robot Department execution launched." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Deployment failed" }, { status: 500 });
  }
}

/** PATCH /api/agent/deploy — Pause, Resume, or Toggle Auto-Send mode */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, autoSend } = body || {};

    let status = getDeploymentStatus();
    if (action === "pause") {
      status = pauseDeployment();
    } else if (action === "resume") {
      status = resumeDeployment();
    } else if (action === "toggleAutoSend") {
      status = setAutoSendMode(Boolean(autoSend));
    }

    return NextResponse.json({ status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Action failed" }, { status: 500 });
  }
}

/** DELETE /api/agent/deploy — Cancel/stop Robot Department execution */
export async function DELETE() {
  const status = stopDeployment();
  return NextResponse.json({ status, message: "Deployment stop requested." });
}
