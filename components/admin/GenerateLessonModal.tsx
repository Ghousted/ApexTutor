"use client";

import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { onAuthStateChanged, getIdToken, User as FirebaseUser } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import type { Step } from "@/lib/courses";

const GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Modal for AI-assisted lesson skeleton generation. Admin enters topic +
 * grade band; we hit /api/admin/generate-lesson and the parent decides
 * whether to REPLACE the existing steps or APPEND.
 */
export default function GenerateLessonModal({
  defaultTopic,
  defaultCourseSubject,
  defaultGradeMin = 5,
  defaultGradeMax = 7,
  onClose,
  onGenerated,
}: {
  defaultTopic?: string;
  defaultCourseSubject?: string;
  defaultGradeMin?: number;
  defaultGradeMax?: number;
  onClose: () => void;
  onGenerated: (steps: Step[], mode: "replace" | "append") => void;
}) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [topic, setTopic] = useState(defaultTopic ?? "");
  const [gradeMin, setGradeMin] = useState(defaultGradeMin);
  const [gradeMax, setGradeMax] = useState(defaultGradeMax);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Step[] | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const submit = async () => {
    if (!user) return;
    if (!topic.trim()) {
      setError("Topic is required.");
      return;
    }
    setGenerating(true);
    setError("");
    setPreview(null);
    try {
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/generate-lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic,
          lessonTitle: defaultTopic,
          courseSubject: defaultCourseSubject,
          gradeMin,
          gradeMax,
        }),
      });
      const data = (await res.json()) as {
        steps?: Step[];
        error?: string;
      };
      if (!res.ok || !data.steps) {
        throw new Error(data.error || "Generation failed");
      }
      if (data.steps.length === 0) {
        throw new Error("AI returned no usable steps. Try a different topic.");
      }
      setPreview(data.steps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-coal rounded-[14px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-iron text-canvas-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-canvas-white">Generate lesson with AI</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-ash-gray hover:bg-iron"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!preview ? (
          <>
            <p className="text-sm text-ash-gray mb-4 leading-relaxed">
              We&apos;ll draft a 5-7 step linear lesson mixing intro, explainer,
              interactive widgets, and a checkpoint. You can edit anything afterward.
            </p>

            <div className="flex flex-col gap-4">
              <Field label="Topic">
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Adding fractions with unlike denominators"
                  className="field-input"
                />
              </Field>

              <Field label="Grade range">
                <div className="flex items-center gap-2">
                  <select
                    value={gradeMin}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setGradeMin(n);
                      if (n > gradeMax) setGradeMax(n);
                    }}
                    className="field-input flex-1"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-ash-gray">to</span>
                  <select
                    value={gradeMax}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setGradeMax(n);
                      if (n < gradeMin) setGradeMin(n);
                    }}
                    className="field-input flex-1"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              {error && (
                <p className="text-sm text-canvas-white bg-coal border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={submit}
                disabled={generating || !topic.trim()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-canvas-white hover:opacity-90 disabled:opacity-60 text-void-black rounded-lg font-medium text-sm transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Drafting your lesson…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ash-gray mb-3">
              Draft of <strong>{preview.length}</strong> step
              {preview.length === 1 ? "" : "s"}. Add them to your lesson?
            </p>
            <ol className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)] mb-4 max-h-64 overflow-y-auto">
              {preview.map((s, i) => (
                <li key={i} className="px-3 py-2 text-xs">
                  <span className="font-semibold text-canvas-white/90 mr-2">{i + 1}.</span>
                  <span className="font-mono text-canvas-white">{s.type}</span>
                  {"script" in s && s.script && (
                    <span className="text-ash-gray ml-2">
                      — {s.script.slice(0, 100)}
                      {s.script.length > 100 ? "…" : ""}
                    </span>
                  )}
                </li>
              ))}
            </ol>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onGenerated(preview, "append")}
                className="px-4 py-2.5 bg-coal border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-canvas-white rounded-lg font-medium text-sm transition-colors"
              >
                Append after existing
              </button>
              <button
                onClick={() => onGenerated(preview, "replace")}
                className="px-4 py-2.5 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-medium text-sm transition-colors"
              >
                Replace all steps
              </button>
            </div>
            <button
              onClick={() => setPreview(null)}
              className="w-full mt-2 text-xs text-ash-gray hover:text-canvas-white"
            >
              ← Try a different topic
            </button>
          </>
        )}

        <style jsx>{`
          :global(.field-input) {
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
          :global(.field-input:focus) {
            border-color: rgb(129, 140, 248);
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
