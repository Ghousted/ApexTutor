import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import {
  getLesson,
  updateLesson,
  deleteLesson,
  type Step,
} from "@/lib/courses";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id, lessonId } = await params;
  const lesson = await getLesson(id, lessonId);
  if (!lesson) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    lesson: {
      ...lesson,
      createdAt: lesson.createdAt.toISOString(),
      updatedAt: lesson.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id, lessonId } = await params;
  const patch = (await req.json()) as Partial<{
    title: string;
    objective: string;
    steps: Step[];
  }>;
  try {
    await updateLesson(id, lessonId, patch);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[lesson PATCH] failed:", e);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id, lessonId } = await params;
  try {
    await deleteLesson(id, lessonId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[lesson DELETE] failed:", e);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
