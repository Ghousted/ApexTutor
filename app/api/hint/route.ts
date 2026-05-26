// On-demand hint generator. Called from the lesson player when a student
// taps "Need a hint?". The model gets the lesson title, objective, and a
// summary of the current step, and returns ONE short hint sentence — not
// the answer.
//
// We deliberately keep the hint short and non-revealing: the tutor's job
// is to nudge, not to hand over the solution.

import { NextRequest } from "next/server";
import { groqClient } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "llama-3.1-8b-instant";

const SYSTEM = `You are a kind tutor. The student is stuck on one step of a lesson and asked for a hint. Give ONE short, encouraging sentence (max 18 words) that nudges them toward the right thinking — DO NOT reveal the answer. Speak directly to the student. No preamble, no "the answer is", no listing.`;

export async function POST(req: NextRequest) {
  let body: {
    stepType?: string;
    lessonTitle?: string;
    lessonObjective?: string;
    stepContext?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const user = [
    `Lesson: ${body.lessonTitle ?? "(untitled)"}`,
    `Objective: ${body.lessonObjective ?? "(none)"}`,
    `Step: ${body.stepType ?? "unknown"}`,
    `Context: ${body.stepContext ?? "(none)"}`,
    "",
    "Give one short hint now.",
  ].join("\n");

  try {
    const completion = await groqClient.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 60,
      stream: false,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip leading bullets, quotes, etc.
    const hint = raw.replace(/^["'\-•*]+\s*|["']+\s*$/g, "").trim();
    if (!hint) {
      return Response.json({
        hint: "Take another look — go one piece at a time.",
      });
    }
    return Response.json({ hint });
  } catch (e) {
    console.error("[hint] failed:", e);
    // Soft fallback — better to give a generic nudge than show an error.
    return Response.json({
      hint: "Slow it down — what's the very first thing you can spot?",
    });
  }
}
