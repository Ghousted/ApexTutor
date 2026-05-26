import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import { generateStep } from "@/lib/stepGenerator";
import type { Step } from "@/lib/courses";

export const runtime = "nodejs";
export const maxDuration = 60;

const STEP_TYPES: ReadonlyArray<Step["type"]> = [
  "intro",
  "explainer",
  "quiz",
  "fraction-bar",
  "match-pairs",
  "sort-sequence",
  "checkpoint",
  "true-false",
  "fill-blank",
  "number-line",
  "highlight",
  "reading-passage",
  "tap-label",
  "pie-divider",
  "balance-scale",
  "letter-tiles",
];

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);

  let body: {
    stepType?: string;
    lessonTitle?: string;
    lessonObjective?: string;
    courseSubject?: string;
    gradeMin?: number;
    gradeMax?: number;
    surroundingSteps?: Array<{ type: string; script?: string }>;
    previous?: Step;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stepType = body.stepType as Step["type"] | undefined;
  if (!stepType || !STEP_TYPES.includes(stepType)) {
    return Response.json({ error: "Unknown stepType" }, { status: 400 });
  }

  const gradeMin = clamp(body.gradeMin ?? 5, 4, 12);
  const gradeMax = clamp(body.gradeMax ?? gradeMin, gradeMin, 12);

  try {
    const result = await generateStep({
      stepType,
      lessonTitle: body.lessonTitle ?? "",
      lessonObjective: body.lessonObjective ?? "",
      courseSubject: body.courseSubject,
      gradeMin,
      gradeMax,
      surroundingSteps: body.surroundingSteps,
      previous: body.previous,
    });
    return Response.json({ step: result.step, modelMs: result.modelMs });
  } catch (e) {
    console.error("[generate-step] failed:", e);
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Couldn't regenerate. Try again.",
      },
      { status: 502 }
    );
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
