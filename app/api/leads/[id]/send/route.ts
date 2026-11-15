import { NextRequest, NextResponse } from "next/server";
import { sendLeadById } from "@/lib/services/leadService";
import type { SenderProfile } from "@/lib/types";

export const runtime = "nodejs";

/** POST /api/leads/[id]/send — send the approved draft and move the lead to "Sent". */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const sender = body?.sender as SenderProfile;
    if (!sender) {
      return NextResponse.json({ error: "sender is required" }, { status: 400 });
    }
    const lead = await sendLeadById(params.id, sender);
    return NextResponse.json({ lead });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Send failed" }, { status: 500 });
  }
}
