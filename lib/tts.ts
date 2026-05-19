// Client-side TTS.
// - English / Taglish → Kokoro-82M ONNX, voice "af_nicole" (calm female, instructor-like)
// - Tagalog → Xenova/mms-tts-tgl (Meta MMS — Kokoro doesn't support Tagalog)
// Both run in the browser. We try WebGPU first for 5–10× speedup; transparently
// fall back to WASM on Firefox / older browsers. Models are cached after first load.

export type TtsLang = "English" | "Taglish" | "Tagalog";

// Kokoro voice — voice prefix encodes language:
//   af_* = American Female English
//   am_* = American Male English
//   bf_* / bm_* = British
//   jf_* / jm_* = Japanese (avoid for English content)
// af_heart is the documented default. Individual instructors override this
// at call time by passing voiceId to synthesizeStream / synthesize.
const KOKORO_DEFAULT_VOICE = "af_heart";
const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

interface KokoroTTSLike {
  generate(
    text: string,
    opts: { voice: string }
  ): Promise<{ audio: Float32Array; sampling_rate: number; toBlob?: () => Blob }>;
  stream(
    text: string,
    opts: { voice: string }
  ): AsyncIterable<{
    text?: string;
    phonemes?: string;
    audio: { audio: Float32Array; sampling_rate: number };
  }>;
}

interface MmsPipeLike {
  (text: string): Promise<{ audio: Float32Array; sampling_rate: number }>;
}

let kokoroInstance: KokoroTTSLike | null = null;
let kokoroLoading: Promise<KokoroTTSLike> | null = null;
const mmsCache = new Map<string, MmsPipeLike>();

async function loadKokoro(): Promise<KokoroTTSLike> {
  if (kokoroInstance) return kokoroInstance;
  if (kokoroLoading) return kokoroLoading;

  kokoroLoading = (async () => {
    const { KokoroTTS } = await import("kokoro-js");
    // Try WebGPU first — massive speedup. Falls back to WASM if unavailable.
    try {
      const t0 = performance.now();
      const tts = (await KokoroTTS.from_pretrained(KOKORO_MODEL, {
        dtype: "fp32",
        device: "webgpu",
      })) as unknown as KokoroTTSLike;
      console.log(
        `[TTS] Kokoro loaded on WebGPU in ${((performance.now() - t0) / 1000).toFixed(1)}s`
      );
      kokoroInstance = tts;
      return tts;
    } catch (e) {
      console.warn("[TTS] WebGPU unavailable, falling back to WASM:", e);
      const tts = (await KokoroTTS.from_pretrained(KOKORO_MODEL, {
        dtype: "fp32",
      })) as unknown as KokoroTTSLike;
      kokoroInstance = tts;
      return tts;
    } finally {
      kokoroLoading = null;
    }
  })();

  return kokoroLoading;
}

async function loadMmsPipeline(model: string): Promise<MmsPipeLike> {
  const cached = mmsCache.get(model);
  if (cached) return cached;
  const { pipeline } = await import("@huggingface/transformers");
  // Try WebGPU, fall back to default (WASM)
  let pipe: MmsPipeLike;
  try {
    pipe = (await pipeline("text-to-speech", model, {
      device: "webgpu",
    } as unknown as Parameters<typeof pipeline>[2])) as unknown as MmsPipeLike;
  } catch {
    pipe = (await pipeline("text-to-speech", model)) as unknown as MmsPipeLike;
  }
  mmsCache.set(model, pipe);
  return pipe;
}

/** Synthesize text to PCM audio (non-streaming). Throws on failure. */
export async function synthesize(
  text: string,
  lang: TtsLang,
  voiceId: string = KOKORO_DEFAULT_VOICE
): Promise<{ audio: Float32Array; samplingRate: number }> {
  if (lang === "Tagalog") {
    const pipe = await loadMmsPipeline("Xenova/mms-tts-tgl");
    const out = await pipe(text);
    return { audio: out.audio, samplingRate: out.sampling_rate };
  }
  const tts = await loadKokoro();
  const result = await tts.generate(text, { voice: voiceId });
  return { audio: result.audio, samplingRate: result.sampling_rate };
}

/**
 * Split text into sentences for chunked synthesis. Keeps the terminating
 * punctuation with each sentence so Kokoro's prosody stays natural.
 */
function splitSentences(text: string): string[] {
  // Match runs of non-terminator characters followed by ., !, or ? — plus a
  // trailing fragment with no terminator (final clause without punctuation).
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) return [text];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Yield sentence-level audio chunks as they're generated. Lets the UI start
 * playback as soon as the first sentence is ready. We do the splitting
 * ourselves (instead of using Kokoro's built-in stream()) because the built-in
 * stream is unreliable: it sometimes yields empty/silent chunks for sentences
 * with non-English words, and the iterator can hang instead of cleanly
 * completing.
 */
export async function* synthesizeStream(
  text: string,
  lang: TtsLang,
  voiceId: string = KOKORO_DEFAULT_VOICE
): AsyncGenerator<{ audio: Float32Array; samplingRate: number }> {
  if (lang === "Tagalog") {
    const pipe = await loadMmsPipeline("Xenova/mms-tts-tgl");
    const out = await pipe(text);
    yield { audio: out.audio, samplingRate: out.sampling_rate };
    return;
  }
  const tts = await loadKokoro();
  const sentences = splitSentences(text);
  for (const sentence of sentences) {
    try {
      const result = await tts.generate(sentence, { voice: voiceId });
      if (result.audio && result.audio.length > 0) {
        yield {
          audio: result.audio,
          samplingRate: result.sampling_rate,
        };
      } else {
        console.warn(`[TTS] empty audio for sentence: "${sentence}"`);
      }
    } catch (e) {
      console.error(`[TTS] failed to synthesize sentence: "${sentence}"`, e);
    }
  }
}

/** Convert raw PCM Float32 samples to a WAV-encoded Blob for <audio> playback. */
export function pcmToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Whether the model for this language has already been downloaded this session. */
export function isModelLoaded(lang: TtsLang): boolean {
  if (lang === "Tagalog") return mmsCache.has("Xenova/mms-tts-tgl");
  return kokoroInstance !== null;
}
