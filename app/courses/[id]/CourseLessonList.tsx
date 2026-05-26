"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, BookOpen, ArrowRight } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion } from "motion/react";
import { auth } from "@/lib/firebase";
import { getEnrollment, type EnrollmentDoc } from "@/lib/enrollments";
import { cn } from "@/lib/utils";

interface LessonLite {
  id: string;
  title: string;
  objective?: string;
  stepCount: number;
}

/**
 * Lesson list that visually differentiates rows by the student's progress:
 *
 *   completed → check icon, dimmed, still clickable to replay
 *   current   → highlighted with a "Continue here" pill, fully lit
 *   upcoming  → default state
 *
 * Falls back to the no-enrollment view (all rows look identical, first is
 * implicitly "current") if the student isn't signed in or has never opened
 * this course.
 */
export default function CourseLessonList({
  courseId,
  lessons,
}: {
  courseId: string;
  lessons: LessonLite[];
}) {
  const [enrollment, setEnrollment] = useState<EnrollmentDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEnrollment(null);
        setLoading(false);
        return;
      }
      try {
        const e = await getEnrollment(u.uid, courseId);
        setEnrollment(e);
      } catch {
        setEnrollment(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [courseId]);

  const completed = new Set(enrollment?.completedLessonIds ?? []);
  // "Current" = the next lesson the student should do. Falls back to the
  // first uncompleted lesson if enrollment.currentLessonId is stale.
  const currentId =
    enrollment?.currentLessonId &&
    lessons.some((l) => l.id === enrollment.currentLessonId) &&
    !completed.has(enrollment.currentLessonId)
      ? enrollment.currentLessonId
      : lessons.find((l) => !completed.has(l.id))?.id ?? null;

  if (lessons.length === 0) {
    return (
      <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-8 text-center">
        <BookOpen className="w-6 h-6 mx-auto text-ash-gray mb-2" />
        <p className="text-sm text-ash-gray">No lessons yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] overflow-hidden">
      <header className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray">
          What you&apos;ll learn ({lessons.length})
        </h2>
        {!loading && enrollment && completed.size > 0 && (
          <p className="text-[11px] text-ash-gray">
            {completed.size}/{lessons.length} complete
          </p>
        )}
      </header>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {lessons.map((l, i) => {
          const isCompleted = completed.has(l.id);
          const isCurrent = l.id === currentId;
          return (
            <LessonRow
              key={l.id}
              courseId={courseId}
              lesson={l}
              index={i}
              state={isCompleted ? "completed" : isCurrent ? "current" : "upcoming"}
            />
          );
        })}
      </ul>
    </div>
  );
}

function LessonRow({
  courseId,
  lesson,
  index,
  state,
}: {
  courseId: string;
  lesson: LessonLite;
  index: number;
  state: "completed" | "current" | "upcoming";
}) {
  return (
    <motion.li
      whileHover={{ backgroundColor: "rgba(38,38,38,0.6)" }}
      className={cn(
        "transition-colors",
        state === "current" && "bg-iron/40"
      )}
    >
      <Link
        href={`/learn/${courseId}/${lesson.id}`}
        className="block px-5 py-3.5 flex items-start gap-3"
      >
        {/* Status icon */}
        {state === "completed" ? (
          <span className="w-7 h-7 rounded-md bg-canvas-white text-void-black flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" strokeWidth={3} />
          </span>
        ) : state === "current" ? (
          <span className="w-7 h-7 rounded-md bg-canvas-white text-void-black text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
        ) : (
          <span className="w-7 h-7 rounded-md bg-iron border border-[var(--border-subtle)] text-ash-gray text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p
              className={cn(
                "text-sm font-semibold truncate",
                state === "completed" ? "text-ash-gray" : "text-canvas-white"
              )}
            >
              {lesson.title}
            </p>
            {state === "current" && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-void-black bg-canvas-white rounded-md px-1.5 py-0.5 shrink-0">
                Continue here
              </span>
            )}
          </div>
          {lesson.objective && (
            <p
              className={cn(
                "text-xs line-clamp-2",
                state === "completed" ? "text-ash-gray/60" : "text-ash-gray"
              )}
            >
              {lesson.objective}
            </p>
          )}
          <p className="text-[11px] text-ash-gray/70 mt-1">
            {lesson.stepCount} step{lesson.stepCount === 1 ? "" : "s"}
          </p>
        </div>

        {state !== "completed" && (
          <ArrowRight className="w-4 h-4 text-ash-gray group-hover:text-canvas-white shrink-0 mt-1" />
        )}
      </Link>
    </motion.li>
  );
}
