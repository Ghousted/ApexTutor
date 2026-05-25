import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import { generateLesson } from "@/lib/lessonGenerator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);

  let body: {
    topic?: string;
    lessonTitle?: string;
    courseSubject?: string;
    gradeMin?: number;
    gradeMax?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  if (!topic) return Response.json({ error: "Topic is required" }, { status: 400 });
  const gradeMin = clamp(body.gradeMin ?? 5, 4, 12);
  const gradeMax = clamp(body.gradeMax ?? gradeMin, gradeMin, 12);

  try {
    const result = await generateLesson({
      topic,
      lessonTitle: body.lessonTitle,
      courseSubject: body.courseSubject,
      gradeMin,
      gradeMax,
    });
    return Response.json({
      steps: result.steps,
      modelMs: result.modelMs,
      rawStepCount: result.rawStepCount,
      keptStepCount: result.steps.length,
    });
  } catch (e) {
    console.error("[generate-lesson] failed:", e);
    return Response.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Couldn't generate. Try a more specific topic.",
      },
      { status: 502 }
    );
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
