"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { isAdmin } from "@/lib/admin";

/**
 * Wraps admin-only UI. Redirects to "/" if:
 *   - Auth is unresolved (waits first — no flash)
 *   - User is not signed in
 *   - User's UID isn't in NEXT_PUBLIC_ADMIN_UIDS
 *
 * NOTE: This is UI-level protection only. API routes that perform admin
 * actions (PDF upload, etc.) must independently verify the caller's Firebase
 * ID token and check the UID server-side. Client guards alone are bypassable.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!isAdmin(user.uid)) {
      router.replace("/");
    }
  }, [authResolved, user, router]);

  // Pre-resolved or rejected: show a quiet spinner instead of flashing the
  // protected content.
  if (!authResolved || !user || !isAdmin(user.uid)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-coal">
        <Loader2 className="w-6 h-6 animate-spin text-ash-gray" />
      </div>
    );
  }

  return <>{children}</>;
}
