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
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  lessonObjective: string;
  steps: Step[];
  instructorId: string | null;
  nextLessonId: string | null;
}) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
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
