"use client";

import { useEffect } from "react";
import { prefetchVoice } from "@/lib/tts";

/**
 * Fire-and-forget voice model warmup. Drop into any page that's one click
 * away from a lesson (e.g., course detail) so Kokoro's ~100MB ONNX file
 * starts downloading while the user is reading the lesson list. By the
 * time they click "Start course", the model is usually already cached and
 * the first step's voice plays without delay.
 *
 * Safe to mount unconditionally — the underlying loader is idempotent.
 */
export default function VoicePrefetch() {
  useEffect(() => {
    prefetchVoice();
  }, []);
  return null;
}
