// Single-step AI generator. Used by the admin "regenerate this step" button.
//
// Mirrors lessonGenerator.ts but produces exactly one step of a requested
// type, given the surrounding lesson context. Reuses the same coerceStep
// validation by delegating to a tiny wrapper.

import { groqClient } from "./groq";
import type { Step } from "./courses";

const MODEL = "llama-3.1-8b-instant";

const SYSTEM = `You are a senior curriculum designer. Rewrite ONE step of a lesson.

LANGUAGE: English only. Use universally relatable examples (sports, food, money, weather, games) so the step works for any English-speaking student. Avoid culture-specific references.

You will be told the step's type and the surrounding lesson context (title, objective, subject, grade band, and a summary of neighbouring steps). Produce one fresh step of that type — different wording / different example than before so the student gets a useful re-roll.

Output strictly this JSON shape — a single object, no array, no prose, no markdown fence:
{ "step": { "type": "...", ... } }

The "step" object's shape depends on its type. Use exactly these shapes:
- intro:        { "type": "intro", "script": "..." }
- explainer:    { "type": "explainer", "script": "...", "bullets": ["..", ".."] }
- quiz:         { "type": "quiz", "script": "...", "question": "...",
                  "options": [{ "key": "A", "label": "..." }, { "key": "B", "label": "..." }, { "key": "C", "label": "..." }],
                  "correctKey": "A" }
- fraction-bar: { "type": "fraction-bar", "script": "...", "target": "3/4" }
- match-pairs:  { "type": "match-pairs", "script": "...", "prompt": "...",
                  "pairs": [{ "left": "...", "right": "..." }, { "left": "...", "right": "..." }, { "left": "...", "right": "..." }] }
- sort-sequence:{ "type": "sort-sequence", "script": "...", "prompt": "...",
                  "items": ["first", "second", "third"] }
- checkpoint:   { "type": "checkpoint", "script": "..." }
- true-false:   { "type": "true-false", "script": "...", "statement": "...", "answer": true }

Rules:
- Scripts are 1-2 short sentences in plain English. Direct and warm.
- Quiz: 3-4 options with one correct (set correctKey to that option's key).
- Fraction-bar target: simple fraction like "3/4", "2/5", "5/8".
- Match-pairs: 3-4 pairs.
- Sort-sequence items: 3-5 entries in CORRECT order (the player shuffles them).
- Use {{studentName}} in scripts when natural.
- DO NOT include LaTeX, code, or markdown.`;

export interface GenerateStepInput {
  stepType: Step["type"];
  lessonTitle: string;
  lessonObjective: string;
  courseSubject?: string;
  gradeMin: number;
  gradeMax: number;
  /** Brief summary of the existing lesson flow so the model has context. */
  surroundingSteps?: Array<{ type: string; script?: string }>;
  /** The current step's content (so the model can deliberately deviate). */
  previous?: Step;
}

export interface GenerateStepResult {
  step: Step;
  modelMs: number;
}

export async function generateStep(
  input: GenerateStepInput
): Promise<GenerateStepResult> {
  const surrounding = (input.surroundingSteps ?? [])
    .map((s, i) => `  ${i + 1}. [${s.type}] ${s.script?.slice(0, 80) ?? ""}`)
    .join("\n");

  const userMessage = `Step type to produce: ${input.stepType}
Lesson title: ${input.lessonTitle || "(untitled)"}
Lesson objective: ${input.lessonObjective || "(none stated)"}
Subject: ${input.courseSubject || "General"}
Grade band: Grade ${input.gradeMin}${
    input.gradeMin === input.gradeMax ? "" : `–${input.gradeMax}`
  }

Existing lesson flow (for context — don't repeat their wording):
${surrounding || "  (no other steps yet)"}

${
  input.previous
    ? `Current step content (rewrite it with a fresh angle):\n${JSON.stringify(input.previous, null, 2)}`
    : ""
}

Produce the replacement step now.`;

  const t0 = Date.now();
  const completion = await groqClient.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMessage },
    ],
    stream: false,
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 800,
  });
  const modelMs = Date.now() - t0;

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: { step?: unknown } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  const step = coerceStep(parsed.step);
  if (!step) throw new Error("AI returned a malformed step");
  if (step.type !== input.stepType) {
    // Model drifted to the wrong type. Don't silently accept.
    throw new Error(`AI returned a ${step.type} step, expected ${input.stepType}`);
  }
  return { step, modelMs };
}

