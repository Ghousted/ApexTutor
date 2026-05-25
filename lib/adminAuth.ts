// Server-side admin verification for protected API routes.
//
// Client guards (AdminGuard) prevent the UI from rendering admin pages to
// non-admins. But anyone with DevTools can call the admin APIs directly, so
// API routes that perform admin actions MUST re-check server-side.
//
// Flow:
//   1. Client sends `Authorization: Bearer <firebase_id_token>` header
//   2. Server verifies the token via Firebase Admin SDK
//   3. Server checks the decoded UID against the admin allowlist

import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "./firebaseAdmin";
import { isAdmin } from "./admin";

export interface AdminAuthResult {
  ok: boolean;
  uid?: string;
  reason?: "missing_token" | "invalid_token" | "not_admin";
}

export async function verifyAdmin(req: NextRequest): Promise<AdminAuthResult> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return { ok: false, reason: "missing_token" };
  }
  const idToken = header.slice("Bearer ".length).trim();
  if (!idToken) return { ok: false, reason: "missing_token" };

  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(idToken);
    if (!isAdmin(decoded.uid)) {
      return { ok: false, reason: "not_admin" };
    }
    return { ok: true, uid: decoded.uid };
  } catch (e) {
    console.error("verifyAdmin: token verification failed:", e);
    return { ok: false, reason: "invalid_token" };
  }
}

/**
 * Returns a NextResponse for failed admin checks. Centralized so the routes
 * all return the same shape.
 */
export function unauthorizedResponse(reason?: string): Response {
  return Response.json({ error: reason || "Unauthorized" }, { status: 401 });
}
