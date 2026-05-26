"use client";

// Per-step inline editors. Each component takes the current step value and
// an onChange callback. The parent (LessonEditorClient) holds the array,
// debounces autosave, and renders these in a sortable list.

import { Plus, X } from "lucide-react";
import type { Step } from "@/lib/courses";

interface EditorProps<T extends Step> {
  step: T;
  onChange: (next: T) => void;
}

// ─── Shared "Tutor script" field ────────────────────────────────────────

function ScriptField({
  value,
  onChange,
  placeholder = "What does the tutor say when this step appears?",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
        Tutor says
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full p-2.5 border border-[var(--border-subtle)] rounded-lg bg-coal text-sm text-canvas-white resize-none outline-none focus:border-[var(--border-strong)]"
      />
    </div>
  );
}

// ─── Intro ──────────────────────────────────────────────────────────────

export function IntroEditor({ step, onChange }: EditorProps<Extract<Step, { type: "intro" }>>) {
  return (
    <ScriptField
      value={step.script}
      onChange={(script) => onChange({ ...step, script })}
      placeholder="Welcome the student and frame what they're about to learn."
    />
  );
}

// ─── Explainer ──────────────────────────────────────────────────────────

export function ExplainerEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "explainer" }>>) {
  const bullets = step.bullets ?? [];
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Explain the concept clearly. Keep it under ~3 sentences."
      />
      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Visible bullets (optional)
        </label>
        <div className="flex flex-col gap-1.5">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={b}
                onChange={(e) => {
                  const next = [...bullets];
                  next[i] = e.target.value;
                  onChange({ ...step, bullets: next });
                }}
                placeholder={`Bullet ${i + 1}`}
                className="flex-1 px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
              />
              <button
                onClick={() => {
                  const next = bullets.filter((_, j) => j !== i);
                  onChange({ ...step, bullets: next });
                }}
                className="p-1.5 text-ash-gray hover:text-canvas-white hover:bg-coal rounded"
                aria-label="Remove bullet"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ ...step, bullets: [...bullets, ""] })}
            className="self-start inline-flex items-center gap-1 px-2.5 py-1 text-xs text-canvas-white hover:bg-iron rounded-md"
          >
            <Plus className="w-3 h-3" /> Add bullet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quiz ───────────────────────────────────────────────────────────────

