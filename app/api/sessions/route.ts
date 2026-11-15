import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  listUserSessions,
  createUserSession,
  getOrCreateUserSession,
  setActiveUserSession,
} from "@/lib/repositories/sessions";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.headers.get("x-session-id") || "sess_default";
    const currentSession = getOrCreateUserSession(sessionId);
    const sessions = listUserSessions();

    return NextResponse.json({
      activeSession: currentSession,
      sessions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, name, description, sessionId } = body;

    if (action === "switch" && sessionId) {
      const active = setActiveUserSession(sessionId);
      const res = NextResponse.json({ success: true, session: active });
      res.cookies.set({
        name: "leadhunt_session_id",
        value: sessionId,
        path: "/",
        httpOnly: false,
        sameSite: "lax",
      });
      return res;
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Session name is required" },
        { status: 400 }
      );
    }

    const newSession = createUserSession(name, description || "");
    const active = setActiveUserSession(newSession.id);

    const res = NextResponse.json({ success: true, session: active });
    res.cookies.set({
      name: "leadhunt_session_id",
      value: newSession.id,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}
