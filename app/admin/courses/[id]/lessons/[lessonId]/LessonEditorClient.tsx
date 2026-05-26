"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser, getIdToken } from "firebase/auth";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import LoadingDots from "@/components/LoadingDots";
import { auth } from "@/lib/firebase";
import type { Step } from "@/lib/courses";
import { cn } from "@/lib/utils";
import {
  IntroEditor,
  ExplainerEditor,
  QuizEditor,
  FractionBarEditor,
  MatchPairsEditor,
  SortSequenceEditor,
  CheckpointEditor,
  TrueFalseEditor,
  FillBlankEditor,
  NumberLineEditor,
  HighlightEditor,
  ReadingPassageEditor,
  TapLabelEditor,
} from "@/components/admin/StepEditors";
import GenerateLessonModal from "@/components/admin/GenerateLessonModal";

interface Lesson {
  id: string;
  title: string;
  objective: string;
  steps: Step[];
}

// Catalog of step types shown in the "Add step" picker. Keeping a single
// source of truth here means new step types only need 3 changes: (1) the
// Step union in lib/courses.ts, (2) a new editor in StepEditors.tsx, (3) an
// entry here.
const STEP_TYPES: Array<{
  type: Step["type"];
  label: string;
  description: string;
  emoji: string;
  defaults: Step;
}> = [
  {
    type: "intro",
    label: "Intro",
    description: "Tutor introduces what's coming next.",
    emoji: "👋",
    defaults: { type: "intro", script: "" },
  },
  {
    type: "explainer",
    label: "Explainer",
    description: "Concept explanation, optional bullets.",
    emoji: "💡",
    defaults: { type: "explainer", script: "", bullets: [] },
  },
  {
    type: "quiz",
    label: "Quiz",
    description: "Multiple-choice question.",
    emoji: "❓",
    defaults: {
      type: "quiz",
      script: "",
      question: "",
      options: [
        { key: "A", label: "" },
        { key: "B", label: "" },
      ],
      correctKey: "A",
    },
  },
  {
    type: "fraction-bar",
    label: "Fraction bar",
    description: "Interactive cell-fill widget.",
    emoji: "▰",
    defaults: { type: "fraction-bar", script: "", target: "1/2" },
  },
  {
    type: "match-pairs",
    label: "Match pairs",
    description: "Drag-and-drop matching game.",
    emoji: "🔀",
    defaults: {
      type: "match-pairs",
      script: "",
      pairs: [
        { left: "", right: "" },
        { left: "", right: "" },
      ],
    },
  },
  {
    type: "sort-sequence",
    label: "Put in order",
    description: "Drag rows into the correct sequence.",
    emoji: "🔢",
    defaults: {
      type: "sort-sequence",
      script: "",
      prompt: "",
      items: ["", "", ""],
    },
  },
  {
    type: "true-false",
    label: "True / False",
    description: "Binary judgement on a single statement.",
    emoji: "✓✗",
    defaults: {
      type: "true-false",
      script: "",
      statement: "",
      answer: true,
    },
  },
  {
    type: "fill-blank",
    label: "Fill in the blank",
    description: "Student types a missing word or number.",
    emoji: "✎",
    defaults: {
      type: "fill-blank",
      script: "",
      sentence: "",
      answer: "",
    },
  },
  {
    type: "number-line",
    label: "Number line",
    description: "Drag a marker to estimate a value.",
    emoji: "📏",
    defaults: {
      type: "number-line",
      script: "",
      min: 0,
      max: 100,
      target: 50,
    },
  },
  {
    type: "highlight",
    label: "Highlight words",
    description: "Tap target words inside a short passage.",
    emoji: "🖍️",
    defaults: {
      type: "highlight",
      script: "",
      passage: "",
      targets: [],
    },
  },
  {
    type: "reading-passage",
    label: "Reading passage",
    description: "Read a passage, then answer a question.",
    emoji: "📖",
    defaults: {
      type: "reading-passage",
      script: "",
      passage: "",
      question: "",
      options: [
        { key: "A", label: "" },
        { key: "B", label: "" },
      ],
      correctKey: "A",
    },
  },
  {
    type: "tap-label",
    label: "Tap to label",
    description: "Tap the right spot on an image for each label.",
    emoji: "🎯",
    defaults: {
      type: "tap-label",
      script: "",
      imageUrl: "",
      hotspots: [],
    },
  },
  {
    type: "checkpoint",
    label: "Checkpoint",
    description: "Summary or transition beat.",
    emoji: "🚩",
    defaults: { type: "checkpoint", script: "" },
  },
];

// Map step.type → editor component.
const EDITOR_REGISTRY: Record<
  Step["type"],
  React.ComponentType<{
    step: Step & { type: Step["type"] };
    onChange: (next: Step) => void;
  }>
