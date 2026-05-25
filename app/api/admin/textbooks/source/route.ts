import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import { deleteSource } from "@/lib/textbooks";
import { getInstructor } from "@/lib/instructors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);

  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const sourceId = searchParams.get("sourceId");

  if (!instructorId || !getInstructor(instructorId)) {
    return Response.json({ error: "Unknown instructor" }, { status: 400 });
  }
  if (!sourceId) {
    return Response.json({ error: "sourceId required" }, { status: 400 });
  }

  try {
    await deleteSource(instructorId, sourceId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[textbooks/source] DELETE failed:", e);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
