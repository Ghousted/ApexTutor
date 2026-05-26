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

export function FillBlankEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "fill-blank" }>>) {
  const altsDraft = (step.alternatives ?? []).join(", ");
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="What the tutor says before the sentence appears…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Sentence (use ___ where the blank goes)
        </label>
        <textarea
          value={step.sentence}
          onChange={(e) => onChange({ ...step, sentence: e.target.value })}
          placeholder="The center of an atom is called the ___."
          rows={2}
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)] resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
            Answer
          </label>
          <input
            value={step.answer}
            onChange={(e) => onChange({ ...step, answer: e.target.value })}
            placeholder="nucleus"
            className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
            Alternatives (comma-separated)
          </label>
          <input
            value={altsDraft}
            onChange={(e) =>
              onChange({
                ...step,
                alternatives: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="atomic nucleus, the nucleus"
            className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
          />
        </div>
      </div>
    </div>
  );
}

export function NumberLineEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "number-line" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Tutor intro for the placement task…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Prompt (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Drag the marker to room temperature."
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label="Min"
          value={step.min}
          onChange={(min) => onChange({ ...step, min })}
        />
        <NumberField
          label="Max"
          value={step.max}
          onChange={(max) => onChange({ ...step, max })}
        />
        <NumberField
          label="Target"
          value={step.target}
          onChange={(target) => onChange({ ...step, target })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
            Unit (optional)
          </label>
          <input
            value={step.unit ?? ""}
            onChange={(e) => onChange({ ...step, unit: e.target.value })}
            placeholder="°C, %, min"
            className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <NumberField
          label="Tolerance (optional)"
          value={step.tolerance ?? 0}
          onChange={(tolerance) =>
            onChange({ ...step, tolerance: tolerance > 0 ? tolerance : undefined })
          }
        />
      </div>
    </div>
  );
}

export function HighlightEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "highlight" }>>) {
  const targetsDraft = step.targets.join(", ");
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Tutor intro…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Prompt (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Tap every verb."
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Passage
        </label>
        <textarea
          value={step.passage}
          onChange={(e) => onChange({ ...step, passage: e.target.value })}
          placeholder="The fox runs quickly across the field."
          rows={4}
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)] resize-none"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Target words (comma-separated)
        </label>
        <input
          value={targetsDraft}
          onChange={(e) =>
            onChange({
              ...step,
              targets: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="runs, quickly"
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm font-mono outline-none focus:border-[var(--border-strong)]"
        />
      </div>
    </div>
  );
}

export function ReadingPassageEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "reading-passage" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Tutor intro for the reading…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Passage
        </label>
        <textarea
          value={step.passage}
          onChange={(e) => onChange({ ...step, passage: e.target.value })}
          placeholder="A few paragraphs the student reads on screen."
          rows={6}
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)] resize-none"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Question
        </label>
        <input
          value={step.question}
          onChange={(e) => onChange({ ...step, question: e.target.value })}
          placeholder="What is the main idea of the passage?"
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Options
        </label>
        <div className="flex flex-col gap-2">
          {step.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={opt.key}
                onChange={(e) => {
                  const options = step.options.map((o, j) =>
                    j === i ? { ...o, key: e.target.value } : o
                  );
                  onChange({ ...step, options });
                }}
                className="w-12 bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm text-center outline-none focus:border-[var(--border-strong)] font-mono"
                placeholder="A"
              />
              <input
                value={opt.label}
                onChange={(e) => {
                  const options = step.options.map((o, j) =>
                    j === i ? { ...o, label: e.target.value } : o
                  );
                  onChange({ ...step, options });
                }}
                className="flex-1 bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm outline-none focus:border-[var(--border-strong)]"
                placeholder="Option text"
              />
              <button
                onClick={() =>
                  onChange({
                    ...step,
                    options: step.options.filter((_, j) => j !== i),
                  })
                }
                className="text-xs text-ash-gray hover:text-canvas-white px-2"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            onChange({
              ...step,
              options: [
                ...step.options,
                {
                  key: String.fromCharCode(65 + step.options.length),
                  label: "",
                },
              ],
            })
          }
          className="text-xs px-3 py-1 mt-2 bg-iron border border-[var(--border-subtle)] rounded-md text-canvas-white hover:bg-[#2e2e2e]"
        >
          + Add option
        </button>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Correct key
        </label>
        <input
          value={step.correctKey}
          onChange={(e) => onChange({ ...step, correctKey: e.target.value })}
          className="w-16 bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white text-sm font-mono outline-none focus:border-[var(--border-strong)] text-center"
          placeholder="A"
        />
      </div>
    </div>
  );
}

