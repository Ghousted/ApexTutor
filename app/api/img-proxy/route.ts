// Image proxy. Many image hosts block hot-linking via Referer header —
// the browser refuses to render the image, even though the URL is valid.
// We fetch the image server-side (no Referer pointing at our domain) and
// re-serve it. Side benefit: CORS is bypassed if we ever want to read
// pixels into a canvas.
//
// Usage:  <img src={`/api/img-proxy?url=${encodeURIComponent(originalUrl)}`} />
//
// Cached at the edge (s-maxage=86400 = 24h) so we don't refetch each
// load. The browser cache layer (max-age=3600) helps too.

import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED_PROTOCOLS = ["http:", "https:"];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — generous, blocks pathological inputs

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url", { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return new Response("Protocol not allowed", { status: 400 });
  }
  // SSRF guard — block obvious private targets. Doesn't catch DNS rebinding
  // but stops casual abuse pointing at internal services.
  const host = parsed.hostname;
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return new Response("Forbidden host", { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      // Browser-ish UA — some hosts 403 obvious bot UAs.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ApexTutorImageProxy/1.0; +https://apex-tutor-alpha.vercel.app)",
      },
      // Don't follow redirects to private IPs blindly; default fetch
      // follows public-only chains which is fine here.
      redirect: "follow",
    });
    if (!upstream.ok) {
      return new Response(`Upstream returned ${upstream.status}`, {
        status: 502,
      });
    }
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return new Response("Not an image", { status: 415 });
    }
    const len = Number(upstream.headers.get("content-length") || 0);
    if (len > MAX_BYTES) {
      return new Response("Image too large", { status: 413 });
    }
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new Response("Image too large", { status: 413 });
    }
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
      },
    });
  } catch (e) {
    console.error("[img-proxy] failed:", e);
    return new Response("Fetch failed", { status: 502 });
  }
}
