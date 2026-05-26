import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Boxes,
  Shuffle,
  ListOrdered,
  Lock,
  Sparkles,
  ToggleLeft,
  PenLine,
  Ruler,
  Highlighter,
  BookOpenText,
  Target,
  Pizza,
  Scale,
  Keyboard,
} from "lucide-react";
import { getCourse, listLessons } from "@/lib/courses";
import { getInstructor } from "@/lib/instructors";
import Logo from "@/components/Logo";
import VoicePrefetch from "@/components/VoicePrefetch";
import CourseLessonPath from "./CourseLessonPath";
import TutorIntroCard from "./TutorIntroCard";
import CourseStartCTA from "./CourseStartCTA";
import CourseProgress from "./CourseProgress";

export const dynamic = "force-dynamic";

const MINUTES_PER_LESSON = 6;

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course || course.status !== "published") {
    notFound();
  }
  const lessons = await listLessons(id);
  const instructor = getInstructor(course.instructorId);
  const firstLesson = lessons[0];

  const gradeLabel =
    course.gradeBand &&
    (course.gradeBand.min === course.gradeBand.max
      ? `Grade ${course.gradeBand.min}`
      : `Grades ${course.gradeBand.min}–${course.gradeBand.max}`);

  // Widget-type breakdown — "what's inside this course" replaces the old
  // generic feature trio.
  const widgetCounts: Record<string, number> = {};
  for (const l of lessons) {
    for (const s of l.steps) {
      widgetCounts[s.type] = (widgetCounts[s.type] ?? 0) + 1;
    }
  }
  const totalMinutes = lessons.length * MINUTES_PER_LESSON;

  return (
    <main className="min-h-screen bg-void-black inside-surface">
      <VoicePrefetch />
      <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)]">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
        <Link
          href="/courses"
          className="inline-flex items-center gap-1 text-xs text-ash-gray hover:text-canvas-white"
        >
          <ArrowLeft className="w-3 h-3" /> All courses
        </Link>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        {/* Hero */}
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-wider font-semibold mb-2 text-ash-gray">
            {course.subject || "Course"}
          </p>
          <h1
            className="font-bold text-canvas-white mb-3 leading-tight"
            style={{ fontSize: "clamp(28px, 5vw, 44px)", letterSpacing: "-0.72px" }}
          >
            {course.title}
          </h1>
          {course.description && (
            <p className="text-base text-ash-gray leading-relaxed max-w-prose">
              {course.description}
            </p>
          )}
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {gradeLabel && (
            <span className="text-xs font-medium text-ash-gray bg-coal border border-[var(--border-subtle)] rounded-md px-3 py-1">
              {gradeLabel}
            </span>
          )}
          <span className="text-xs font-medium text-ash-gray bg-coal border border-[var(--border-subtle)] rounded-md px-3 py-1">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"} · ~{totalMinutes} min
          </span>
          {course.freeTier ? (
            <span className="text-xs font-semibold uppercase tracking-wider text-void-black bg-canvas-white rounded-md px-3 py-1">
              Free
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-canvas-white bg-iron border border-[var(--border-strong)] rounded-md px-3 py-1">
              <Lock className="w-3 h-3" />
              Pro
            </span>
          )}
        </div>

        {/* Progress + re-engagement — promotes lesson completion + last-visit
            into a top-of-page beat. Renders nothing for never-started or
            anonymous viewers. */}
        <CourseProgress courseId={course.id} totalLessons={lessons.length} />

        {/* Meet your tutor — voice preview, bigger avatar */}
        <TutorIntroCard instructorId={instructor?.id ?? null} />

        {/* Outcomes (preferred) — falls back to overview prose */}
        {course.outcomes && course.outcomes.length > 0 ? (
          <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-5 mb-6">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-3">
              By the end you&apos;ll be able to
            </h2>
            <ul className="flex flex-col gap-2.5">
              {course.outcomes.map((o, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-canvas-white/90 leading-relaxed">
                  <Check className="w-4 h-4 text-canvas-white shrink-0 mt-0.5" strokeWidth={3} />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        ) : course.overview ? (
          <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-5 mb-6">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
              About this course
            </h2>
            <p className="text-sm text-ash-gray leading-relaxed whitespace-pre-wrap">
              {course.overview}
            </p>
          </div>
        ) : null}

        {/* Lessons — path visualization with progress state per node */}
        <div className="mb-6">
          <CourseLessonPath
            courseId={course.id}
            instructorId={course.instructorId ?? null}
            lessons={lessons.map((l) => ({
              id: l.id,
              title: l.title,
              objective: l.objective,
              stepCount: l.steps.length,
            }))}
          />
        </div>

        {/* CTA — client island that flips to "Subscribe to unlock" for
            paid courses when the student isn't subscribed. */}
        <CourseStartCTA
          courseId={course.id}
          firstLessonId={firstLesson?.id ?? null}
          freeTier={course.freeTier}
        />

        {/* What's inside this course — widget-type breakdown */}
        {Object.keys(widgetCounts).length > 0 && (
          <div className="mt-10">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-3">
              What&apos;s inside
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { type: "quiz", label: "Quick checks", icon: CircleHelp },
                { type: "fraction-bar", label: "Fraction bars", icon: Boxes },
                { type: "match-pairs", label: "Match pairs", icon: Shuffle },
                { type: "sort-sequence", label: "Put in order", icon: ListOrdered },
                { type: "true-false", label: "True / False", icon: ToggleLeft },
                { type: "fill-blank", label: "Fill the blank", icon: PenLine },
                { type: "number-line", label: "Number line", icon: Ruler },
                { type: "highlight", label: "Highlight words", icon: Highlighter },
                { type: "reading-passage", label: "Reading", icon: BookOpenText },
                { type: "tap-label", label: "Tap to label", icon: Target },
                { type: "pie-divider", label: "Pizza slice", icon: Pizza },
                { type: "balance-scale", label: "Balance scale", icon: Scale },
                { type: "letter-tiles", label: "Letter tiles", icon: Keyboard },
                { type: "explainer", label: "Explainers", icon: Sparkles },
                { type: "checkpoint", label: "Checkpoints", icon: Check },
              ]
                .filter((w) => (widgetCounts[w.type] ?? 0) > 0)
                .map((w) => {
                  const Icon = w.icon;
                  return (
                    <div
                      key={w.type}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-coal border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors"
                    >
                      <Icon className="w-4 h-4 text-canvas-white shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-canvas-white truncate">
                          {w.label}
                        </p>
                        <p className="text-[11px] text-ash-gray">
                          {widgetCounts[w.type]}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
