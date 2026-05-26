import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check } from "lucide-react";
import { getCourse, listLessons } from "@/lib/courses";
import { getInstructor } from "@/lib/instructors";
import Logo from "@/components/Logo";
import VoicePrefetch from "@/components/VoicePrefetch";
import CourseLessonList from "./CourseLessonList";

export const dynamic = "force-dynamic";

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

  return (
    <main className="min-h-screen bg-void-black">
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
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-[14px] flex items-center justify-center text-canvas-white text-2xl md:text-3xl font-bold bg-iron border border-[var(--border-strong)] shrink-0">
            {instructor?.avatarInitial ?? course.subject?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-semibold mb-1 text-ash-gray">
              {course.subject || "Course"}
            </p>
            <h1
              className="font-bold text-canvas-white mb-2 leading-tight"
              style={{ fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "-0.54px" }}
            >
              {course.title}
            </h1>
            {instructor && (
              <p className="text-sm text-ash-gray">
                Taught by{" "}
                <span className="font-semibold text-canvas-white">{instructor.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {gradeLabel && (
            <span className="text-xs font-medium text-ash-gray bg-coal border border-[var(--border-subtle)] rounded-md px-3 py-1">
              {gradeLabel}
            </span>
          )}
          <span className="text-xs font-medium text-ash-gray bg-coal border border-[var(--border-subtle)] rounded-md px-3 py-1">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
          </span>
          {course.freeTier && (
            <span className="text-xs font-semibold uppercase tracking-wider text-void-black bg-canvas-white rounded-md px-3 py-1">
              Free
            </span>
          )}
        </div>

        {/* About */}
        {(course.description || course.overview) && (
          <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-5 mb-6">
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
              About this course
            </h2>
            {course.description && (
              <p className="text-sm text-canvas-white/90 leading-relaxed mb-2">
                {course.description}
              </p>
            )}
            {course.overview && (
              <p className="text-sm text-ash-gray leading-relaxed whitespace-pre-wrap">
                {course.overview}
              </p>
            )}
          </div>
        )}

        {/* Lessons — client component reads enrollment to mark progress */}
        <div className="mb-6">
          <CourseLessonList
            courseId={course.id}
            lessons={lessons.map((l) => ({
              id: l.id,
              title: l.title,
              objective: l.objective,
              stepCount: l.steps.length,
            }))}
          />
        </div>

        {/* CTA */}
        {firstLesson ? (
          <Link
            href={`/learn/${course.id}/${firstLesson.id}`}
            className="w-full block text-center px-5 py-4 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold transition-opacity active:scale-95 shadow-md"
          >
            <span className="inline-flex items-center gap-2">
              Start course
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ) : (
          <p className="text-center text-sm text-ash-gray">
            This course doesn&apos;t have any lessons yet.
          </p>
        )}

        {/* What's inside */}
        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          <Feature icon="✨" title="Hands-on" text="Drag, click, sort — barely any reading." />
          <Feature icon={<Check className="w-4 h-4" />} title="Linear" text="One step at a time, tutor-led." />
          <Feature icon="🎯" title="Grade-matched" text={gradeLabel ? `Built for ${gradeLabel}.` : "Designed for the right level."} />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="bg-coal border border-[var(--border-subtle)] rounded-[14px] p-4">
      <div className="w-8 h-8 rounded-md bg-iron text-canvas-white flex items-center justify-center mb-2 text-sm">
        {icon}
      </div>
      <p className="text-sm font-semibold text-canvas-white mb-0.5">{title}</p>
      <p className="text-xs text-ash-gray leading-relaxed">{text}</p>
    </div>
  );
}
