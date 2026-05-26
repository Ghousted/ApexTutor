// Speech-to-text endpoint for Synthesis-style "answer with voice" interactions.
//
// Accepts a multipart upload with `audio` (a webm/ogg/mp3/wav Blob, typically
// short — under 10s for quiz answers). Forwards to Groq Whisper which is fast
// (~1s for short clips) and free under their quota.
//
// Returns: { text: string }
//
// Auth: any signed-in user — same rate limits as /api/ask. Reusing the
// existing Firebase ID token verification keeps this consistent.

import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { groqClient } from "@/lib/groq";
import { adminApp } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "whisper-large-v3-turbo";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — generous for a 30s clip

export async function POST(req: NextRequest) {
  // Verify the user is signed in. We don't gate by role — anyone can use
  // voice answers — but anonymous traffic shouldn't burn quota.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Missing auth token" }, { status: 401 });
  }
  try {
    await getAuth(adminApp()).verifyIdToken(token);
  } catch {
    return Response.json({ error: "Invalid auth token" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return Response.json({ error: "audio file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "audio too large" }, { status: 413 });
  }

  try {
    const transcription = await groqClient.audio.transcriptions.create({
      file,
      model: MODEL,
      // English-only is enough for v1; the lesson scripts are English already.
      language: "en",
      response_format: "json",
      // Lower temperature → more literal transcription, less hallucination
      // on noisy / short clips. 0 = greedy decoding.
      temperature: 0,
    });
    return Response.json({ text: transcription.text ?? "" });
  } catch (e) {
    console.error("[transcribe] failed:", e);
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Couldn't transcribe. Try again.",
      },
      { status: 502 }
    );
  }
}
