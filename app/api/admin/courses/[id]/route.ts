import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import {
  getCourse,
  updateCourse,
  deleteCourse,
  type CourseDoc,
} from "@/lib/courses";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    course: {
      ...course,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id } = await params;
  const patch = (await req.json()) as Partial<CourseDoc>;
  try {
    await updateCourse(id, patch);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[courses PATCH] failed:", e);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id } = await params;
  try {
    await deleteCourse(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[courses DELETE] failed:", e);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
