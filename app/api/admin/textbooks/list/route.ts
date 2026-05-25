import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import { listSources } from "@/lib/textbooks";
import { getInstructor } from "@/lib/instructors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);

  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  if (!instructorId || !getInstructor(instructorId)) {
    return Response.json({ error: "Unknown instructor" }, { status: 400 });
  }

  try {
    const sources = await listSources(instructorId);
    return Response.json({
      sources: sources.map((s) => ({
        id: s.id,
        filename: s.filename,
        uploadedAt: s.uploadedAt.toISOString(),
        totalChunks: s.totalChunks,
        totalPages: s.totalPages,
        status: s.status,
      })),
    });
  } catch (e) {
    console.error("[textbooks/list] failed:", e);
    return Response.json({ error: "Failed to list sources" }, { status: 500 });
  }
}
