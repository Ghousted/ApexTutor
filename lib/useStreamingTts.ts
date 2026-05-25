"use client";

// Streaming TTS hook — synthesizes and plays AI replies sentence-by-sentence
// as they arrive from the Groq stream, instead of waiting for the full message
// before reading.
//
// Lifecycle from the caller's perspective:
//   1. `start()`             before a new AI response begins streaming
//   2. `feed(fullTextSoFar)` every time the streamed text grows
//   3. `endStream()`         when the assistant finishes producing tokens
//   4. `cancel()`            on user interrupt / new send / unmount
//
// Internally:
//   - Tracks how much of the text has been spoken (lastSpokenIndex)
//   - Detects sentence boundaries (.!? followed by whitespace)
//   - Synthesizes each completed sentence via the existing Kokoro pipeline
//   - Queues HTMLAudioElement playback so sentences play in order without
//     overlapping
//   - When the queue drains mid-stream, the next sentence arriving re-primes
//     playback (same bug-pattern from the manual TTS path)

import { useCallback, useEffect, useRef, useState } from "react";
import { synthesizeStream, pcmToWavBlob, type TtsLang } from "./tts";
import { latexToSpeech } from "./latexToSpeech";

const PLAYBACK_RATE = 1.1;

export interface StreamingTtsController {
  state: "idle" | "playing";
  start: () => void;
  feed: (fullTextSoFar: string) => void;
  endStream: () => void;
  cancel: () => void;
}

