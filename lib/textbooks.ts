// Firestore CRUD for textbook sources + RAG chunks.
//
// Data model:
//   instructorDocs/{instructorId}/sources/{sourceId}
//     filename, uploadedAt, uploadedBy, totalChunks, totalPages, status
//
//   instructorDocs/{instructorId}/chunks/{chunkId}
//     text, embedding: number[384], pageNumber, sourceId, createdAt
//
// Chunks are stored flat under the instructor (not nested under sources) so
// retrieval queries scan a single collection. Source docs hold metadata so we
// can list/delete uploaded textbooks per instructor.

import { adminDb } from "./firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface SourceDoc {
  id: string;
  filename: string;
  uploadedAt: Date;
  uploadedBy: string;
  totalChunks: number;
  totalPages: number;
  status: "ready" | "processing" | "failed";
}

export interface ChunkDoc {
  id: string;
  text: string;
  embedding: number[];
  pageNumber: number;
  sourceId: string;
  sourceName?: string;
}

// Firestore has TWO write-batch limits — 500 ops per commit AND 10 MiB total
// payload per commit. With 384-float embeddings the SIZE limit binds first:
// a single chunk doc Firestore-encodes to ~8–12 KB (embedding + text). 100
// chunks ≈ 1.2 MB per commit, safely under the 10 MiB ceiling. Earlier we
// used 400 and hit "Transaction too big" on large textbooks.
const FIRESTORE_BATCH_LIMIT = 100;

function sourcesCol(instructorId: string) {
  return adminDb().collection("instructorDocs").doc(instructorId).collection("sources");
}

function chunksCol(instructorId: string) {
  return adminDb().collection("instructorDocs").doc(instructorId).collection("chunks");
}

/** Create a new source doc; returns the source id. */
export async function createSource(
  instructorId: string,
  data: {
    filename: string;
    uploadedBy: string;
    totalPages: number;
  }
): Promise<string> {
  const ref = await sourcesCol(instructorId).add({
    filename: data.filename,
    uploadedAt: FieldValue.serverTimestamp(),
    uploadedBy: data.uploadedBy,
    totalPages: data.totalPages,
    totalChunks: 0,
    status: "processing",
  });
  return ref.id;
}

export async function finalizeSource(
  instructorId: string,
  sourceId: string,
  patch: { totalChunks: number; status: "ready" | "failed" }
) {
  await sourcesCol(instructorId).doc(sourceId).update(patch);
}

/**
 * Write many chunks to Firestore in batches. Each chunk gets an auto-ID.
 * Returns the actual count written (matches input length on success).
 */
export async function writeChunks(
  instructorId: string,
  sourceId: string,
  chunks: Array<{
    text: string;
    embedding: number[];
    pageNumber: number;
  }>
): Promise<number> {
  const col = chunksCol(instructorId);
  let written = 0;
  for (let i = 0; i < chunks.length; i += FIRESTORE_BATCH_LIMIT) {
    const slice = chunks.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = adminDb().batch();
    for (const c of slice) {
      const docRef = col.doc(); // auto-id
      batch.set(docRef, {
        text: c.text,
        embedding: c.embedding,
        pageNumber: c.pageNumber,
        sourceId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += slice.length;
  }
  return written;
}

/** List sources for an instructor, newest first. */
export async function listSources(instructorId: string): Promise<SourceDoc[]> {
  const snap = await sourcesCol(instructorId).orderBy("uploadedAt", "desc").get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      filename: data.filename ?? "",
      uploadedAt: tsToDate(data.uploadedAt),
      uploadedBy: data.uploadedBy ?? "",
      totalChunks: data.totalChunks ?? 0,
      totalPages: data.totalPages ?? 0,
      status: data.status ?? "ready",
    };
  });
}

/** Delete a source and all its chunks. */
export async function deleteSource(instructorId: string, sourceId: string) {
  // Delete chunks owned by this source.
  const chunksSnap = await chunksCol(instructorId)
    .where("sourceId", "==", sourceId)
    .get();
  for (let i = 0; i < chunksSnap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const slice = chunksSnap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = adminDb().batch();
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  // Delete the source doc itself.
  await sourcesCol(instructorId).doc(sourceId).delete();
}

/**
 * Load ALL chunks for an instructor. Used by the chat /api/chat route at
 * query time. For instructors with thousands of chunks this is a lot of
 * Firestore reads — see lib/groq.ts for the per-warm-instance memo so we
 * don't re-fetch on every chat turn.
 */
export async function getAllChunks(
  instructorId: string
): Promise<ChunkDoc[]> {
  const snap = await chunksCol(instructorId).get();
  // Build a lookup from sourceId → filename so retrieved chunks know which
  // source/textbook they came from (used in citations).
  const sourcesSnap = await sourcesCol(instructorId).get();
  const sourceNames = new Map<string, string>();
  sourcesSnap.docs.forEach((s) =>
    sourceNames.set(s.id, s.data().filename ?? "Unknown source")
  );

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      text: data.text ?? "",
      embedding: Array.isArray(data.embedding) ? data.embedding : [],
      pageNumber: data.pageNumber ?? 0,
      sourceId: data.sourceId ?? "",
      sourceName: sourceNames.get(data.sourceId) ?? "Unknown source",
    };
  });
}

function tsToDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}