export function TapLabelEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "tap-label" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Tutor intro for the diagram…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Prompt (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Find each part of the cell."
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Image URL
        </label>
        <input
          value={step.imageUrl}
          onChange={(e) => onChange({ ...step, imageUrl: e.target.value })}
          placeholder="https://…/diagram.png"
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm font-mono outline-none focus:border-[var(--border-strong)]"
        />
        {step.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              step.imageUrl.startsWith("/")
                ? step.imageUrl
                : `/api/img-proxy?url=${encodeURIComponent(step.imageUrl)}`
            }
            alt=""
            className="mt-2 max-h-40 object-contain rounded border border-[var(--border-subtle)] bg-iron"
          />
        )}
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Hotspots — coordinates in 0..1 (fraction of image)
        </label>
        <div className="flex flex-col gap-2">
          {step.hotspots.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr,80px,80px,32px] gap-2 items-center">
              <input
                value={h.label}
                onChange={(e) => {
                  const hotspots = step.hotspots.map((p, j) =>
                    j === i ? { ...p, label: e.target.value } : p
                  );
                  onChange({ ...step, hotspots });
                }}
                placeholder="Label"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm outline-none focus:border-[var(--border-strong)]"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={h.x}
                onChange={(e) => {
                  const hotspots = step.hotspots.map((p, j) =>
                    j === i ? { ...p, x: Number(e.target.value) } : p
                  );
                  onChange({ ...step, hotspots });
                }}
                placeholder="x"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm font-mono outline-none focus:border-[var(--border-strong)]"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={h.y}
                onChange={(e) => {
                  const hotspots = step.hotspots.map((p, j) =>
                    j === i ? { ...p, y: Number(e.target.value) } : p
                  );
                  onChange({ ...step, hotspots });
                }}
                placeholder="y"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm font-mono outline-none focus:border-[var(--border-strong)]"
              />
              <button
                onClick={() =>
                  onChange({
                    ...step,
                    hotspots: step.hotspots.filter((_, j) => j !== i),
                  })
                }
                className="text-xs text-ash-gray hover:text-canvas-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            onChange({
              ...step,
              hotspots: [...step.hotspots, { x: 0.5, y: 0.5, label: "" }],
            })
          }
          className="text-xs px-3 py-1 mt-2 bg-iron border border-[var(--border-subtle)] rounded-md text-canvas-white hover:bg-[#2e2e2e]"
        >
          + Add hotspot
        </button>
        <p className="text-[10px] text-ash-gray mt-2 leading-relaxed">
          Tip: x and y are fractions from 0 (left/top) to 1 (right/bottom).
          For a center spot use 0.5 / 0.5. Tap tolerance is ±10%.
        </p>
      </div>
    </div>
  );
}

export function PieDividerEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "pie-divider" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Tutor intro for the slicing task…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Prompt (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Show 3/8 of the pizza."
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Slices (denominator)"
          value={step.slices}
          onChange={(v) =>
            onChange({ ...step, slices: Math.max(2, Math.min(16, v || 2)) })
          }
        />
        <NumberField
          label="Select target (numerator)"
          value={step.selectTarget}
          onChange={(v) =>
            onChange({
              ...step,
              selectTarget: Math.max(0, Math.min(step.slices, v || 0)),
            })
          }
        />
      </div>
      <p className="text-[10px] text-ash-gray leading-relaxed">
        Tip: 8 slices / select 3 = &quot;Show 3/8&quot;. 4 slices / select 4 =
        &quot;Eat the whole pizza&quot;.
      </p>
    </div>
  );
}

