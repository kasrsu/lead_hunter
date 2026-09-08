import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppLeadById } from "@/lib/services/leadService";
import type { SenderProfile } from "@/lib/types";

export const runtime = "nodejs";

/** POST /api/leads/[id]/send-whatsapp — send the outreach message via WhatsApp and move lead to "Sent". */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const sender = (body?.sender || {
      senderName: "EVO Solutions Outreach",
      senderCompany: "EVO Solutions",
      offerDescription: "Digital storefront optimization",
      senderEmail: "outreach@evosolutions.lk",
    }) as SenderProfile;

    const res = await sendWhatsAppLeadById(params.id, sender);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "WhatsApp send failed" }, { status: 500 });
  }
}
