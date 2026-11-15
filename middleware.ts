import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "leadhunt_session_id";
export const SESSION_HEADER_NAME = "x-session-id";
export const DEFAULT_SESSION_ID = "sess_default";

/**
 * Next.js Session Management Middleware
 *
 * Ensures every incoming user request gets a distinct, non-conflicting session identifier.
 * Reads the session ID from the `leadhunt_session_id` cookie or `x-session-id` header.
 * If missing, assigns a new persistent session ID and sets an HTTP-only cookie.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 1. Extract session ID from cookie or incoming header
  const existingCookieSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const existingHeaderSession = request.headers.get(SESSION_HEADER_NAME);

  const sessionId =
    existingHeaderSession || existingCookieSession || DEFAULT_SESSION_ID;

  // 2. Pass session ID down to Server Components and API routes via request headers
  request.headers.set(SESSION_HEADER_NAME, sessionId);
  response.headers.set(SESSION_HEADER_NAME, sessionId);

  // 3. Ensure the cookie is populated if missing
  if (!existingCookieSession) {
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      path: "/",
      httpOnly: false, // Accessible to client-side fetch for session switcher
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and Next.js internal assets:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
