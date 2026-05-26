// Admin endpoint for publishing instructor avatar overrides to Firestore.
// Catalog of instructors is hard-coded in lib/instructors.ts; this lets
// admins ship a different DiceBear pick without a code change. The client
// /admin/instructors page calls this when "Publish" is clicked.

import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const DOC_PATH = ["config", "instructorAvatarOverrides"] as const;

interface OverrideEntry {
  style: string;
  seed: string;
}

export async function GET(req: NextRequest) {
  // Anyone with a valid admin session can read the current overrides.
  // (Students read via a public-readable client path — separate handler.)
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);

  const snap = await adminDb().collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
  return Response.json({ overrides: snap.exists ? snap.data() : {} });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);

  let body: { instructorId?: string; style?: string; seed?: string; clear?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { instructorId } = body;
  if (!instructorId || typeof instructorId !== "string") {
    return Response.json({ error: "instructorId required" }, { status: 400 });
  }

  const ref = adminDb().collection(DOC_PATH[0]).doc(DOC_PATH[1]);

  if (body.clear) {
    // Reset this instructor back to its source-of-truth default.
    await ref.set({ [instructorId]: null }, { merge: true });
    return Response.json({ ok: true, cleared: true });
  }

  if (!body.style || !body.seed) {
    return Response.json(
      { error: "style and seed required (or pass clear:true)" },
      { status: 400 }
    );
  }
  const entry: OverrideEntry = { style: body.style, seed: body.seed };
  await ref.set({ [instructorId]: entry }, { merge: true });
  return Response.json({ ok: true });
}
