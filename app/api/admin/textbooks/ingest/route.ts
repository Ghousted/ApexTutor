import { NextRequest } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/adminAuth";
import { chunkPages, type PageText } from "@/lib/chunking";
import { embedMany } from "@/lib/embeddings";
import { createSource, finalizeSource, writeChunks } from "@/lib/textbooks";
import { getInstructor } from "@/lib/instructors";

// Node runtime required — Transformers.js for embeddings needs Node APIs,
// and firebase-admin can't run on edge either.
export const runtime = "nodejs";
// Long timeout — embedding 1000 chunks at ~100ms each ≈ 100s. Vercel hobby
// caps at 60s, pro caps at 300s. If hobby hits the wall, recommend chunking
// uploads or upgrading plans.
export const maxDuration = 300;

interface IngestBody {
  instructorId?: string;
  filename?: string;
  pages?: PageText[];
}

const MAX_PAGES = 1000;
const MAX_TOTAL_CHARS = 4_000_000; // ~4MB of text

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return unauthorizedResponse(auth.reason);

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { instructorId, filename, pages } = body;

  if (!instructorId || !getInstructor(instructorId)) {
    return Response.json({ error: "Unknown instructor" }, { status: 400 });
  }
  if (!filename || filename.length > 200) {
    return Response.json({ error: "Filename missing or too long" }, { status: 400 });
  }
  if (!Array.isArray(pages) || pages.length === 0) {
    return Response.json({ error: "No pages provided" }, { status: 400 });
  }
  if (pages.length > MAX_PAGES) {
    return Response.json(
      { error: `Too many pages (${pages.length}). Max ${MAX_PAGES}.` },
      { status: 400 }
    );
  }

  const totalChars = pages.reduce((acc, p) => acc + (p.text?.length ?? 0), 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return Response.json(
      {
        error: `Extracted text is too large (${Math.round(totalChars / 1024)}KB). Split the PDF and upload smaller sections.`,
      },
      { status: 413 }
    );
  }
  if (totalChars === 0) {
    return Response.json(
      { error: "No readable text in PDF. Is it a scanned image-only PDF?" },
      { status: 400 }
    );
  }

  // 1. Create source doc as "processing" so admin sees it appear immediately.
  const sourceId = await createSource(instructorId, {
    filename,
    uploadedBy: auth.uid!,
    totalPages: pages.length,
  });

  try {
    // 2. Chunk.
    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      await finalizeSource(instructorId, sourceId, { totalChunks: 0, status: "failed" });
      return Response.json({ error: "No usable text after chunking" }, { status: 400 });
    }

    // 3. Embed.
    console.log(
      `[ingest] embedding ${chunks.length} chunks for instructor=${instructorId}`
    );
    const t0 = Date.now();
    const embeddings = await embedMany(chunks.map((c) => c.text));
    const embedMs = Date.now() - t0;
    console.log(`[ingest] embeddings done in ${embedMs}ms`);

    // 4. Persist.
    const enriched = chunks.map((c, i) => ({
      text: c.text,
      embedding: embeddings[i],
      pageNumber: c.pageNumber,
    }));
    const written = await writeChunks(instructorId, sourceId, enriched);

    // 5. Mark source as ready.
    await finalizeSource(instructorId, sourceId, {
      totalChunks: written,
      status: "ready",
    });

    return Response.json({
      ok: true,
      sourceId,
      chunkCount: written,
      pageCount: pages.length,
      embedMs,
    });
  } catch (e) {
    console.error("[ingest] failed:", e);
    try {
      await finalizeSource(instructorId, sourceId, {
        totalChunks: 0,
        status: "failed",
      });
    } catch {
      // ignore — we've already logged the underlying error
    }
    return Response.json(
      { error: "Ingestion failed. Check server logs." },
      { status: 500 }
    );
  }
}
