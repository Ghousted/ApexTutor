// Server-side AI lesson skeleton generator.
//
// Given a topic + grade band, ask Groq for a Step[] that an admin can review
// and edit. We use JSON mode so the response is structured. The Step shape
// here must mirror lib/courses.ts — any new step types need adding both
// places.

import { groqClient } from "./groq";
import type { Step } from "./courses";

const MODEL = "llama-3.1-8b-instant";

const SYSTEM = `You are a senior curriculum designer. Given a topic, grade band, and subject, produce a 5-7 step interactive lesson skeleton.

LANGUAGE: All script text, questions, options, prompts, and items must be written in clear English. Use natural English phrasing throughout. Anchor abstract ideas in everyday situations that work for any English-speaking learner (sports scores, grocery prices, video games, weather, cooking, pocket money). Avoid culture-specific references that would alienate students from any region.

Each step is one atomic interaction. Mix the types — don't fire 4 quizzes in a row. End with a checkpoint.

Output strictly this JSON shape (no prose, no markdown fence):
{
  "steps": [
    { "type": "intro", "script": "..." },
    { "type": "explainer", "script": "...", "bullets": ["..", ".."] },
    { "type": "quiz", "script": "...", "question": "...",
      "options": [{ "key": "A", "label": "..." }, { "key": "B", "label": "..." }, { "key": "C", "label": "..." }],
      "correctKey": "A" },
    { "type": "fraction-bar", "script": "...", "target": "3/4" },
    { "type": "match-pairs", "script": "...", "prompt": "...",
      "pairs": [{ "left": "...", "right": "..." }, { "left": "...", "right": "..." }, { "left": "...", "right": "..." }] },
    { "type": "sort-sequence", "script": "...", "prompt": "...",
      "items": ["first thing", "second thing", "third thing"] },
    { "type": "true-false", "script": "...", "statement": "...", "answer": true },
    { "type": "checkpoint", "script": "..." }
  ]
}

Rules:
- 5 to 7 steps total. Always start with intro and end with checkpoint.
- Include 2-3 INTERACTIVE steps (quiz/fraction-bar/match-pairs/sort-sequence/true-false). Not more.
- Scripts are 1-2 short sentences in plain English. Direct and warm.
- Use universally relatable examples (sports, food, money, weather, games, animals) so the lesson works for any English-speaking student.
- Quiz options: 3-4 entries with one correct. Set correctKey to that option's key.
- Fraction-bar target: simple like "3/4", "2/5", "5/8".
- Match-pairs: 3-4 pairs.
- Sort-sequence items: 3-5 entries in CORRECT order (the player shuffles them).
- Use {{studentName}} in scripts when natural — the player substitutes it at runtime.
- DO NOT include LaTeX, code, or markdown. Plain text only in scripts.`;

export interface GenerateLessonInput {
  topic: string;
  lessonTitle?: string;
  courseSubject?: string;
  gradeMin: number;
  gradeMax: number;
}

export interface GenerateLessonResult {
  steps: Step[];
  modelMs: number;
  rawStepCount: number;
}

export async function generateLesson(
  input: GenerateLessonInput
): Promise<GenerateLessonResult> {
  const userMessage = `Topic: ${input.topic}
Lesson title: ${input.lessonTitle || "(use the topic)"}
Subject: ${input.courseSubject || "General"}
Grade band: Grade ${input.gradeMin}${
    input.gradeMin === input.gradeMax ? "" : `–${input.gradeMax}`
  }

Produce the lesson now.`;

  const t0 = Date.now();
  const completion = await groqClient.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMessage },
    ],
    stream: false,
    response_format: { type: "json_object" },
    temperature: 0.6,
    max_tokens: 2000,
  });
  const modelMs = Date.now() - t0;

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: { steps?: unknown } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  if (!Array.isArray(parsed.steps)) {
    throw new Error("AI didn't return a steps array");
  }
  const rawStepCount = parsed.steps.length;
  const steps = parsed.steps
    .map(coerceStep)
    .filter((s): s is Step => s !== null);

  return { steps, modelMs, rawStepCount };
}

/** Validate + coerce one step from the AI's loose JSON into our Step union.
 *  Returns null if the step is malformed (we drop those silently). */
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
      const answer = Boolean(obj.answer);
      if (!statement) return null;
      return {
        type,
        script: String(obj.script ?? ""),
        statement,
        answer,
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
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(target)) {
        return null;
      }
      if (max <= min) return null;
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
              return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), label };
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
    default:
      return null;
  }
}
