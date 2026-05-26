// Press-and-hold voice recording + Groq Whisper transcription.
//
// Usage:
//   const recorder = await startRecording();
//   ... later ...
//   const text = await recorder.stopAndTranscribe();
//
// Returns the transcribed text (lowercased, trimmed) so callers can do
// simple substring matching against quiz options without re-normalising.

"use client";

import { auth } from "./firebase";
import { getIdToken } from "firebase/auth";

export interface ActiveRecording {
  stopAndTranscribe: () => Promise<string>;
  cancel: () => void;
}

export function isVoiceInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof window.MediaRecorder !== "undefined"
  );
}

export async function startRecording(): Promise<ActiveRecording> {
  if (!isVoiceInputSupported()) {
    throw new Error("Voice input is not supported in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Prefer opus in webm — small, well-supported by Whisper. Falls back to
  // whatever the browser picks if opus isn't available.
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : undefined;
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  const cleanup = () => {
    if (recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    cancel: cleanup,
    stopAndTranscribe: () =>
      new Promise<string>((resolve, reject) => {
        recorder.onstop = async () => {
          try {
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, {
              type: recorder.mimeType || "audio/webm",
            });
            // Whisper requires a filename hint to detect format — naming it
            // .webm matches the mime type and avoids "could not detect" errors.
            const file = new File([blob], "speech.webm", {
              type: blob.type,
            });
            const user = auth.currentUser;
            if (!user) {
              reject(new Error("Not signed in"));
              return;
            }
            const token = await getIdToken(user);
            const form = new FormData();
            form.append("audio", file);
            const res = await fetch("/api/transcribe", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            });
            const data = (await res.json()) as { text?: string; error?: string };
            if (!res.ok) {
              reject(new Error(data.error || "Transcription failed"));
              return;
            }
            resolve((data.text ?? "").trim().toLowerCase());
          } catch (e) {
            reject(e);
          }
        };
        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          cleanup();
        }
      }),
  };
}
