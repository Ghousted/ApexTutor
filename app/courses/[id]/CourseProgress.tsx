"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getEnrollment, type EnrollmentDoc } from "@/lib/enrollments";
import { useCountUp } from "@/lib/useCountUp";

const MINUTES_PER_LESSON = 6;
const RE_ENGAGEMENT_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Top-of-page progress strip for the course detail. Two responsibilities:
 *
 *   1. Promote the X/Y + remaining-minutes signal from the lesson list
 *      header up to a place the eye lands first.
 *   2. Detect long absences (lastVisitedAt > 3 days ago) and swap the
 *      generic "About this course" framing for a warmer
 *      "Welcome back — your tutor's been waiting" beat.
 *
 * Renders nothing until enrollment is hydrated, so anonymous viewers and
 * never-started courses get the static page without a layout flicker.
 */
export default function CourseProgress({
  courseId,
  totalLessons,
}: {
  courseId: string;
  totalLessons: number;
}) {
  const [enrollment, setEnrollment] = useState<EnrollmentDoc | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEnrollment(null);
        setHydrated(true);
        return;
      }
      try {
        const e = await getEnrollment(u.uid, courseId);
        setEnrollment(e);
      } catch {
        setEnrollment(null);
      } finally {
        setHydrated(true);
      }
    });
    return () => unsub();
  }, [courseId]);

  // Don't render anything until we know — keeps the page from jumping.
  if (!hydrated) return null;
  // No enrollment + no progress means the static "About this course" copy
  // is the right framing. Nothing to surface here.
  if (!enrollment || enrollment.completedLessonIds.length === 0) return null;

  const completed = enrollment.completedLessonIds.length;
  const remaining = Math.max(0, totalLessons - completed);
  const pct = totalLessons > 0
    ? Math.min(100, Math.round((completed / totalLessons) * 100))
    : 0;
  const minutesRemaining = remaining * MINUTES_PER_LESSON;
  const done = completed >= totalLessons;

  const daysSinceVisit = enrollment.lastVisitedAt
    ? Math.floor((Date.now() - enrollment.lastVisitedAt.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const isReturning =
    !done &&
    enrollment.lastVisitedAt &&
    Date.now() - enrollment.lastVisitedAt.getTime() > RE_ENGAGEMENT_THRESHOLD_MS;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mb-6"
    >
      {/* Re-engagement banner — replaces the progress strip for students
          who haven't visited in 3+ days. Includes the same progress data
          but with warmer copy. */}
      {isReturning ? (
        <div className="rounded-[14px] bg-coal border border-canvas-white p-5 card-accent-top">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-canvas-white text-void-black text-[10px] font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3 h-3" />
            Welcome back
          </div>
          <p className="text-sm text-canvas-white mb-3 leading-relaxed">
            It&apos;s been {daysSinceVisit} day{daysSinceVisit === 1 ? "" : "s"}{" "}
            — your tutor saved your spot. Pick up where you left off; you&apos;re{" "}
            <ProgressNumber pct={pct} />% through the course.
          </p>
          <ProgressBar pct={pct} />
          <p className="text-[11px] text-ash-gray mt-2">
            {completed} of {totalLessons} done · ~{minutesRemaining} min left
          </p>
        </div>
      ) : (
        // Normal in-progress / completed strip.
        <div className="rounded-[14px] bg-coal border border-[var(--border-subtle)] p-5 card-accent-top">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray">
              {done ? "Course complete" : "Your progress"}
            </p>
            <p className="text-[11px] font-semibold text-canvas-white">
              <ProgressNumber pct={pct} />%
            </p>
          </div>
          <ProgressBar pct={pct} />
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-[11px] text-ash-gray">
              {completed} of {totalLessons} lesson{totalLessons === 1 ? "" : "s"}
            </p>
            <p className="text-[11px] text-ash-gray">
              {done ? "Replay any lesson" : `~${minutesRemaining} min left`}
            </p>
          </div>
        </div>
      )}
    </motion.section>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-iron rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-canvas-white"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
      />
    </div>
  );
}

function ProgressNumber({ pct }: { pct: number }) {
  const display = useCountUp(pct);
  return <span>{display}</span>;
}
