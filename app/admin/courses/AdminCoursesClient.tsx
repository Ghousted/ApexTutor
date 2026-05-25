"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser, getIdToken } from "firebase/auth";
import { Plus, Library, Loader2, Pencil } from "lucide-react";
import { auth } from "@/lib/firebase";
import { INSTRUCTORS } from "@/lib/instructors";
import { cn } from "@/lib/utils";

interface CourseRow {
  id: string;
  title: string;
  subject: string;
  description: string;
  instructorId: string | null;
  status: "draft" | "published";
  freeTier: boolean;
  lessonCount: number;
  updatedAt: string;
}

export default function AdminCoursesClient() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/courses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { courses?: CourseRow[]; error?: string };
      if (res.ok && data.courses) setCourses(data.courses);
      else setError(data.error || "Failed to load courses");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createCourse = async () => {
    if (!user) return;
    setCreating(true);
    setError("");
    try {
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Untitled course",
          subject: "Math",
          description: "",
          status: "draft",
          freeTier: false,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        throw new Error(data.error || "Couldn't create course");
      }
      router.push(`/admin/courses/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create course");
      setCreating(false);
    }
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Courses</h1>
          <p className="text-sm text-slate-500 mt-1">
            Each course is a linear, interactive lesson sequence taught by one assigned instructor.
          </p>
        </div>
        <button
          onClick={createCourse}
          disabled={creating}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink hover:bg-slate-800 disabled:opacity-70 text-white rounded-full text-sm font-medium transition-colors"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          New course
        </button>
      </header>

      {error && (
        <p className="mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <Library className="w-8 h-8 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-1">No courses yet</p>
          <p className="text-xs text-slate-400">
            Click <strong>New course</strong> to author your first one.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {courses.map((c) => {
            const inst = INSTRUCTORS.find((i) => i.id === c.instructorId);
            return (
              <li
                key={c.id}
                className="group bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow"
              >
                <Link href={`/admin/courses/${c.id}`} className="flex items-center gap-4">
                  {/* Status + subject sigil */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: inst?.accentColor || "#94a3b8" }}
                  >
                    {inst?.avatarInitial ?? c.subject?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h2 className="font-semibold text-ink truncate">
                        {c.title || "Untitled"}
                      </h2>
                      <StatusBadge status={c.status} />
                      {c.freeTier && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Free
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {c.subject || "No subject"}
                      {inst && <> · Taught by {inst.shortName}</>}
                      {" · "}
                      {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Pencil className="w-4 h-4 text-slate-300 group-hover:text-slate-600 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
        status === "published"
          ? "text-indigo-700 bg-indigo-100"
          : "text-slate-500 bg-slate-100"
      )}
    >
      {status}
    </span>
  );
}
