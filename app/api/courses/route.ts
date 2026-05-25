import { listCourses } from "@/lib/courses";

export const runtime = "nodejs";

/** Public catalog — returns only published courses. */
export async function GET() {
  try {
    const courses = await listCourses({ publishedOnly: true });
    return Response.json({
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        description: c.description,
        overview: c.overview ?? null,
        gradeBand: c.gradeBand ?? null,
        instructorId: c.instructorId,
        freeTier: c.freeTier,
        lessonCount: c.lessonCount,
      })),
    });
  } catch (e) {
    console.error("[api/courses] list failed:", e);
    return Response.json({ error: "Failed to list courses" }, { status: 500 });
  }
}
