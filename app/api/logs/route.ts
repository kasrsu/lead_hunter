import { NextResponse } from "next/server";
import { clearLogs, getRecentLogs, logActivity } from "@/lib/repositories/activityLogs";

export async function GET() {
  try {
    const logs = getRecentLogs(50);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const log = logActivity({
      level: body.level,
      category: body.category,
      message: body.message,
      details: body.details,
    });

    return NextResponse.json({ success: true, log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create log" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearLogs();
    return NextResponse.json({ success: true, message: "Logs cleared" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to clear logs" }, { status: 500 });
  }
}
