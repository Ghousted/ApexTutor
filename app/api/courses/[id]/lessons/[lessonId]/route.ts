import { NextRequest } from "next/server";
import { getCourse, getLesson } from "@/lib/courses";

export const runtime = "nodejs";

/** Public lesson detail. Only resolves if the parent course is published. */
export async function GET(
  _: NextRequest,
  ctx: { params: Promise<{ id: string; lessonId: string }> }
) {
  const { id: courseId, lessonId } = await ctx.params;
  const course = await getCourse(courseId);
  if (!course || course.status !== "published") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const lesson = await getLesson(courseId, lessonId);
  if (!lesson) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    course: {
      id: course.id,
      title: course.title,
      instructorId: course.instructorId,
      gradeBand: course.gradeBand ?? null,
    },
    lesson: {
      id: lesson.id,
      title: lesson.title,
      objective: lesson.objective,
      order: lesson.order,
      steps: lesson.steps,
    },
  });
}
