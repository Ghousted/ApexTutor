// REST surface for course CRUD. All endpoints under /api/admin/courses are
// admin-gated server-side. Client UI lives in app/admin/courses/*.

import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import {
  listCourses,
  createCourse,
  type CourseDoc,
} from "@/lib/courses";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  try {
    const courses = await listCourses();
    return Response.json({
      courses: courses.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[courses GET] failed:", e);
    return Response.json({ error: "Failed to list courses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  try {
    const body = (await req.json()) as Partial<CourseDoc>;
    if (!body.title || !body.subject) {
      return Response.json(
        { error: "title and subject are required" },
        { status: 400 }
      );
    }
    const id = await createCourse({
      title: body.title,
      subject: body.subject,
      description: body.description ?? "",
      overview: body.overview,
      gradeBand: body.gradeBand,
      instructorId: body.instructorId ?? null,
      status: body.status ?? "draft",
      freeTier: Boolean(body.freeTier),
    });
    return Response.json({ id });
  } catch (e) {
    console.error("[courses POST] failed:", e);
    return Response.json({ error: "Failed to create course" }, { status: 500 });
  }
}
