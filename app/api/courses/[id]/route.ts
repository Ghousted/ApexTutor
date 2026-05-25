import { NextRequest } from "next/server";
import { getCourse, listLessons } from "@/lib/courses";

export const runtime = "nodejs";

/** Public course detail. Returns 404 for drafts so students never see them. */
export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const course = await getCourse(id);
  if (!course || course.status !== "published") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const lessons = await listLessons(id);
  return Response.json({
    course: {
      id: course.id,
      title: course.title,
      subject: course.subject,
      description: course.description,
      overview: course.overview ?? null,
      gradeBand: course.gradeBand ?? null,
      instructorId: course.instructorId,
      freeTier: course.freeTier,
      lessonCount: course.lessonCount,
    },
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      objective: l.objective,
      order: l.order,
      stepCount: l.steps.length,
    })),
  });
}