export function QuizEditor({ step, onChange }: EditorProps<Extract<Step, { type: "quiz" }>>) {
  const options = step.options ?? [];

  const setOption = (i: number, label: string) => {
    const next = [...options];
    next[i] = { ...next[i], label };
    onChange({ ...step, options: next });
  };
  const addOption = () => {
    const nextKey = String.fromCharCode(65 + options.length); // A, B, C, ...
    onChange({
      ...step,
      options: [...options, { key: nextKey, label: "" }],
    });
  };
  const removeOption = (i: number) => {
    const removedKey = options[i]?.key;
    onChange({
      ...step,
      options: options.filter((_, j) => j !== i),
      correctKey: step.correctKey === removedKey ? "" : step.correctKey,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Introduce the question briefly."
      />
      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Question
        </label>
        <input
          value={step.question}
          onChange={(e) => onChange({ ...step, question: e.target.value })}
          placeholder="What is 1/2 + 1/3?"
          className="w-full px-2.5 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Options (click the radio to mark the correct answer)
        </label>
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <div key={opt.key + i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={step.correctKey === opt.key}
                onChange={() => onChange({ ...step, correctKey: opt.key })}
                className="w-4 h-4 accent-indigo-500 shrink-0"
              />
              <span className="w-5 text-xs font-semibold text-ash-gray shrink-0">
                {opt.key}
              </span>
              <input
                value={opt.label}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${opt.key}`}
                className="flex-1 px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
              />
              <button
                onClick={() => removeOption(i)}
                className="p-1.5 text-ash-gray hover:text-canvas-white hover:bg-coal rounded"
                aria-label="Remove option"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {options.length < 5 && (
            <button
              onClick={addOption}
              className="self-start inline-flex items-center gap-1 px-2.5 py-1 text-xs text-canvas-white hover:bg-iron rounded-md"
            >
              <Plus className="w-3 h-3" /> Add option
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fraction bar ───────────────────────────────────────────────────────

export function FractionBarEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "fraction-bar" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder='e.g. "Make 3/4 by clicking the cells."'
      />
      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Target fraction
        </label>
        <input
          value={step.target}
          onChange={(e) => onChange({ ...step, target: e.target.value })}
          placeholder="3/4"
          className="w-32 px-2.5 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)] font-mono"
        />
        <p className="text-[11px] text-ash-gray mt-1">
          The denominator becomes the bar&apos;s cell count. Student clicks to fill.
        </p>
      </div>
    </div>
  );
}

// ─── Match pairs ────────────────────────────────────────────────────────

export function MatchPairsEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "match-pairs" }>>) {
  const pairs = step.pairs ?? [];

  const setPair = (i: number, key: "left" | "right", val: string) => {
    const next = [...pairs];
    next[i] = { ...next[i], [key]: val };
    onChange({ ...step, pairs: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Introduce the matching activity."
      />
      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Prompt shown above pairs (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Match each equation to its solution."
          className="w-full px-2.5 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Pairs (drag from left, drop on right)
        </label>
        <div className="flex flex-col gap-1.5">
          {pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1.5 items-center">
              <input
                value={p.left}
                onChange={(e) => setPair(i, "left", e.target.value)}
                placeholder={`Left ${i + 1}`}
                className="px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
              />
              <span className="text-ash-gray text-xs">↔</span>
              <input
                value={p.right}
                onChange={(e) => setPair(i, "right", e.target.value)}
                placeholder={`Right ${i + 1}`}
                className="px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
              />
              <button
                onClick={() =>
                  onChange({ ...step, pairs: pairs.filter((_, j) => j !== i) })
                }
                className="p-1.5 text-ash-gray hover:text-canvas-white hover:bg-coal rounded"
                aria-label="Remove pair"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {pairs.length < 8 && (
            <button
              onClick={() =>
                onChange({ ...step, pairs: [...pairs, { left: "", right: "" }] })
              }
              className="self-start inline-flex items-center gap-1 px-2.5 py-1 text-xs text-canvas-white hover:bg-iron rounded-md"
            >
              <Plus className="w-3 h-3" /> Add pair
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sort / Sequence ────────────────────────────────────────────────────

export function SortSequenceEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "sort-sequence" }>>) {
  const items = step.items ?? [];
  const setItem = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange({ ...step, items: next });
  };
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder='e.g. "Put these steps in the correct order."'
      />
      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Prompt shown above the items (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Order from smallest to largest."
          className="w-full px-2.5 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-ash-gray uppercase tracking-wider mb-1">
          Items in the CORRECT order
        </label>
        <p className="text-[11px] text-ash-gray mb-2">
          The student sees them shuffled and drags rows until they match this
          order top-to-bottom.
        </p>
        <ol className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-iron text-xs font-bold text-ash-gray flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <input
                value={it}
                onChange={(e) => setItem(i, e.target.value)}
                placeholder={`Step ${i + 1}`}
                className="flex-1 px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-lg text-sm bg-coal outline-none focus:border-[var(--border-strong)]"
              />
              <button
                onClick={() => onChange({ ...step, items: items.filter((_, j) => j !== i) })}
                className="p-1.5 text-ash-gray hover:text-canvas-white hover:bg-coal rounded"
                aria-label="Remove item"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {items.length < 8 && (
            <button
              onClick={() => onChange({ ...step, items: [...items, ""] })}
              className="self-start inline-flex items-center gap-1 px-2.5 py-1 text-xs text-canvas-white hover:bg-iron rounded-md"
            >
              <Plus className="w-3 h-3" /> Add item
            </button>
          )}
        </ol>
      </div>
    </div>
  );
}

// ─── Checkpoint ─────────────────────────────────────────────────────────

export function CheckpointEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "checkpoint" }>>) {
  return (
    <ScriptField
      value={step.script ?? ""}
      onChange={(script) => onChange({ ...step, script })}
      placeholder="Optional summary or transition before the next lesson section."
    />
  );
}
