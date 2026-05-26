"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser, getIdToken } from "firebase/auth";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { INSTRUCTORS } from "@/lib/instructors";
import { cn } from "@/lib/utils";

interface Course {
  id: string;
  title: string;
  subject: string;
  description: string;
  overview?: string;
  gradeBand?: { min: number; max: number };
  instructorId: string | null;
  status: "draft" | "published";
  freeTier: boolean;
  lessonCount: number;
}

interface LessonRow {
  id: string;
  title: string;
  objective: string;
  order: number;
  steps?: unknown[];
  updatedAt: string;
}

export default function AdminCourseDetailClient({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getIdToken(user);
      const headers = { Authorization: `Bearer ${token}` };
      const [courseRes, lessonsRes] = await Promise.all([
        fetch(`/api/admin/courses/${courseId}`, { headers }),
        fetch(`/api/admin/courses/${courseId}/lessons`, { headers }),
      ]);
      const courseData = await courseRes.json();
      const lessonsData = await lessonsRes.json();
      if (!courseRes.ok || !courseData.course)
        throw new Error(courseData.error || "Course not found");
      setCourse(courseData.course);
      setLessons(lessonsData.lessons || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveCourse = async (patch: Partial<Course>) => {
    if (!user || !course) return;
    // Optimistic
    setCourse({ ...course, ...patch });
    setSaving(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async () => {
    if (!user) return;
    if (!confirm("Delete this course and all its lessons? This can't be undone.")) return;
    try {
      const token = await getIdToken(user);
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/admin/courses");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const createLesson = async () => {
    if (!user) return;
    setCreatingLesson(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch(`/api/admin/courses/${courseId}/lessons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "New lesson",
          objective: "",
          steps: [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error || "Couldn't create lesson");
      router.push(`/admin/courses/${courseId}/lessons/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create lesson");
      setCreatingLesson(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ash-gray">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!course) {
    return (
      <div className="p-8">
        <p className="text-sm text-canvas-white">{error || "Course not found"}</p>
        <Link href="/admin/courses" className="text-sm text-canvas-white underline mt-2 inline-block">
          ← Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl">
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-1 text-xs text-ash-gray hover:text-canvas-white mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> All courses
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            value={course.title}
            onChange={(e) => saveCourse({ title: e.target.value })}
            placeholder="Course title"
            className="w-full text-2xl font-bold text-canvas-white bg-transparent outline-none border-b border-transparent focus:border-[var(--border-subtle)]"
          />
          <p className="text-xs text-ash-gray mt-1">
            {saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Edit any field to autosave"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() =>
              saveCourse({
                status: course.status === "published" ? "draft" : "published",
              })
            }
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium",
              course.status === "published"
                ? "bg-canvas-white text-void-black"
                : "bg-iron text-ash-gray"
            )}
          >
            {course.status === "published" ? "Published" : "Draft"} ·
            <span className="ml-1 underline">toggle</span>
          </button>
          <button
            onClick={deleteCourse}
            className="p-1.5 text-ash-gray hover:text-canvas-white hover:bg-coal rounded-md"
            aria-label="Delete course"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 text-sm text-canvas-white bg-coal border border-[var(--border-subtle)] rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Course metadata */}
      <section className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-5 mb-6">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-ash-gray mb-3">
          Course details
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <LabeledField label="Subject">
            <input
              value={course.subject}
              onChange={(e) => saveCourse({ subject: e.target.value })}
              placeholder="Math"
              className="field"
            />
          </LabeledField>

          <LabeledField label="Instructor">
            <select
              value={course.instructorId ?? ""}
              onChange={(e) => saveCourse({ instructorId: e.target.value || null })}
              className="field"
            >
              <option value="">— No instructor —</option>
              {INSTRUCTORS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.subject})
                </option>
              ))}
            </select>
          </LabeledField>

          <LabeledField label="Recommended grade range" full>
            <GradeRangePicker
              value={course.gradeBand}
              onChange={(gradeBand) => saveCourse({ gradeBand })}
            />
          </LabeledField>

          <LabeledField label="Short description" full>
            <textarea
              value={course.description}
              onChange={(e) => saveCourse({ description: e.target.value })}
              placeholder="One-line description shown in the catalog."
              rows={2}
              className="field resize-none"
            />
          </LabeledField>

          <LabeledField label="Free tier?">
            <label className="flex items-center gap-2 text-sm text-ash-gray">
              <input
                type="checkbox"
                checked={course.freeTier}
                onChange={(e) => saveCourse({ freeTier: e.target.checked })}
              />
              Available to free users
            </label>
          </LabeledField>
        </div>
      </section>

      {/* Lessons */}
      <section className="bg-coal rounded-[14px] border border-[var(--border-subtle)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-ash-gray">
            Lessons ({lessons.length})
          </h2>
          <button
            onClick={createLesson}
            disabled={creatingLesson}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-canvas-white hover:opacity-90 disabled:opacity-70 text-void-black rounded-full text-xs font-medium"
          >
            {creatingLesson ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            New lesson
          </button>
        </header>

        {lessons.length === 0 ? (
          <p className="text-sm text-ash-gray text-center py-8 px-4">
            No lessons yet. Click <strong>New lesson</strong> to author the first one
            — you&apos;ll be able to draft steps manually or have AI generate them.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {lessons.map((l, i) => (
              <li key={l.id}>
                <Link
                  href={`/admin/courses/${courseId}/lessons/${l.id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-coal transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-iron text-ash-gray text-xs font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-canvas-white truncate">
                      {l.title}
                    </p>
                    <p className="text-xs text-ash-gray truncate">
                      {l.objective || "No objective yet"} ·{" "}
                      {(l.steps?.length ?? 0)} step{(l.steps?.length ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx>{`
        :global(.field) {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(226, 232, 240);
          border-radius: 0.5rem;
          background: white;
          font-size: 0.875rem;
          color: rgb(30, 41, 59);
          outline: none;
          transition: border-color 0.15s;
        }
        :global(.field:focus) {
          border-color: rgb(129, 140, 248);
        }
      `}</style>
    </div>
  );
}

function LabeledField({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Two-dropdown grade range picker. Editing min auto-bumps max if it'd go
 * inverted, and vice versa, so the band is always valid. A live preview
 * below shows the catalog label the students will see.
 */
function GradeRangePicker({
  value,
  onChange,
}: {
  value: { min: number; max: number } | undefined;
  onChange: (v: { min: number; max: number }) => void;
}) {
  const min = value?.min ?? 4;
  const max = value?.max ?? 12;

  const setMin = (next: number) => {
    onChange({ min: next, max: Math.max(next, max) });
  };
  const setMax = (next: number) => {
    onChange({ min: Math.min(next, min), max: next });
  };

  const label =
    min === max
      ? `Recommended for Grade ${min}`
      : `Recommended for Grades ${min}–${max}`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={min}
          onChange={(e) => setMin(Number(e.target.value))}
          className="field flex-1"
          aria-label="Minimum grade"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
        <span className="text-ash-gray text-sm">to</span>
        <select
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
          className="field flex-1"
          aria-label="Maximum grade"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1.5 text-[11px] text-ash-gray">
        Preview: <span className="font-medium text-canvas-white/90">{label}</span>
      </p>
    </div>
  );
}

