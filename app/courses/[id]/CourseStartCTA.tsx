"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  watchSubscription,
  hasActiveSubscription,
  type Subscription,
} from "@/lib/subscription";

/**
 * Start-course CTA with paywall awareness. If the course is on the free
 * tier, this is just a regular "Start course" link. If it's paid and the
 * student doesn't have an active sub, it flips to a clear "Subscribe to
 * unlock" CTA pointing at /#pricing.
 *
 * Avoids a flash of the wrong state by hiding until subscription is
 * resolved for paid courses; free courses render their CTA immediately.
 */
export default function CourseStartCTA({
  courseId,
  firstLessonId,
  freeTier,
}: {
  courseId: string;
  firstLessonId: string | null;
  freeTier: boolean;
}) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [sub, setSub] = useState<Subscription | null | undefined>(null);
  const [hydrated, setHydrated] = useState(freeTier); // free → no need to wait

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u && !freeTier) setHydrated(true);
    });
    return () => unsub();
  }, [freeTier]);

  useEffect(() => {
    if (!user || freeTier) return;
    const unsub = watchSubscription(user.uid, (s) => {
      setSub(s);
      setHydrated(true);
    });
    return () => unsub();
  }, [user, freeTier]);

  if (!firstLessonId) {
    return (
      <p className="text-center text-sm text-ash-gray">
        This course doesn&apos;t have any lessons yet.
      </p>
    );
  }

  const locked = !freeTier && !hasActiveSubscription(sub ?? null);

  // For paid courses we wait for the subscription check before deciding what
  // CTA to show — otherwise a paying student briefly sees "Subscribe to
  // unlock" on every page load.
  if (!hydrated) {
    return (
      <div className="w-full h-14 rounded-lg bg-iron border border-[var(--border-subtle)] animate-pulse" />
    );
  }

  if (locked) {
    return (
      <Link
        href="/#pricing"
        className="w-full block text-center px-5 py-4 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold transition-opacity active:scale-95 shadow-md"
      >
        <span className="inline-flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Subscribe to unlock
          <Sparkles className="w-4 h-4" />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/learn/${courseId}/${firstLessonId}`}
      className="w-full block text-center px-5 py-4 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold transition-opacity active:scale-95 shadow-md"
    >
      <span className="inline-flex items-center gap-2">
        Start course
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}
