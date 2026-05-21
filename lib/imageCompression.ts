// Client-side image compression for vision-model uploads.
// Goal: keep uploads under ~300KB so:
//   1. Groq vision inference stays fast (smaller image = faster encoding)
//   2. The /api/chat request body doesn't blow past Vercel's 4.5MB limit
//      when multiple images are attached
//
// Process: decode → resize (longest edge ≤ 1024px) → re-encode as JPEG 0.85.
// Output is a base64 data URL ready to pass to Groq's vision API.

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

export async function compressImageToDataUrl(file: File): Promise<string> {
  // Browser-native decode. Skips a CPU-heavy <img>.onload roundtrip.
  const bitmap = await createImageBitmap(file);

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.(); // free the decoded source

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Rough size estimate (kilobytes) of a base64 data URL. */
export function dataUrlSizeKB(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  // Base64 expands by ~4/3, so the decoded byte length is len * 3/4 (minus padding)
  const bytes = (base64.length * 3) / 4;
  return Math.round(bytes / 1024);
}
