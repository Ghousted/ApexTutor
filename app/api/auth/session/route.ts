// Session cookie endpoint. Client signs in via Firebase Auth (idToken
// returned by the client SDK) and POSTs that idToken here; we mint a
// long-lived HttpOnly session cookie via Firebase Admin so server
// components can verify the user without trusting client-side state.
//
// Without this, every "is this user logged in / subscribed" check has to
// happen in the browser — which means the lesson HTML is rendered before
// the gate runs. A leak. The cookie fixes that.

import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const COOKIE_NAME = "session";
// 5 days — Firebase's max for session cookies. Long enough to feel
// "stay signed in", short enough that a compromised cookie expires.
const EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const idToken = body.idToken?.trim();
  if (!idToken) {
    return Response.json({ error: "Missing idToken" }, { status: 400 });
  }
  try {
    // Verify the idToken to extract the uid (and as an early sanity check).
    // createSessionCookie also verifies, but verifyIdToken gives us the
    // uid for the response payload before minting.
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken, true);
    const sessionCookie = await getAuth(adminApp()).createSessionCookie(
      idToken,
      { expiresIn: EXPIRES_IN_MS }
    );
    const res = Response.json({ uid: decoded.uid });
    res.headers.set(
      "Set-Cookie",
      cookieString(COOKIE_NAME, sessionCookie, EXPIRES_IN_MS / 1000)
    );
    return res;
  } catch (e) {
    console.error("[/api/auth/session POST] failed:", e);
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }
}

export async function DELETE() {
  // Clear the cookie. Firebase doesn't have a server-side revoke for the
  // cookie itself — revoking is best-effort via revokeRefreshTokens for
  // the user, which is overkill for normal sign-out. Clearing is enough
  // for our threat model.
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", cookieString(COOKIE_NAME, "", 0));
  return res;
}

function cookieString(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  // Set Secure in production so the cookie can't be sniffed off http.
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
