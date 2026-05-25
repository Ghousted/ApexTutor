import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import {
  listLessons,
  createLesson,
  reorderLessons,
  type Step,
} from "@/lib/courses";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id } = await params;
  try {
    const lessons = await listLessons(id);
    return Response.json({
      lessons: lessons.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[lessons GET] failed:", e);
    return Response.json({ error: "Failed to list lessons" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      title?: string;
      objective?: string;
      steps?: Step[];
    };
    if (!body.title) {
      return Response.json({ error: "title required" }, { status: 400 });
    }
    const lessonId = await createLesson(id, {
      title: body.title,
      objective: body.objective ?? "",
      steps: body.steps ?? [],
    });
    return Response.json({ id: lessonId });
  } catch (e) {
    console.error("[lessons POST] failed:", e);
    return Response.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Reorder endpoint. Body: { order: [{id, order}, ...] }
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);
  const { id } = await params;
  try {
    const { order } = (await req.json()) as {
      order: Array<{ id: string; order: number }>;
    };
    if (!Array.isArray(order)) {
      return Response.json({ error: "order array required" }, { status: 400 });
    }
    await reorderLessons(id, order);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[lessons PUT] failed:", e);
    return Response.json({ error: "Reorder failed" }, { status: 500 });
  }
}
