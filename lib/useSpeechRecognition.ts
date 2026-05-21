"use client";

// React hook wrapping the browser's SpeechRecognition (Web Speech API).
// Returns a callback to start/stop recognition plus live interim + final
// transcripts. Browser-native, no API key, runs entirely on the user's device.
//
// Browser support: Chrome, Edge, Safari, Brave, Opera, mobile Chrome/Safari.
// Firefox doesn't ship with it enabled (requires an about:config flag), so
// `supported` will be false there — UI should hide the mic button.

import { useCallback, useEffect, useRef, useState } from "react";

// TypeScript doesn't include SpeechRecognition in lib.dom by default
// (it's a working-draft spec). Declare the surface we use.
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string; confidence: number };
    };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechRecognitionError =
  | "not-allowed" // user denied mic permission
  | "no-speech" // nothing detected during a listen window
  | "audio-capture" // no microphone available
  | "network" // network failed (browser uses cloud STT)
  | "aborted"
  | "unknown";

export interface UseSpeechRecognitionResult {
  /** True if the browser supports SpeechRecognition. */
  supported: boolean;
  /** True while actively listening. */
  isListening: boolean;
  /** Live transcript being built. Cleared when start() is called again. */
  transcript: string;
  /** Interim (not-yet-final) words shown in real time. Replaces on each utterance. */
  interimTranscript: string;
  /** Last error code if recognition failed. */
  error: SpeechRecognitionError | null;
  /** Start listening. Resolves a permission prompt the first time. */
  start: () => void;
  /** Stop listening. The current utterance is finalized. */
  stop: () => void;
  /** Manually clear the transcript without stopping. */
  reset: () => void;
}

export function useSpeechRecognition({
  lang = "en-US",
  /** When true, keeps listening even after pauses. Default: true. */
  continuous = true,
}: {
  lang?: string;
  continuous?: boolean;
}): UseSpeechRecognitionResult {
  const [supported, setSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<SpeechRecognitionError | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // We want to know if the user explicitly stopped, vs the browser auto-stopped.
  // Browsers (especially Safari) stop after ~60s of silence; if continuous, we
  // restart automatically. If the user clicked stop, we don't restart.
  const userStoppedRef = useRef(false);
  const langRef = useRef(lang);

  // Keep lang in a ref so the restart logic uses the latest value without
  // having to reinstantiate the recognition object.
  useEffect(() => {
    langRef.current = lang;
    if (recognitionRef.current) recognitionRef.current.lang = lang;
  }, [lang]);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const recognition = new Ctor();
    recognition.lang = langRef.current;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError(null);
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const t = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += t;
        } else {
          interim += t;
        }
      }
      if (finalChunk) {
        setTranscript((prev) => (prev ? prev + " " + finalChunk.trim() : finalChunk.trim()));
        setInterimTranscript("");
      } else if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event) => {
      const code = event.error as SpeechRecognitionError;
      // "no-speech" is benign — browser timed out without hearing anything.
      // Don't surface it as an error to the user.
      if (code !== "no-speech" && code !== "aborted") {
        setError(code || "unknown");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart in continuous mode if the user hasn't explicitly stopped.
      // This handles Safari's 60s silence timeout and similar quirks.
      if (continuous && !userStoppedRef.current) {
        try {
          recognition.start();
        } catch {
          // Already running, or microphone unavailable — fall through.
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      userStoppedRef.current = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [continuous]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    userStoppedRef.current = false;
    setError(null);
    setInterimTranscript("");
    setTranscript("");
    try {
      recognitionRef.current.start();
    } catch {
      // Already started, or microphone unavailable.
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    userStoppedRef.current = true;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    supported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
