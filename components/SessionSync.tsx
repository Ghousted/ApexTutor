"use client";

import { useEffect } from "react";
import { onAuthStateChanged, onIdTokenChanged, getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Keeps the server's session cookie in sync with the client's Firebase
 * Auth state. Without this:
 *
 *   - Users who signed in BEFORE the session-cookie flow existed never
 *     get a cookie, so paid courses look locked forever.
 *   - Firebase rotates idTokens every hour. Our cookie is independent
 *     (Admin-minted) so it's fine for ~5 days, but a long-lived tab
 *     might have a Firebase user the server doesn't know about if the
 *     cookie expired or was cleared.
 *   - A different tab signing OUT should propagate to this tab.
 *
 * Mounted once at the root layout. Renders nothing.
 */
export default function SessionSync() {
  useEffect(() => {
    let lastUid: string | null | undefined = undefined;

    const sync = async (user: import("firebase/auth").User | null) => {
      // Avoid re-syncing for the same user on every token refresh.
      if (user?.uid === lastUid) return;
      lastUid = user?.uid ?? null;

      if (!user) {
        // Best-effort cookie clear; harmless if already cleared.
        try {
          await fetch("/api/auth/session", { method: "DELETE" });
        } catch {
          // ignore
        }
        return;
      }
      try {
        const idToken = await getIdToken(user, /* forceRefresh */ false);
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } catch {
        // ignore — paid-course gate will fall back to client gate
      }
    };

    const unsubAuth = onAuthStateChanged(auth, sync);
    // Also watch idToken changes so a forced refresh re-issues the cookie.
    const unsubToken = onIdTokenChanged(auth, sync);
    return () => {
      unsubAuth();
      unsubToken();
    };
  }, []);

  return null;
}