// Local copy of the same coercion used in lessonGenerator — keeping it here
// avoids exporting it from there just for this one call site.
function coerceStep(value: unknown): Step | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const type = String(obj.type ?? "");

  switch (type) {
    case "intro":
      return { type, script: String(obj.script ?? "") };
    case "explainer": {
      const bullets = Array.isArray(obj.bullets)
        ? obj.bullets.map(String).filter(Boolean)
        : undefined;
      return { type, script: String(obj.script ?? ""), bullets };
    }
    case "quiz": {
      const options = Array.isArray(obj.options)
        ? obj.options
            .map((o) => {
              if (!o || typeof o !== "object") return null;
              const opt = o as Record<string, unknown>;
              const key = String(opt.key ?? "").trim();
              const label = String(opt.label ?? "").trim();
              if (!key || !label) return null;
              return { key, label };
            })
            .filter((o): o is { key: string; label: string } => o !== null)
        : [];
      const correctKey = String(obj.correctKey ?? "").trim();
      if (options.length < 2 || !correctKey) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        question: String(obj.question ?? ""),
        options,
        correctKey,
      };
    }
    case "fraction-bar": {
      const target = String(obj.target ?? "");
      if (!/^\d+\s*\/\s*\d+$/.test(target)) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        target: target.replace(/\s+/g, ""),
      };
    }
    case "match-pairs": {
      const pairs = Array.isArray(obj.pairs)
        ? obj.pairs
            .map((p) => {
              if (!p || typeof p !== "object") return null;
              const pr = p as Record<string, unknown>;
              const left = String(pr.left ?? "").trim();
              const right = String(pr.right ?? "").trim();
              if (!left || !right) return null;
              return { left, right };
            })
            .filter((p): p is { left: string; right: string } => p !== null)
        : [];
      if (pairs.length < 2) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        pairs,
      };
    }
    case "sort-sequence": {
      const items = Array.isArray(obj.items)
        ? obj.items.map(String).map((s) => s.trim()).filter(Boolean)
        : [];
      if (items.length < 2) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        items,
      };
    }
    case "checkpoint":
      return { type, script: String(obj.script ?? "") };
    case "true-false": {
      const statement = String(obj.statement ?? "").trim();
      if (!statement) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        statement,
        answer: Boolean(obj.answer),
      };
    }
    case "fill-blank": {
      const sentence = String(obj.sentence ?? "").trim();
      const answer = String(obj.answer ?? "").trim();
      if (!sentence || !answer) return null;
      const alternatives = Array.isArray(obj.alternatives)
        ? obj.alternatives.map(String).map((s) => s.trim()).filter(Boolean)
        : undefined;
      return {
        type,
        script: String(obj.script ?? ""),
        sentence,
        answer,
        alternatives,
      };
    }
    case "number-line": {
      const min = Number(obj.min ?? 0);
      const max = Number(obj.max ?? 100);
      const target = Number(obj.target ?? 0);
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(target) || max <= min) {
        return null;
      }
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        min,
        max,
        target,
        unit: obj.unit ? String(obj.unit) : undefined,
        tolerance:
          obj.tolerance && Number.isFinite(Number(obj.tolerance))
            ? Number(obj.tolerance)
            : undefined,
      };
    }
    case "highlight": {
      const passage = String(obj.passage ?? "").trim();
      const targets = Array.isArray(obj.targets)
        ? obj.targets.map(String).map((s) => s.trim()).filter(Boolean)
        : [];
      if (!passage || targets.length === 0) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        passage,
        targets,
      };
    }
    case "reading-passage": {
      const passage = String(obj.passage ?? "").trim();
      const question = String(obj.question ?? "").trim();
      const options = Array.isArray(obj.options)
        ? obj.options
            .map((o) => {
              if (!o || typeof o !== "object") return null;
              const opt = o as Record<string, unknown>;
              const key = String(opt.key ?? "").trim();
              const label = String(opt.label ?? "").trim();
              if (!key || !label) return null;
              return { key, label };
            })
            .filter((o): o is { key: string; label: string } => o !== null)
        : [];
      const correctKey = String(obj.correctKey ?? "").trim();
      if (!passage || !question || options.length < 2 || !correctKey) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        passage,
        question,
        options,
        correctKey,
      };
    }
    case "tap-label": {
      const imageUrl = String(obj.imageUrl ?? "").trim();
      const hotspots = Array.isArray(obj.hotspots)
        ? obj.hotspots
            .map((h) => {
              if (!h || typeof h !== "object") return null;
              const hp = h as Record<string, unknown>;
              const x = Number(hp.x);
              const y = Number(hp.y);
              const label = String(hp.label ?? "").trim();
              if (!Number.isFinite(x) || !Number.isFinite(y) || !label) return null;
              return { x, y, label };
            })
            .filter((h): h is { x: number; y: number; label: string } => h !== null)
        : [];
      if (!imageUrl || hotspots.length === 0) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        imageUrl,
        hotspots,
      };
    }
    case "pie-divider": {
      const slices = Math.max(2, Math.min(16, Number(obj.slices) || 0));
      const selectTarget = Math.max(0, Math.min(slices, Number(obj.selectTarget) || 0));
      if (!slices) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        slices,
        selectTarget,
      };
    }
    case "balance-scale": {
      const leftFixed = Array.isArray(obj.leftFixed)
        ? obj.leftFixed
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const o = x as Record<string, unknown>;
              const label = String(o.label ?? "").trim();
              const weight = Number(o.weight);
              if (!label || !Number.isFinite(weight)) return null;
              return { label, weight };
            })
            .filter((x): x is { label: string; weight: number } => x !== null)
        : [];
      const options = Array.isArray(obj.options)
        ? obj.options
            .map((x, i) => {
              if (!x || typeof x !== "object") return null;
              const o = x as Record<string, unknown>;
              const label = String(o.label ?? "").trim();
              const weight = Number(o.weight);
              const id = String(o.id ?? `t${i + 1}`).trim();
              if (!label || !Number.isFinite(weight)) return null;
              return { id, label, weight };
            })
            .filter((x): x is { id: string; label: string; weight: number } => x !== null)
        : [];
      if (leftFixed.length === 0 || options.length === 0) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        leftFixed,
        options,
      };
    }
    case "letter-tiles": {
      const word = String(obj.word ?? "").trim().toUpperCase();
      if (!/^[A-Z]+$/.test(word)) return null;
      const decoys = Array.isArray(obj.decoys)
        ? obj.decoys
            .map(String)
            .map((s) => s.trim().toUpperCase())
            .filter((s) => /^[A-Z]$/.test(s))
        : undefined;
      return {
        type,
        script: String(obj.script ?? ""),
        prompt: obj.prompt ? String(obj.prompt) : undefined,
        word,
        decoys,
      };
    }
    default:
      return null;
  }
}
