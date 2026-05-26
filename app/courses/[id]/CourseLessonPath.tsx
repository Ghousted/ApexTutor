"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Lock, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getEnrollment, type EnrollmentDoc } from "@/lib/enrollments";
import TutorAvatar from "@/components/TutorAvatar";
import { cn } from "@/lib/utils";

interface LessonLite {
  id: string;
  title: string;
  objective?: string;
  stepCount: number;
}

/**
 * Lesson path — replaces the flat list of rows with a winding zigzag of
 * circular nodes, Duolingo-tree-style but compact. Vertical scroll, alt
 * left/center/right anchored so the path "snakes" down the page.
 *
 * Each node communicates:
 *   - state (completed / current / upcoming / locked) via fill + icon
 *   - the tutor's presence (small avatar) so it feels like the tutor
 *     is calling the student onward
 *   - lesson title + estimate underneath
 *
 * Connector curves are rendered as a single SVG behind the nodes so the
 * visual flow is unbroken.
 */
export default function CourseLessonPath({
  courseId,
  instructorId,
  lessons,
}: {
  courseId: string;
  instructorId: string | null;
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
          The path ({lessons.length})
        </h2>
        {!loading && enrollment && completed.size > 0 && (
          <p className="text-[11px] text-ash-gray">
            {completed.size}/{lessons.length} complete
          </p>
        )}
      </header>

      <div className="relative px-4 py-8">
        {/* Background connector — a single SVG path that snakes through the
            node positions, rendered behind the nodes. */}
        <ConnectorPath count={lessons.length} />

        <ul className="relative flex flex-col gap-6">
          {lessons.map((l, i) => {
            const isCompleted = completed.has(l.id);
            const isCurrent = l.id === currentId;
            const isLocked = !isCompleted && !isCurrent;
            // Alternate left/right anchor so the path zigzags. Even = left
            // of center, odd = right of center. First and last anchored
            // to centre for a cleaner top/bottom.
            const isFirst = i === 0;
            const isLast = i === lessons.length - 1;
            const anchor: "left" | "right" | "center" =
              isFirst || isLast
                ? "center"
                : i % 2 === 1
                  ? "right"
                  : "left";
            return (
              <LessonNode
                key={l.id}
                courseId={courseId}
                instructorId={instructorId}
                lesson={l}
                index={i}
                anchor={anchor}
                state={
                  isCompleted
                    ? "completed"
                    : isCurrent
                      ? "current"
                      : isLocked
                        ? "locked"
                        : "upcoming"
                }
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Vertical zigzag SVG line behind the nodes. Pure decoration. */
function ConnectorPath({ count }: { count: number }) {
  if (count < 2) return null;
  // We don't know exact pixel positions (depends on layout), so we draw
  // a percent-based path with dashed strokes to imply the route.
  return (
    <svg
      aria-hidden
      className="absolute inset-x-0 top-0 bottom-0 mx-auto pointer-events-none"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="none"
      viewBox={`0 0 100 ${count * 100}`}
    >
      {/* Generate a smooth curve that wiggles between x=30 and x=70 */}
      <path
        d={(() => {
          const points: string[] = [`M 50 0`];
          for (let i = 1; i < count; i++) {
            const x = i % 2 === 0 ? 50 : i % 2 === 1 ? 50 : 50;
            const prevX = (i - 1) % 2 === 0 ? 50 : 50;
            // Wave control points pull horizontally per row.
            const wiggle = i % 2 === 1 ? 70 : 30;
            const prevWiggle = (i - 1) % 2 === 1 ? 70 : 30;
            const y = i * 100;
            const prevY = (i - 1) * 100;
            const cy1 = prevY + 50;
            const cy2 = y - 50;
            // Bezier control between the two wiggle-x's
            points.push(
              `C ${prevWiggle} ${cy1}, ${wiggle} ${cy2}, ${x} ${y}`
            );
          }
          return points.join(" ");
        })()}
        fill="none"
        stroke="#2e2e2e"
        strokeWidth="2"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LessonNode({
  courseId,
  instructorId,
  lesson,
  index,
  anchor,
  state,
}: {
  courseId: string;
  instructorId: string | null;
  lesson: LessonLite;
  index: number;
  anchor: "left" | "right" | "center";
  state: "completed" | "current" | "upcoming" | "locked";
}) {
  const minutes = Math.max(2, Math.round(lesson.stepCount * 0.9));
  const anchorClass =
    anchor === "left"
      ? "mr-auto pl-4"
      : anchor === "right"
        ? "ml-auto pr-4"
        : "mx-auto";

  // Node visual treatment based on state.
  const nodeClass = cn(
    "relative w-16 h-16 rounded-full flex items-center justify-center transition-transform",
    state === "completed" && "bg-canvas-white text-void-black shadow-md",
    state === "current" &&
      "bg-canvas-white text-void-black shadow-md ring-4 ring-canvas-white/30",
    state === "upcoming" &&
      "bg-iron border-2 border-[var(--border-strong)] text-canvas-white",
    state === "locked" &&
      "bg-iron border border-[var(--border-subtle)] text-ash-gray opacity-60"
  );

  const labelAlign =
    anchor === "left"
      ? "text-left items-start"
      : anchor === "right"
        ? "text-right items-end"
        : "text-center items-center";

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{
        type: "spring",
        stiffness: 240,
        damping: 22,
        delay: index * 0.05,
      }}
      className={cn(
        "flex flex-col gap-2 max-w-[14rem]",
        anchorClass,
        labelAlign
      )}
    >
      <div className="relative">
        <motion.div
          whileHover={state === "locked" ? undefined : { scale: 1.06 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className={nodeClass}
        >
          {state === "completed" ? (
            <Check className="w-7 h-7" strokeWidth={3} />
          ) : state === "locked" ? (
            <Lock className="w-5 h-5" />
          ) : (
            <TutorAvatar
              instructorId={instructorId}
              state={state === "current" ? "talking" : "idle"}
              size={48}
            />
          )}
          {/* Pulsing ring for the current lesson — visual "you are here". */}
          {state === "current" && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-canvas-white"
              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </motion.div>
        {/* Step number badge offset on the node */}
        <span
          className={cn(
            "absolute -top-1 -right-1 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center border-2",
            state === "completed" || state === "current"
              ? "bg-void-black text-canvas-white border-canvas-white"
              : "bg-coal text-ash-gray border-[var(--border-strong)]"
          )}
        >
          {index + 1}
        </span>
      </div>

      <div className={cn("flex flex-col gap-0.5", labelAlign)}>
        <p
          className={cn(
            "text-sm font-semibold leading-tight",
            state === "locked" || state === "completed"
              ? "text-ash-gray"
              : "text-canvas-white"
          )}
        >
          {lesson.title}
        </p>
        <p
          className={cn(
            "text-[11px] leading-snug",
            state === "locked" ? "text-ash-gray/50" : "text-ash-gray"
          )}
        >
          {state === "locked"
            ? `Finish lesson ${index} first`
            : state === "current"
              ? "Continue here · " + `~${minutes} min`
              : state === "completed"
                ? "Replay · " + `~${minutes} min`
                : `~${minutes} min`}
        </p>
      </div>
    </motion.div>
  );

  if (state === "locked") {
    return (
      <li
        className="w-full cursor-not-allowed select-none"
        aria-disabled
        title="Finish the previous lesson to unlock this."
      >
        {content}
      </li>
    );
  }
  return (
    <li className="w-full">
      <Link
        href={`/learn/${courseId}/${lesson.id}`}
        className="block hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-canvas-white rounded-[14px]"
      >
        {content}
      </Link>
    </li>
  );
}
