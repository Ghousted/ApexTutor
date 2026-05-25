"use client";

// Browser-side PDF text extraction via pdfjs-dist.
//
// We do this in the browser instead of the server because:
//   1. The full PDF can be huge (50MB+) but the extracted text is usually
//      ≤ 5% of that size, well under Vercel's 4.5MB request body limit
//   2. No need for server-side filesystem / temp files
//   3. Vercel cold-start time isn't burned on PDF parsing
//
// Worker setup: pdfjs-dist needs a Web Worker. We point GlobalWorkerOptions to
// the CDN-hosted worker matching our installed version. One-time download per
// browser, cached after.

import type { PageText } from "./chunking";

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

interface PdfPageTextContent {
  items: PdfTextItem[];
}

interface PdfPage {
  getTextContent(): Promise<PdfPageTextContent>;
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

let pdfjsPromise: Promise<unknown> | null = null;

interface PdfjsModule {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // The legacy build is more compatible across bundlers / browsers.
      const mod = (await import("pdfjs-dist")) as unknown as PdfjsModule;
      // Match worker version to library version, served from unpkg CDN.
      mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`;
      return mod;
    })();
  }
  return pdfjsPromise as Promise<PdfjsModule>;
}

export interface ExtractionProgress {
  pagesDone: number;
  totalPages: number;
}

/**
 * Extract per-page text from a PDF File. Returns an array of pages with their
 * page number and plain text. Pages with no extractable text are still
 * included (so chunk page numbers stay aligned with the original PDF).
 */
export async function extractPdfText(
  file: File,
  onProgress?: (p: ExtractionProgress) => void
): Promise<PageText[]> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (item.str ?? "") + (item.hasEOL ? "\n" : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({ pageNumber: i, text });
    onProgress?.({ pagesDone: i, totalPages: doc.numPages });
  }

  return pages;
}
