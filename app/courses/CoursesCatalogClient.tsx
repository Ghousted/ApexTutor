"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Filter } from "lucide-react";
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

// Grade buckets students recognise. A course matches a bucket if its gradeBand
// overlaps the bucket range at all.
const GRADE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "Grades 4–6", min: 4, max: 6 },
  { label: "Grades 7–9", min: 7, max: 9 },
  { label: "Grades 10–12", min: 10, max: 12 },
];

export default function CoursesCatalogClient({
  courses,
}: {
  courses: CatalogCourse[];
}) {
  const [subject, setSubject] = useState<string>(ALL);
  const [bucketLabel, setBucketLabel] = useState<string>(ALL);

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
        // Overlap: course's range intersects bucket's range.
        if (c.gradeBand.max < bucket.min || c.gradeBand.min > bucket.max) {
          return false;
        }
      }
      return true;
    });
  }, [courses, subject, bucketLabel]);

  return (
    <>
      {/* Filter chips */}
      {courses.length > 0 && (
        <div className="mb-8 flex flex-col gap-3">
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
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto">
          <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-1">
            {courses.length === 0 ? "No courses yet" : "No matches"}
          </p>
          <p className="text-xs text-slate-400">
            {courses.length === 0
              ? "Check back soon — we're putting them together."
              : "Try a different subject or grade band."}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </>
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
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-slate-500 mr-1">
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
              "text-xs font-medium rounded-full px-3 py-1 border transition-colors",
              active
                ? "bg-ink text-white border-ink"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function CourseCard({ course: c }: { course: CatalogCourse }) {
  const inst = getInstructor(c.instructorId ?? undefined);
  const gradeLabel =
    c.gradeBand &&
    (c.gradeBand.min === c.gradeBand.max
      ? `Grade ${c.gradeBand.min}`
      : `Grades ${c.gradeBand.min}–${c.gradeBand.max}`);

  return (
    <Link
      href={`/courses/${c.id}`}
      className="group relative text-left rounded-3xl p-6 bg-white border border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0"
          style={{ background: inst?.accentColor || "#6366F1" }}
        >
          {inst?.avatarInitial ?? c.subject?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-xs uppercase tracking-wider font-semibold mb-1"
            style={{ color: inst?.accentColor || "#6366F1" }}
          >
            {c.subject || "Course"}
          </p>
          <h2 className="text-lg font-bold text-ink leading-tight">{c.title}</h2>
        </div>
      </div>

      {c.description && (
        <p className="text-sm text-slate-600 mb-4 leading-relaxed line-clamp-2">
          {c.description}
        </p>
      )}

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {gradeLabel && (
          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
            Recommended for {gradeLabel}
          </span>
        )}
        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
          {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
        </span>
        {c.freeTier && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
            Free
          </span>
        )}
      </div>

      <span
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: inst?.accentColor || "#6366F1" }}
      >
        {inst ? `Taught by ${inst.shortName}` : "Start course"}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}
