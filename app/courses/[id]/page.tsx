import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check } from "lucide-react";
import { getCourse, listLessons } from "@/lib/courses";
import { getInstructor } from "@/lib/instructors";
import Logo from "@/components/Logo";

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
    <main className="min-h-screen bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-3">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
        <Link
          href="/courses"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-ink"
        >
          <ArrowLeft className="w-3 h-3" /> All courses
        </Link>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-8 md:py-10">
        {/* Hero */}
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl font-bold shadow-md shrink-0"
            style={{ background: instructor?.accentColor || "#6366F1" }}
          >
            {instructor?.avatarInitial ?? course.subject?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs uppercase tracking-wider font-semibold mb-1"
              style={{ color: instructor?.accentColor || "#6366F1" }}
            >
              {course.subject || "Course"}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-ink mb-2 leading-tight">
              {course.title}
            </h1>
            {instructor && (
              <p className="text-sm text-slate-600">
                Taught by{" "}
                <span className="font-semibold text-ink">{instructor.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {gradeLabel && (
            <span className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1">
              Recommended for {gradeLabel}
            </span>
          )}
          <span className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
          </span>
          {course.freeTier && (
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 rounded-full px-3 py-1">
              Free
            </span>
          )}
        </div>

        {/* About */}
        {(course.description || course.overview) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
              About this course
            </h2>
            {course.description && (
              <p className="text-sm text-slate-700 leading-relaxed mb-2">
                {course.description}
              </p>
            )}
            {course.overview && (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {course.overview}
              </p>
            )}
          </div>
        )}

        {/* Lessons */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
          <header className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              What you&apos;ll learn ({lessons.length})
            </h2>
          </header>
          {lessons.length === 0 ? (
            <div className="p-8 text-center">
              <BookOpen className="w-6 h-6 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No lessons yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lessons.map((l, i) => (
                <li key={l.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">{l.title}</p>
                    {l.objective && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {l.objective}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      {l.steps.length} step{l.steps.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* CTA */}
        {firstLesson ? (
          <Link
            href={`/learn/${course.id}/${firstLesson.id}`}
            className="w-full block text-center px-5 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-semibold transition-all active:scale-95 shadow-lg shadow-indigo-200"
          >
            <span className="inline-flex items-center gap-2">
              Start course
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ) : (
          <p className="text-center text-sm text-slate-400">
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
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 text-sm">
        {icon}
      </div>
      <p className="text-sm font-semibold text-ink mb-0.5">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{text}</p>
    </div>
  );
}