export function useStreamingTts({
  lang,
  voiceId,
}: {
  lang: TtsLang;
  voiceId?: string;
}): StreamingTtsController {
  const [state, setState] = useState<"idle" | "playing">("idle");

  // Sentence-detection state. lastSpokenIndex is the cursor into the full text
  // up to which everything has been queued for TTS. Remaining tail past this
  // cursor is the unspoken buffer.
  const lastSpokenIndexRef = useRef(0);
  const latestTextRef = useRef("");
  const streamEndedRef = useRef(false);

  // Audio playback state — mirrors the manual TTS path in ChatInterface.
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const cancelledRef = useRef(false);

  // Synthesis serialization. Without this, two feed() calls could each kick
  // off Kokoro generation concurrently and whichever finishes first lands in
  // the audio queue first — sentences play out of order. We chain every new
  // synthesis onto the previous one's promise so it strictly waits its turn.
  const synthesisChainRef = useRef<Promise<void>>(Promise.resolve());

  const teardownAudio = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
      } catch {
        // ignore
      }
      currentAudioRef.current = null;
    }
    audioQueueRef.current.forEach((a) => {
      try {
        a.pause();
        a.src = "";
      } catch {
        // ignore
      }
    });
    audioQueueRef.current = [];
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    teardownAudio();
    setState("idle");
  }, [teardownAudio]);

  // Stop any playback when the component unmounts.
  useEffect(() => () => cancel(), [cancel]);

  const playNext = useCallback(() => {
    if (cancelledRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next) {
      isPlayingRef.current = false;
      // Only flip to idle once the stream has fully ended AND the queue is
      // empty — otherwise we're just waiting for the next sentence to land.
      if (streamEndedRef.current) {
        currentAudioRef.current = null;
        setState("idle");
      }
      return;
    }
    isPlayingRef.current = true;
    currentAudioRef.current = next;
    next.playbackRate = PLAYBACK_RATE;

    // Watchdog: if onended doesn't fire (Safari short-clip quirk), force advance.
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      playNext();
    };
    const onLoaded = () => {
      const expectedMs =
        ((next.duration || 0) * 1000) / PLAYBACK_RATE + 500;
      if (expectedMs > 0 && isFinite(expectedMs)) {
        setTimeout(advance, expectedMs);
      }
    };
    if (next.readyState >= 1) onLoaded();
    else next.addEventListener("loadedmetadata", onLoaded, { once: true });

    next.onended = advance;
    next.onerror = advance;
    next.play().catch(advance);
  }, []);

  // Synthesizes one sentence and enqueues it. Chained onto the previous
  // synthesis so two adjacent feed() calls produce audio in the order they
  // were called, not the order Kokoro happens to finish generating.
  //
  // The function is fire-and-forget from the caller's perspective — we just
  // update synthesisChainRef so the NEXT call waits on us.
  const enqueueSentence = useCallback(
    (sentence: string) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      synthesisChainRef.current = synthesisChainRef.current.then(async () => {
        if (cancelledRef.current) return;
        try {
          for await (const chunk of synthesizeStream(trimmed, lang, voiceId)) {
            if (cancelledRef.current) break;
            if (!chunk?.audio || chunk.audio.length === 0) continue;
            const wav = pcmToWavBlob(chunk.audio, chunk.samplingRate);
            const url = URL.createObjectURL(wav);
            objectUrlsRef.current.push(url);
            const el = new Audio(url);
            audioQueueRef.current.push(el);
            if (!isPlayingRef.current && !cancelledRef.current) {
              setState("playing");
              playNext();
            }
          }
        } catch (e) {
          console.error("[stream-tts] synth failed:", e);
        }
      });
    },
    [lang, voiceId, playNext]
  );

  // Convert LaTeX + markdown to natural spoken English. Crucially this CONVERTS
  // math (e.g. "$\sqrt{16}=4$" → "square root of 16 equals 4") instead of
  // stripping it — otherwise a math-only sentence would clean to empty string
  // and get silently dropped from the audio queue.
  const cleanForSpeech = (s: string) => latexToSpeech(s).replace(/\s+/g, " ").trim();

  // Find the index AFTER the last sentence-terminating punctuation in text.
  // Returns -1 if no boundary exists.
  const findLastBoundary = (text: string): number => {
    let lastIdx = -1;
    for (let i = 0; i < text.length - 1; i++) {
      const c = text[i];
      if ((c === "." || c === "!" || c === "?") && /\s/.test(text[i + 1])) {
        lastIdx = i + 1;
      }
    }
    return lastIdx;
  };

  const feed = useCallback(
    (fullTextSoFar: string) => {
      if (cancelledRef.current) return;
      latestTextRef.current = fullTextSoFar;
      const remainder = fullTextSoFar.slice(lastSpokenIndexRef.current);
      const boundary = findLastBoundary(remainder);
      if (boundary <= 0) return;
      const sentence = cleanForSpeech(remainder.slice(0, boundary));
      lastSpokenIndexRef.current += boundary;
      if (sentence.trim()) enqueueSentence(sentence);
    },
    [enqueueSentence]
  );

  const endStream = useCallback(() => {
    streamEndedRef.current = true;
    // Flush whatever's after the last sentence boundary (often the closing
    // sentence without trailing whitespace).
    const remainder = latestTextRef.current
      .slice(lastSpokenIndexRef.current)
      .trim();
    if (remainder) {
      const clean = cleanForSpeech(remainder);
      lastSpokenIndexRef.current = latestTextRef.current.length;
      if (clean) enqueueSentence(clean);
    }
    // If nothing ever queued or playback already finished, transition to idle.
    if (
      !isPlayingRef.current &&
      audioQueueRef.current.length === 0 &&
      !objectUrlsRef.current.length
    ) {
      setState("idle");
    }
  }, [enqueueSentence]);

  const start = useCallback(() => {
    // Reset state for a fresh response. cancelledRef is cleared LAST so any
    // in-flight playNext from a previous response doesn't sneak through.
    teardownAudio();
    lastSpokenIndexRef.current = 0;
    latestTextRef.current = "";
    streamEndedRef.current = false;
    cancelledRef.current = false;
    // Fresh synthesis chain — old chain may still be processing but it'll
    // see cancelledRef===true (it was just toggled by teardownAudio's call
    // path) and bail out without pushing audio.
    synthesisChainRef.current = Promise.resolve();
  }, [teardownAudio]);

  return { state, start, feed, endStream, cancel };
}
