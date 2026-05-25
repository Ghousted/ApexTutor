// Server-side text embeddings via Transformers.js + BGE-small.
//
// BGE-small-en-v1.5 is a 384-dimensional sentence-transformer trained for
// retrieval. It's the best free open model for English RAG that fits in a
// serverless function: ~120MB quantized, runs on CPU in ~50–200ms per text.
//
// First call per cold function loads the model from HuggingFace (~5–10s).
// We cache the pipeline at module level so subsequent calls reuse it within
// the same warm function instance.

const MODEL = "Xenova/bge-small-en-v1.5";

interface FeatureExtractionPipeline {
  (
    text: string | string[],
    opts: { pooling: "mean" | "cls"; normalize: boolean }
  ): Promise<{
    data: Float32Array;
    dims: number[];
  }>;
}

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const pipe = await pipeline("feature-extraction", MODEL);
    return pipe as unknown as FeatureExtractionPipeline;
  })();
  return pipelinePromise;
}

/** Embed a single piece of text. Returns a normalized 384-dim vector. */
export async function embed(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  // BGE-small expects mean-pooling + normalization for retrieval.
  const out = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

/**
 * Embed many texts. Currently sequential — BGE-small is fast enough that this
 * doesn't bottleneck for the chunk counts we expect (500–5000 per textbook).
 * If batching becomes a hot path, the Transformers.js pipeline accepts
 * string[] but the typings here would need a tweak.
 */
export async function embedMany(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await embed(t));
  }
  return out;
}

export const EMBEDDING_DIM = 384;
