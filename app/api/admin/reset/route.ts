import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST() {
  try {
    const db = getDb();
    db.exec(`
      DELETE FROM pending_approvals;
      DELETE FROM leads;
      DELETE FROM campaigns;
    `);

    return NextResponse.json({
      success: true,
      message: "All database records (campaigns, leads, approvals) have been cleared cleanly. All schemas and algorithms remain 100% intact.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reset database" },
      { status: 500 }
    );
  }
}
