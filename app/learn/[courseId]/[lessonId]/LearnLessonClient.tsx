"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  ensureEnrollment,
  getEnrollment,
  setLessonProgress,
  markLessonComplete,
} from "@/lib/enrollments";
import CoursePlayer from "@/components/CoursePlayer";
import LoadingDots from "@/components/LoadingDots";
import { prefetchVoice } from "@/lib/tts";
import {
  watchSubscription,
  hasActiveSubscription,
  type Subscription,
} from "@/lib/subscription";
import Link from "next/link";
import { Lock, ArrowLeft, Sparkles } from "lucide-react";
import type { Step } from "@/lib/courses";

/**
 * Client wrapper for the linear lesson player. Reads the student's profile
 * (for {{studentName}} substitution in scripts) and their saved enrollment
 * (for resume-where-you-left-off), then hands off to CoursePlayer.
 */
export default function LearnLessonClient({
  courseId,
  lessonId,
  lessonTitle,
  lessonObjective,
  steps,
  instructorId,
  nextLessonId,
  freeTier,
  courseTitle,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  lessonObjective: string;
  steps: Step[];
  instructorId: string | null;
  nextLessonId: string | null;
  /** Whether the course is on the free tier. Paid courses require an
   *  active subscription. */
  freeTier: boolean;
  /** Course title shown on the paywall screen. */
  courseTitle: string;
}) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  // Subscription state — null means "still loading", undefined means
  // "loaded but no doc". We block the player until we know for sure so a
  // paid course doesn't flash visible before the paywall takes over.
  const [sub, setSub] = useState<Subscription | null | undefined>(null);
  const [subHydrated, setSubHydrated] = useState(false);
  const [studentName, setStudentName] = useState<string | null>(null);
  // null = still loading the enrollment / unknown resume position
  const [initialStepIndex, setInitialStepIndex] = useState<number | null>(null);
  const [streak, setStreak] = useState<number>(0);

  // Debounce ref for save-on-advance.
  const saveDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fire-and-forget voice prefetch on mount. Runs in parallel with auth /
  // enrollment / profile fetches so by the time the player mounts and tries
  // to speak the first script, the Kokoro model is usually already cached.
  useEffect(() => {
    prefetchVoice();
  }, []);

  // Watch the student's subscription. Only matters for paid (non-free)
  // courses, but we still subscribe so an in-session upgrade unlocks
  // immediately without a refresh.
  useEffect(() => {
    if (!user) {
      setSub(null);
      setSubHydrated(true);
      return;
    }
    const unsub = watchSubscription(user.uid, (s) => {
      setSub(s);
      setSubHydrated(true);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setStudentName(null);
        // Signed-out users can't have saved progress — start at 0.
        setInitialStepIndex(0);
        return;
      }
      setUser(u);

      // Pull profile.studentName + saved enrollment in parallel.
      try {
        const [profileSnap, enrollment] = await Promise.all([
          getDoc(doc(db, "users", u.uid)),
          getEnrollment(u.uid, courseId),
        ]);
        setStudentName(profileSnap.data()?.profile?.studentName ?? null);
        setStreak(enrollment?.streak ?? 0);

        // Resume position: if the student already has progress in this lesson
        // and hasn't completed it, jump them there. Otherwise start fresh.
        const lp = enrollment?.lessons?.[lessonId];
        const resumeIdx =
          lp && !lp.completed ? Math.max(0, lp.lastStepIndex) : 0;
        setInitialStepIndex(resumeIdx);

        // Touch the enrollment doc so this lesson becomes "current".
        await ensureEnrollment(u.uid, courseId, lessonId);
      } catch (e) {
        console.warn("[LearnLessonClient] progress load failed:", e);
        setInitialStepIndex(0);
      }
    });
    return () => unsub();
  }, [courseId, lessonId]);

  const handleStepAdvance = (newIndex: number) => {
    if (!user) return;
    // Debounce so rapid step changes coalesce into one Firestore write.
    if (saveDebouncerRef.current) clearTimeout(saveDebouncerRef.current);
    saveDebouncerRef.current = setTimeout(() => {
      setLessonProgress(user.uid, courseId, lessonId, newIndex).catch((e) =>
        console.warn("[LearnLessonClient] progress save failed:", e)
      );
    }, 600);
  };

  const handleLessonComplete = () => {
    if (!user) return;
    markLessonComplete(user.uid, courseId, lessonId, nextLessonId)
      .then((res) => setStreak(res.streak))
      .catch((e) =>
        console.warn("[LearnLessonClient] mark-complete failed:", e)
      );
  };

  // Paywall — block paid courses until we know the student's sub status
  // AND can confirm there's an active subscription. We show a loader
  // first so a returning subscriber doesn't see a paywall flicker.
  if (!freeTier) {
    if (!subHydrated) {
      return (
        <div className="min-h-screen bg-void-black flex items-center justify-center px-4">
          <LoadingDots size="lg" label="Checking your subscription…" />
        </div>
      );
    }
    if (!hasActiveSubscription(sub ?? null)) {
      return (
        <LockedScreen courseId={courseId} courseTitle={courseTitle} />
      );
    }
  }

  // Wait for the resume position to be known before mounting the player —
  // otherwise the player would briefly render at step 0 then jump.
  if (initialStepIndex === null) {
    return (
      <div className="min-h-screen bg-void-black flex items-center justify-center px-4">
        <LoadingDots size="lg" label="Picking up where you left off…" />
      </div>
    );
  }

  return (
    <CoursePlayer
      courseId={courseId}
      lessonId={lessonId}
      lessonTitle={lessonTitle}
      lessonObjective={lessonObjective}
      steps={steps}
      instructorId={instructorId}
      studentName={studentName}
      nextLessonId={nextLessonId}
      initialStepIndex={initialStepIndex}
      streak={streak}
      onStepAdvance={handleStepAdvance}
      onLessonComplete={handleLessonComplete}
    />
  );
}

/** Shown when the student opens a paid lesson without an active sub. We
 *  deliberately don't expose any of the lesson content (script, steps) —
 *  the parent client component bails out before the player renders. */
function LockedScreen({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  return (
    <div className="min-h-screen bg-void-black inside-surface flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-iron border border-[var(--border-strong)] flex items-center justify-center mb-5">
        <Lock className="w-7 h-7 text-canvas-white" />
      </div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
        Paid course
      </p>
      <h1
        className="font-bold text-canvas-white mb-3 leading-tight"
        style={{ fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "-0.54px" }}
      >
        {courseTitle}
      </h1>
      <p className="text-sm text-ash-gray mb-8 max-w-prose">
        This course is part of our paid catalog. Upgrade once and unlock every
        non-free course, every lesson, every tutor — anytime.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/#pricing"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold text-sm shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          See plans
        </Link>
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-iron border border-[var(--border-strong)] text-canvas-white rounded-lg font-medium text-sm hover:bg-[#2e2e2e]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to course
        </Link>
      </div>
    </div>
  );
}
