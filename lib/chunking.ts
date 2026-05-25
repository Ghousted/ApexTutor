// Text chunking for RAG. Takes extracted PDF pages and produces semantic
// chunks small enough for embedding while preserving page-number attribution
// so the AI can cite where each fact came from.
//
// Strategy:
//   - Page-level baseline: each chunk knows which page it came from.
//   - Target chunk size ~600 chars (≈150 tokens). BGE-small handles up to 512
//     tokens but smaller chunks give better retrieval granularity.
//   - 100-char overlap between consecutive chunks within a page so concepts
//     spanning a chunk boundary aren't lost to retrieval.
//   - Sentence-aware: try to split on sentence boundaries (.!?) before
//     mid-sentence cuts.

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface Chunk {
  text: string;
  pageNumber: number;
  chunkIndexOnPage: number;
}

// Target ~1000 chars (≈250 tokens) per chunk. BGE-small handles up to 512
// tokens comfortably. Larger chunks mean ~40% fewer Firestore documents per
// textbook, which dramatically speeds up cold-cache retrieval at chat time.
// Tradeoff: slightly coarser retrieval granularity (a top-K chunk now covers
// a bigger span of text), but quality on our textbooks remains solid.
const TARGET_CHUNK_SIZE = 1000;
const OVERLAP = 150;
const HARD_MAX = 1400;

export function chunkPages(pages: PageText[]): Chunk[] {
  const out: Chunk[] = [];
  for (const page of pages) {
    const normalized = page.text.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const pieces = chunkText(normalized);
    pieces.forEach((piece, idx) => {
      out.push({
        text: piece,
        pageNumber: page.pageNumber,
        chunkIndexOnPage: idx,
      });
    });
  }
  return out;
}

function chunkText(text: string): string[] {
  if (text.length <= TARGET_CHUNK_SIZE) return [text];

  const out: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + TARGET_CHUNK_SIZE, text.length);

    // Try to extend to the next sentence boundary if we're not near the end.
    if (end < text.length) {
      const lookaheadEnd = Math.min(cursor + HARD_MAX, text.length);
      const slice = text.slice(end, lookaheadEnd);
      const sentenceMatch = slice.search(/[.!?]\s/);
      if (sentenceMatch !== -1) {
        end = end + sentenceMatch + 1; // include the terminator
      }
    }

    const piece = text.slice(cursor, end).trim();
    if (piece) out.push(piece);

    if (end >= text.length) break;
    cursor = Math.max(end - OVERLAP, cursor + 1); // step forward with overlap
  }
  return out;
}

/** Cosine similarity between two vectors of equal length. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
