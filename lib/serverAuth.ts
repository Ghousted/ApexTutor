// Server-side auth helpers. Use these in Server Components or route
// handlers to know which Firebase user (if any) made the request, without
// trusting client-side state.

import "server-only";
import { cookies } from "next/headers";
import { getAuth } from "firebase-admin/auth";
import { adminApp, adminDb } from "./firebaseAdmin";

const COOKIE_NAME = "session";

export interface ServerSession {
  uid: string;
  email?: string;
}

/** Returns the verified session (uid) for this request, or null. */
export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  try {
    // checkRevoked=true: catches users who've been disabled / had their
    // refresh tokens revoked since the cookie was issued.
    const decoded = await getAuth(adminApp()).verifySessionCookie(
      sessionCookie,
      true
    );
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    // Cookie is malformed / expired / revoked.
    return null;
  }
}

/** Server-side read of the student's enrollment for a course. Used by the
 *  /learn page to enforce progressive unlocking — students can only open
 *  lessons up through the next uncompleted one. */
export async function getServerEnrollment(
  uid: string,
  courseId: string
): Promise<{ completedLessonIds: string[] } | null> {
  try {
    const snap = await adminDb()
      .collection("users")
      .doc(uid)
      .collection("enrollments")
      .doc(courseId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    return {
      completedLessonIds: Array.isArray(data.completedLessonIds)
        ? (data.completedLessonIds as string[])
        : [],
    };
  } catch (e) {
    console.error("[serverAuth] enrollment read failed:", e);
    return null;
  }
}

/** Returns true if the user has an active subscription right now. Reads
 *  the `subscription` map on the user doc via the Admin SDK so it
 *  bypasses client security rules. */
export async function hasActiveServerSubscription(uid: string): Promise<boolean> {
  try {
    const snap = await adminDb().collection("users").doc(uid).get();
    if (!snap.exists) return false;
    const sub = (snap.data() ?? {}).subscription as
      | { status?: string; validUntil?: number | { toMillis?: () => number } }
      | undefined;
    if (!sub || sub.status !== "active") return false;
    const validUntilMs =
      typeof sub.validUntil === "number"
        ? sub.validUntil
        : sub.validUntil && typeof sub.validUntil.toMillis === "function"
          ? sub.validUntil.toMillis()
          : 0;
    return validUntilMs > Date.now();
  } catch (e) {
    console.error("[serverAuth] subscription read failed:", e);
    return false;
  }
}
