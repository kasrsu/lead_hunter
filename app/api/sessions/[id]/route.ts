import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getUserSession,
  setActiveUserSession,
  deleteUserSession,
} from "@/lib/repositories/sessions";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = getUserSession(params.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const active = setActiveUserSession(params.id);
    const res = NextResponse.json({ success: true, session: active });
    res.cookies.set({
      name: "leadhunt_session_id",
      value: params.id,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set active session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (params.id === "sess_default") {
      return NextResponse.json(
        { error: "Cannot delete default master workspace session" },
        { status: 400 }
      );
    }
    const success = deleteUserSession(params.id);
    if (!success) {
      return NextResponse.json({ error: "Session not found or failed to delete" }, { status: 404 });
    }

    // Switch back to default session
    const defaultSession = setActiveUserSession("sess_default");
    const res = NextResponse.json({ success: true, fallbackSession: defaultSession });
    res.cookies.set({
      name: "leadhunt_session_id",
      value: "sess_default",
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete session" },
      { status: 500 }
    );
  }
}