> = {
  intro: IntroEditor as never,
  explainer: ExplainerEditor as never,
  quiz: QuizEditor as never,
  "fraction-bar": FractionBarEditor as never,
  "match-pairs": MatchPairsEditor as never,
  "sort-sequence": SortSequenceEditor as never,
  checkpoint: CheckpointEditor as never,
  "true-false": TrueFalseEditor as never,
  "fill-blank": FillBlankEditor as never,
  "number-line": NumberLineEditor as never,
  highlight: HighlightEditor as never,
  "reading-passage": ReadingPassageEditor as never,
  "tap-label": TapLabelEditor as never,
};

function stepMeta(type: Step["type"]) {
  return STEP_TYPES.find((s) => s.type === type) ?? STEP_TYPES[0];
}

const AUTOSAVE_DEBOUNCE_MS = 700;

export default function LessonEditorClient({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch(
        `/api/admin/courses/${courseId}/lessons/${lessonId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = (await res.json()) as { lesson?: Lesson; error?: string };
      if (!res.ok || !data.lesson) {
        throw new Error(data.error || "Lesson not found");
      }
      setLesson(data.lesson);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lesson");
    } finally {
      setLoading(false);
    }
  }, [user, courseId, lessonId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Autosave debounce — patch the lesson 700ms after the last change.
  // Pending patches are coalesced into a single PATCH body.
  const pendingPatchRef = useRef<Partial<Lesson> | null>(null);
  const debouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (!user || !pendingPatchRef.current) return;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = null;
    setSaving(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch(
        `/api/admin/courses/${courseId}/lessons/${lessonId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [user, courseId, lessonId]);

  const queuePatch = useCallback(
    (patch: Partial<Lesson>) => {
      pendingPatchRef.current = {
        ...(pendingPatchRef.current ?? {}),
        ...patch,
      };
      if (debouncerRef.current) clearTimeout(debouncerRef.current);
      debouncerRef.current = setTimeout(() => {
        flush();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Flush any pending changes on unmount so the user doesn't lose edits
  // when navigating away mid-debounce.
  useEffect(() => {
    return () => {
      if (debouncerRef.current) clearTimeout(debouncerRef.current);
      flush();
    };
  }, [flush]);

  // ─── Lesson-level edits ───────────────────────────────────────────────
  const editLesson = (patch: Partial<Lesson>) => {
    if (!lesson) return;
    const next = { ...lesson, ...patch };
    setLesson(next);
    queuePatch(patch);
  };

  // ─── Step-level edits ─────────────────────────────────────────────────
  const editStep = (index: number, next: Step) => {
    if (!lesson) return;
    const steps = lesson.steps.map((s, i) => (i === index ? next : s));
    editLesson({ steps });
  };
  const addStep = (type: Step["type"]) => {
    if (!lesson) return;
    const meta = stepMeta(type);
    editLesson({ steps: [...lesson.steps, { ...meta.defaults } as Step] });
    setPickerOpen(false);
  };
  const removeStep = (index: number) => {
    if (!lesson) return;
    editLesson({ steps: lesson.steps.filter((_, i) => i !== index) });
  };

  // ─── Per-step AI regenerate ───────────────────────────────────────────
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const regenerateStep = async (index: number) => {
    if (!user || !lesson) return;
    const current = lesson.steps[index];
    if (!current) return;
    setRegeneratingIdx(index);
    setError("");
    try {
      const token = await getIdToken(user);
      const res = await fetch("/api/admin/generate-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stepType: current.type,
          lessonTitle: lesson.title,
          lessonObjective: lesson.objective,
          gradeMin: 5,
          gradeMax: 7,
          surroundingSteps: lesson.steps.map((s) => ({
            type: s.type,
            script: "script" in s ? s.script : undefined,
          })),
          previous: current,
        }),
      });
      const data = (await res.json()) as { step?: Step; error?: string };
      if (!res.ok || !data.step) throw new Error(data.error || "Regenerate failed");
      editStep(index, data.step);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegeneratingIdx(null);
    }
  };

  // ─── Drag-to-reorder ──────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    if (!lesson) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = lesson.steps.findIndex((_, i) => `step-${i}` === active.id);
    const newIdx = lesson.steps.findIndex((_, i) => `step-${i}` === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    editLesson({ steps: arrayMove(lesson.steps, oldIdx, newIdx) });
  };

  const deleteLesson = async () => {
    if (!user) return;
    if (!confirm("Delete this lesson? This can't be undone.")) return;
    try {
      const token = await getIdToken(user);
      const res = await fetch(
        `/api/admin/courses/${courseId}/lessons/${lessonId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Delete failed");
      router.push(`/admin/courses/${courseId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingDots size="md" label="Loading lesson…" />
      </div>
    );
  }
  if (!lesson) {
    return (
      <div className="p-8">
        <p className="text-sm text-canvas-white">{error || "Lesson not found"}</p>
        <Link
          href={`/admin/courses/${courseId}`}
          className="text-sm text-canvas-white underline mt-2 inline-block"
        >
          ← Back to course
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-3xl">
      <Link
        href={`/admin/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-xs text-ash-gray hover:text-canvas-white mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Back to course
      </Link>

      {/* Lesson meta */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            value={lesson.title}
            onChange={(e) => editLesson({ title: e.target.value })}
            placeholder="Lesson title"
            className="w-full text-2xl font-bold text-canvas-white bg-transparent outline-none border-b border-transparent focus:border-[var(--border-subtle)]"
          />
          <textarea
            value={lesson.objective}
            onChange={(e) => editLesson({ objective: e.target.value })}
            placeholder="What will the student be able to do by the end of this lesson?"
            rows={2}
            className="w-full mt-1 text-sm text-ash-gray bg-transparent outline-none resize-none border-b border-transparent focus:border-[var(--border-subtle)]"
          />
          <p className="text-[11px] text-ash-gray mt-1">
            {saving
              ? "Saving…"
              : savedAt
                ? `Saved ${savedAt.toLocaleTimeString()}`
                : "Edits autosave"}
          </p>
        </div>
        <button
          onClick={deleteLesson}
          className="shrink-0 p-1.5 text-ash-gray hover:text-canvas-white hover:bg-coal rounded-md"
          aria-label="Delete lesson"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </header>

      {error && (
        <p className="mb-4 text-sm text-canvas-white bg-coal border border-[var(--border-subtle)] rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Steps */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-ash-gray">
          Lesson flow ({lesson.steps.length} step{lesson.steps.length === 1 ? "" : "s"})
        </h2>
        <button
          onClick={() => setGenOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-canvas-white bg-iron hover:bg-canvas-white rounded-full transition-colors"
        >
          <Sparkles className="w-3 h-3" /> Generate with AI
        </button>
      </div>

      {genOpen && (
        <GenerateLessonModal
          defaultTopic={lesson.title}
          onClose={() => setGenOpen(false)}
          onGenerated={(steps, mode) => {
            if (!lesson) return;
            const next = mode === "replace" ? steps : [...lesson.steps, ...steps];
            editLesson({ steps: next });
            setGenOpen(false);
          }}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={lesson.steps.map((_, i) => `step-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-3 mb-3">
            {lesson.steps.map((step, i) => (
              <SortableStepCard
                key={`step-${i}`}
                id={`step-${i}`}
                index={i}
                step={step}
                onChange={(next) => editStep(i, next)}
                onRemove={() => removeStep(i)}
                onRegenerate={() => regenerateStep(i)}
                regenerating={regeneratingIdx === i}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Add step picker */}
      <div className="relative">
        {pickerOpen ? (
          <div className="bg-coal border border-[var(--border-subtle)] rounded-[14px] p-3 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ash-gray">Pick a step type</p>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-xs text-ash-gray hover:text-canvas-white"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STEP_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => addStep(t.type)}
                  className="text-left p-2.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-iron transition-colors"
                >
                  <div className="text-lg mb-0.5">{t.emoji}</div>
                  <p className="text-sm font-semibold text-canvas-white">{t.label}</p>
                  <p className="text-[11px] text-ash-gray leading-snug">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full px-4 py-3 border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-iron/50 rounded-[14px] text-sm font-medium text-ash-gray hover:text-canvas-white transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add a step
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sortable step card ─────────────────────────────────────────────────

function SortableStepCard({
  id,
  index,
  step,
  onChange,
  onRemove,
  onRegenerate,
  regenerating,
}: {
  id: string;
  index: number;
  step: Step;
  onChange: (next: Step) => void;
  onRemove: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const [expanded, setExpanded] = useState(true);
  const meta = stepMeta(step.type);
  const Editor = EDITOR_REGISTRY[step.type];

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "bg-coal border border-[var(--border-subtle)] rounded-[14px] overflow-hidden",
        isDragging && "shadow-lg ring-2 ring-canvas-white"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-coal border-b border-[var(--border-subtle)]">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-ash-gray hover:text-canvas-white cursor-grab"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="w-6 h-6 rounded-full bg-coal border border-[var(--border-subtle)] text-xs font-semibold text-ash-gray flex items-center justify-center">
          {index + 1}
        </span>
        <span className="text-base">{meta.emoji}</span>
        <span className="text-sm font-semibold text-canvas-white flex-1">{meta.label}</span>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="p-1 text-ash-gray hover:text-canvas-white disabled:opacity-50"
          aria-label="Regenerate with AI"
          title="Regenerate this step with AI"
        >
          {regenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1 text-ash-gray hover:text-canvas-white"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", !expanded && "-rotate-90")} />
        </button>
        <button
          onClick={onRemove}
          className="p-1 text-ash-gray hover:text-canvas-white"
          aria-label="Delete step"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="p-4">
          <Editor step={step} onChange={onChange} />
        </div>
      )}
    </li>
  );
}