export function BalanceScaleEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "balance-scale" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Tutor intro…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Prompt (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Balance the equation: left side = ?"
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Left pan (fixed)
        </label>
        <div className="flex flex-col gap-2">
          {step.leftFixed.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr,80px,32px] gap-2 items-center">
              <input
                value={x.label}
                onChange={(e) => {
                  const leftFixed = step.leftFixed.map((p, j) =>
                    j === i ? { ...p, label: e.target.value } : p
                  );
                  onChange({ ...step, leftFixed });
                }}
                placeholder="Label (e.g. 'x' or '5kg')"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm outline-none focus:border-[var(--border-strong)]"
              />
              <input
                type="number"
                value={x.weight}
                onChange={(e) => {
                  const leftFixed = step.leftFixed.map((p, j) =>
                    j === i ? { ...p, weight: Number(e.target.value) } : p
                  );
                  onChange({ ...step, leftFixed });
                }}
                placeholder="weight"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm font-mono outline-none focus:border-[var(--border-strong)]"
              />
              <button
                onClick={() =>
                  onChange({
                    ...step,
                    leftFixed: step.leftFixed.filter((_, j) => j !== i),
                  })
                }
                className="text-xs text-ash-gray hover:text-canvas-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            onChange({
              ...step,
              leftFixed: [...step.leftFixed, { label: "", weight: 1 }],
            })
          }
          className="text-xs px-3 py-1 mt-2 bg-iron border border-[var(--border-subtle)] rounded-md text-canvas-white hover:bg-[#2e2e2e]"
        >
          + Add left item
        </button>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Tile pool (right pan)
        </label>
        <div className="flex flex-col gap-2">
          {step.options.map((o, i) => (
            <div key={i} className="grid grid-cols-[80px,1fr,80px,32px] gap-2 items-center">
              <input
                value={o.id}
                onChange={(e) => {
                  const options = step.options.map((p, j) =>
                    j === i ? { ...p, id: e.target.value } : p
                  );
                  onChange({ ...step, options });
                }}
                placeholder="id"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm font-mono outline-none focus:border-[var(--border-strong)]"
              />
              <input
                value={o.label}
                onChange={(e) => {
                  const options = step.options.map((p, j) =>
                    j === i ? { ...p, label: e.target.value } : p
                  );
                  onChange({ ...step, options });
                }}
                placeholder="Label"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm outline-none focus:border-[var(--border-strong)]"
              />
              <input
                type="number"
                value={o.weight}
                onChange={(e) => {
                  const options = step.options.map((p, j) =>
                    j === i ? { ...p, weight: Number(e.target.value) } : p
                  );
                  onChange({ ...step, options });
                }}
                placeholder="weight"
                className="bg-iron border border-[var(--border-subtle)] rounded-md px-2 py-1.5 text-canvas-white text-sm font-mono outline-none focus:border-[var(--border-strong)]"
              />
              <button
                onClick={() =>
                  onChange({
                    ...step,
                    options: step.options.filter((_, j) => j !== i),
                  })
                }
                className="text-xs text-ash-gray hover:text-canvas-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            onChange({
              ...step,
              options: [
                ...step.options,
                { id: `t${step.options.length + 1}`, label: "", weight: 1 },
              ],
            })
          }
          className="text-xs px-3 py-1 mt-2 bg-iron border border-[var(--border-subtle)] rounded-md text-canvas-white hover:bg-[#2e2e2e]"
        >
          + Add tile
        </button>
        <p className="text-[10px] text-ash-gray mt-2 leading-relaxed">
          Tile id must be unique. Same tile can be dropped multiple times,
          so a pool of [1, 5] can solve any whole-number target.
        </p>
      </div>
    </div>
  );
}

export function LetterTilesEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "letter-tiles" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="Tutor intro for the spelling task…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Prompt (optional)
        </label>
        <input
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Spell the part of a cell that holds genetic material."
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
            Target word
          </label>
          <input
            value={step.word}
            onChange={(e) =>
              onChange({ ...step, word: e.target.value.toUpperCase() })
            }
            placeholder="NUCLEUS"
            className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm font-mono outline-none focus:border-[var(--border-strong)]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
            Decoy letters (comma)
          </label>
          <input
            value={(step.decoys ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...step,
                decoys: e.target.value
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter((s) => /^[A-Z]$/.test(s)),
              })
            }
            placeholder="K, M, R"
            className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm font-mono outline-none focus:border-[var(--border-strong)]"
          />
        </div>
      </div>
      <p className="text-[10px] text-ash-gray leading-relaxed">
        Target letters auto-populate the pool. Decoys make it harder by
        adding wrong letters the student must ignore.
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white text-sm font-mono outline-none focus:border-[var(--border-strong)]"
      />
    </div>
  );
}

export function TrueFalseEditor({
  step,
  onChange,
}: EditorProps<Extract<Step, { type: "true-false" }>>) {
  return (
    <div className="flex flex-col gap-3">
      <ScriptField
        value={step.script}
        onChange={(script) => onChange({ ...step, script })}
        placeholder="What the tutor says to introduce the statement…"
      />
      <div>
        <label className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1 block">
          Statement
        </label>
        <textarea
          value={step.statement}
          onChange={(e) => onChange({ ...step, statement: e.target.value })}
          placeholder="A factual statement the student will judge true or false."
          rows={2}
          className="w-full bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm outline-none focus:border-[var(--border-strong)] resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray">
          Correct answer
        </span>
        <div className="inline-flex bg-iron rounded-md p-0.5 border border-[var(--border-subtle)]">
          <button
            onClick={() => onChange({ ...step, answer: true })}
            className={
              "px-3 py-1 rounded text-xs font-medium " +
              (step.answer
                ? "bg-canvas-white text-void-black"
                : "text-ash-gray hover:text-canvas-white")
            }
          >
            True
          </button>
          <button
            onClick={() => onChange({ ...step, answer: false })}
            className={
              "px-3 py-1 rounded text-xs font-medium " +
              (!step.answer
                ? "bg-canvas-white text-void-black"
                : "text-ash-gray hover:text-canvas-white")
            }
          >
            False
          </button>
        </div>
      </div>
    </div>
  );
}
