"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Filter, Flame, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getEnrollment, type EnrollmentDoc } from "@/lib/enrollments";
import { getInstructor } from "@/lib/instructors";
import { cn } from "@/lib/utils";

export interface CatalogCourse {
  id: string;
  title: string;
  subject: string;
  description?: string;
  gradeBand?: { min: number; max: number };
  instructorId?: string | null;
  lessonCount: number;
  freeTier?: boolean;
}

const ALL = "All";

const GRADE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "Grades 4–6", min: 4, max: 6 },
  { label: "Grades 7–9", min: 7, max: 9 },
  { label: "Grades 10–12", min: 10, max: 12 },
];

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function CoursesCatalogClient({
  courses,
}: {
  courses: CatalogCourse[];
}) {
  const [subject, setSubject] = useState<string>(ALL);
  const [bucketLabel, setBucketLabel] = useState<string>(ALL);
  // Full enrollment per course — drives both the progress rings and the
  // "Continue learning" hero. Empty until auth resolves.
  const [enrollments, setEnrollments] = useState<Record<string, EnrollmentDoc>>(
    {}
  );
  const [studentName, setStudentName] = useState<string | null>(null);
  // True after we've at least attempted to load enrollments + profile, so
  // we don't render the "first-time" CTA while still actually loading.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEnrollments({});
        setStudentName(null);
        setHydrated(true);
        return;
      }
      const [profileSnap, ...results] = await Promise.all([
        getDoc(doc(db, "users", u.uid)),
        ...courses.map(async (c) => {
          try {
            const e = await getEnrollment(u.uid, c.id);
            return [c.id, e] as const;
          } catch {
            return [c.id, null] as const;
          }
        }),
      ]);
      setStudentName(profileSnap.data()?.profile?.studentName ?? null);
      const next: Record<string, EnrollmentDoc> = {};
      for (const r of results) {
        const [id, doc] = r as [string, EnrollmentDoc | null];
        if (doc) next[id] = doc;
      }
      setEnrollments(next);
      setHydrated(true);
    });
    return () => unsub();
  }, [courses]);

  // The course the student should "Continue" — most recently visited
  // enrollment that still has lessons remaining and an active lesson id.
  const continueCard = useMemo(() => {
    const candidates = courses
      .map((c) => ({ course: c, enrollment: enrollments[c.id] }))
      .filter(
        (x): x is { course: CatalogCourse; enrollment: EnrollmentDoc } =>
          !!x.enrollment &&
          !!x.enrollment.currentLessonId &&
          (x.enrollment.completedLessonIds?.length ?? 0) < x.course.lessonCount
      )
      .sort((a, b) => {
        const ta = a.enrollment.lastVisitedAt?.getTime() ?? 0;
        const tb = b.enrollment.lastVisitedAt?.getTime() ?? 0;
        return tb - ta;
      });
    return candidates[0] ?? null;
  }, [courses, enrollments]);

  // Highest active streak across all enrollments — the chip the student
  // gets to brag about regardless of which course they're in today.
  const topStreak = useMemo(() => {
    let max = 0;
    for (const e of Object.values(enrollments)) {
      if (e.streak > max) max = e.streak;
    }
    return max;
  }, [enrollments]);

  // First-time CTA target — the easiest free-tier course on the catalog.
  const firstCourseSuggestion = useMemo(() => {
    return courses.find((c) => c.freeTier) ?? courses[0] ?? null;
  }, [courses]);

  const hasAnyEnrollment = Object.keys(enrollments).length > 0;

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) if (c.subject) set.add(c.subject);
    return [ALL, ...Array.from(set).sort()];
  }, [courses]);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (subject !== ALL && c.subject !== subject) return false;
      if (bucketLabel !== ALL) {
        const bucket = GRADE_BUCKETS.find((b) => b.label === bucketLabel);
        if (!bucket || !c.gradeBand) return false;
        if (c.gradeBand.max < bucket.min || c.gradeBand.min > bucket.max) {
          return false;
        }
      }
      return true;
    });
  }, [courses, subject, bucketLabel]);

  return (
    <>
      {/* Greeting + streak */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between gap-3 mb-8"
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-1">
            {timeOfDayGreeting()}
          </p>
          <h2
            className="font-bold text-canvas-white truncate"
            style={{ fontSize: "clamp(24px, 3.5vw, 36px)", letterSpacing: "-0.54px", lineHeight: 1.2 }}
          >
            {studentName ? studentName : "Welcome back"}
          </h2>
        </div>
        {topStreak > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-iron border border-[var(--border-strong)] text-canvas-white shrink-0">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-semibold">{topStreak}-day streak</span>
          </div>
        )}
      </motion.div>

      {/* Continue learning hero — only when a course is in progress */}
      {continueCard && (
        <ContinueHero
          course={continueCard.course}
          enrollment={continueCard.enrollment}
        />
      )}

      {/* First-time prompt — only after hydration AND no enrollments yet */}
      {hydrated && !hasAnyEnrollment && firstCourseSuggestion && (
        <FirstTimeHero course={firstCourseSuggestion} />
      )}

      {/* Filter chips */}
      {courses.length > 0 && (
        <div className="mt-12 mb-8 flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray">
            {continueCard ? "Other courses" : "All courses"}
          </p>
          <FilterRow
            icon={<Filter className="w-3.5 h-3.5" />}
            label="Subject"
            options={subjects}
            value={subject}
            onChange={setSubject}
          />
          <FilterRow
            label="Grade band"
            options={[ALL, ...GRADE_BUCKETS.map((b) => b.label)]}
            value={bucketLabel}
            onChange={setBucketLabel}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-coal border border-dashed border-[var(--border-strong)] rounded-[14px] p-12 text-center max-w-md mx-auto">
          <BookOpen className="w-8 h-8 mx-auto text-ash-gray mb-3" />
          <p className="text-sm text-canvas-white mb-1">
            {courses.length === 0 ? "No courses yet" : "No matches"}
          </p>
          <p className="text-xs text-ash-gray">
            {courses.length === 0
              ? "Check back soon — we're putting them together."
              : "Try a different subject or grade band."}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              completedLessons={enrollments[c.id]?.completedLessonIds?.length ?? 0}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** Big "Continue learning" hero shown when the student has an in-progress
 *  course. Highest-impact change on the catalog — surfaces the one action
 *  the returning student is here to take. */
function ContinueHero({
  course,
  enrollment,
}: {
  course: CatalogCourse;
  enrollment: EnrollmentDoc;
}) {
  const inst = getInstructor(course.instructorId ?? undefined);
  const completed = enrollment.completedLessonIds?.length ?? 0;
  const remaining = Math.max(0, course.lessonCount - completed);
  const pct =
    course.lessonCount > 0
      ? Math.round((completed / course.lessonCount) * 100)
      : 0;
  const minutesEstimate = remaining * 6; // ~6 min/lesson is a reasonable rule-of-thumb
  // Deep-link straight into the saved lesson so it really feels like "resume".
  const target = enrollment.currentLessonId
    ? `/learn/${course.id}/${enrollment.currentLessonId}`
    : `/courses/${course.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
    >
      <Link
        href={target}
        className="group relative block rounded-[14px] p-6 md:p-7 bg-coal border border-[var(--border-strong)] hover:border-canvas-white transition-colors overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center text-canvas-white text-lg font-bold bg-iron border border-[var(--border-strong)] shrink-0">
              {inst?.avatarInitial ?? course.subject?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-0.5">
                Continue learning
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-canvas-white truncate">
                {course.title}
              </h3>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 px-4 py-3 bg-canvas-white text-void-black rounded-lg font-semibold text-sm shrink-0 shadow-md group-hover:opacity-90 transition-opacity">
            Resume
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-1.5 bg-iron rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-canvas-white"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            />
          </div>
          <p className="text-xs font-medium text-canvas-white shrink-0">
            {completed}/{course.lessonCount}
          </p>
        </div>

        <p className="text-xs text-ash-gray">
          {remaining === 0
            ? "All caught up — you can replay any lesson."
            : `About ${minutesEstimate} min left · ${remaining} lesson${remaining === 1 ? "" : "s"} to go`}
        </p>

        {/* Mobile-only resume button */}
        <span className="sm:hidden mt-4 inline-flex items-center gap-2 px-4 py-3 bg-canvas-white text-void-black rounded-lg font-semibold text-sm w-full justify-center">
          Resume
          <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
    </motion.div>
  );
}

/** Shown only on a brand-new account with zero enrollments. Replaces the
 *  cold "go figure out what to click" experience with one clear action. */
function FirstTimeHero({ course }: { course: CatalogCourse }) {
  const inst = getInstructor(course.instructorId ?? undefined);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[14px] p-6 md:p-7 bg-coal border border-[var(--border-strong)]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-iron text-canvas-white text-[10px] font-semibold uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          Start here
        </span>
      </div>
      <h3 className="text-xl md:text-2xl font-bold text-canvas-white mb-2">
        Welcome — try your first lesson
      </h3>
      <p className="text-sm text-ash-gray mb-5 max-w-prose">
        Your tutor leads each lesson with short interactive steps. Tap{" "}
        <span className="text-canvas-white font-medium">{course.title}</span>{" "}
        to begin{inst ? ` with ${inst.shortName}` : ""}. You can come back to
        anything in your library later.
      </p>
      <Link
        href={`/courses/${course.id}`}
        className="inline-flex items-center gap-2 px-5 py-3 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold text-sm transition-opacity shadow-md"
      >
        Begin {course.title}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </motion.div>
  );
}

/** Circular progress ring around the course icon. Pct = 0 hides the arc so
 *  unstarted courses don't read as "0% complete". */
function ProgressRing({
  pct,
  size,
  children,
}: {
  pct: number;
  size: number;
  children: React.ReactNode;
}) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pct > 0 && (
        <svg
          width={size}
          height={size}
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2e2e2e" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#ffffff"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function FilterRow({
  icon,
  label,
  options,
  value,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-ash-gray mr-1">
        {icon}
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors",
              active
                ? "bg-canvas-white text-void-black border-canvas-white"
                : "bg-coal text-ash-gray border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-canvas-white"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function CourseCard({
  course: c,
  completedLessons,
}: {
  course: CatalogCourse;
  completedLessons: number;
}) {
  const inst = getInstructor(c.instructorId ?? undefined);
  const gradeLabel =
    c.gradeBand &&
    (c.gradeBand.min === c.gradeBand.max
      ? `Grade ${c.gradeBand.min}`
      : `Grades ${c.gradeBand.min}–${c.gradeBand.max}`);
  const progressPct =
    c.lessonCount > 0
      ? Math.min(100, Math.round((completedLessons / c.lessonCount) * 100))
      : 0;
  const inProgress = completedLessons > 0 && progressPct < 100;
  const finished = progressPct === 100;

  return (
    <Link
      href={`/courses/${c.id}`}
      className="group relative text-left rounded-[14px] p-6 bg-coal border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors"
    >
      <div className="flex items-start gap-4 mb-4">
        <ProgressRing pct={progressPct} size={48}>
          <div className="w-9 h-9 rounded-md flex items-center justify-center text-canvas-white text-sm font-bold bg-iron border border-[var(--border-strong)]">
            {inst?.avatarInitial ?? c.subject?.[0]?.toUpperCase() ?? "?"}
          </div>
        </ProgressRing>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-semibold mb-1 text-ash-gray">
            {c.subject || "Course"}
          </p>
          <h2 className="text-lg font-semibold text-canvas-white leading-tight tracking-tight">
            {c.title}
          </h2>
        </div>
      </div>

      {c.description && (
        <p className="text-sm text-ash-gray mb-5 leading-relaxed line-clamp-2">
          {c.description}
        </p>
      )}

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {gradeLabel && (
          <span className="text-[11px] font-medium text-ash-gray bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-0.5">
            {gradeLabel}
          </span>
        )}
        <span className="text-[11px] font-medium text-ash-gray bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-0.5">
          {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
        </span>
        {finished && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-void-black bg-canvas-white rounded-md px-2 py-0.5">
            Completed
          </span>
        )}
        {inProgress && !finished && (
          <span className="text-[11px] font-semibold text-canvas-white bg-iron border border-[var(--border-strong)] rounded-md px-2 py-0.5">
            {progressPct}% done
          </span>
        )}
        {c.freeTier && !finished && !inProgress && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-void-black bg-canvas-white rounded-md px-2 py-0.5">
            Free
          </span>
        )}
      </div>

      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-canvas-white">
        {inProgress ? "Continue" : inst ? `Taught by ${inst.shortName}` : "Start course"}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}
