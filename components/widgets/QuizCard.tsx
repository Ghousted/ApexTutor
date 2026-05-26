"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mic, XCircle } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { QuizWidget } from "@/lib/widgetParser";
import { celebrateBurst, celebrateSideBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";
import { pickEncouragement } from "@/lib/encouragement";
import {
  isVoiceInputSupported,
  startRecording,
  type ActiveRecording,
} from "@/lib/voiceInput";

/**
 * Interactive multiple-choice card. Student taps an option, gets immediate
 * visual feedback (green check / red X), and the choice is reported up to
 * the chat so the AI sees it as the next user message.
 */
export default function QuizCard({
  widget,
  onAnswer,
  onWrong,
}: {
  widget: QuizWidget;
  onAnswer: (label: string, isCorrect: boolean) => void;
  /** Optional — fires when the student picks a wrong option (Synthesis-style
   *  mistake-friendly: parent can trigger an encouraging tutor reaction). */
  onWrong?: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const lastEncouragementIdx = useRef<number | undefined>(undefined);
  const activeRecordingRef = useRef<ActiveRecording | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { playCorrect, playWrong } = useUiSounds();
  const voiceSupported = isVoiceInputSupported();

  // Listen for the player's "select option N" keyboard event (1-4 keys).
  // We snapshot widget.options + picked into a ref so the listener doesn't
  // need to be re-bound every render.
  const optsRef = useRef(widget.options);
  const pickedRef = useRef(picked);
  optsRef.current = widget.options;
  pickedRef.current = picked;
  useEffect(() => {
    const onSelect = (e: Event) => {
      if (pickedRef.current !== null) return;
      const detail = (e as CustomEvent<{ index: number }>).detail;
      const opt = optsRef.current[detail.index];
      if (!opt) return;
      handlePickRef.current?.(opt.key, opt.label);
    };
    window.addEventListener("course-player:select-option", onSelect);
    return () => window.removeEventListener("course-player:select-option", onSelect);
  }, []);
  // Hold a ref to the current handlePick so the keyboard listener always
  // calls the latest version without re-binding.
  const handlePickRef = useRef<((key: string, label: string) => void) | null>(null);

  // Entry animation — card pops in from below.
  //
  // NB: use gsap.fromTo (not gsap.from) and clean up explicitly. React's
  // Strict Mode mounts → unmounts → remounts in development; with gsap.from
  // the tween can get interrupted mid-flight and leave the element pinned
  // at opacity 0 — the "now I can't see the quiz" bug.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 24, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.4)" }
    );
    return () => {
      tween.kill();
      // Ensure final state is the natural one even if the tween was killed
      // mid-flight (Strict Mode unmount).
      gsap.set(el, { clearProps: "opacity,y,scale" });
    };
  }, []);

  // Reaction animation — success bounce or wrong-answer shake.
  useEffect(() => {
    if (!picked || !cardRef.current) return;
    const isCorrect = picked.toUpperCase() === widget.correctKey;
    if (isCorrect) {
      gsap.fromTo(
        cardRef.current,
        { scale: 1 },
        { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }
      );
    } else {
      gsap.fromTo(
        cardRef.current,
        { x: 0 },
        { x: 10, duration: 0.06, repeat: 5, yoyo: true, ease: "power1.inOut" }
      );
    }
  }, [picked, widget.correctKey]);

  /** Match a transcript against the option labels — returns the best option
   *  key, or null if nothing's close enough. Heuristic: option's first
   *  meaningful word appears in the transcript. Good enough for grade-school
   *  multi-choice (options are typically short and distinct). */
  const matchTranscript = (transcript: string): string | null => {
    const t = transcript.toLowerCase();
    if (!t) return null;
    // First pass: spoken key letter ("a", "b", "letter a", etc.)
    for (const opt of widget.options) {
      const k = opt.key.toLowerCase();
      // Anchor to a word boundary so "b" doesn't match "best".
      const keyRegex = new RegExp(`\\b${k}\\b`);
      if (keyRegex.test(t)) return opt.key;
    }
    // Second pass: longest matching option label.
    let best: { key: string; len: number } | null = null;
    for (const opt of widget.options) {
      const label = opt.label.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      if (!label) continue;
      // Match if any of the label's significant words (>2 chars) appears.
      const words = label.split(/\s+/).filter((w) => w.length > 2);
      const hit = words.find((w) => t.includes(w));
      if (hit && (!best || hit.length > best.len)) {
        best = { key: opt.key, len: hit.length };
      }
    }
    return best?.key ?? null;
  };

  const handleMicDown = async () => {
    if (picked !== null || recording) return;
    setVoiceError(null);
    try {
      const rec = await startRecording();
      activeRecordingRef.current = rec;
      setRecording(true);
    } catch (e) {
      setVoiceError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Microphone access blocked."
          : "Couldn't start the mic."
      );
    }
  };

  const handleMicUp = async () => {
    const rec = activeRecordingRef.current;
    activeRecordingRef.current = null;
    if (!rec) return;
    try {
      const transcript = await rec.stopAndTranscribe();
      setRecording(false);
      const key = matchTranscript(transcript);
      if (key) {
        const opt = widget.options.find((o) => o.key === key);
        if (opt) handlePick(opt.key, opt.label);
      } else {
        setVoiceError(`Heard: "${transcript || "(silence)"}" — try again or tap.`);
      }
    } catch (e) {
      setRecording(false);
      setVoiceError(e instanceof Error ? e.message : "Transcription failed.");
    }
  };

  const handlePick: (key: string, label: string) => void = (key, label) => {
    if (picked !== null) return;
    setPicked(key);
    const isCorrect = key.toUpperCase() === widget.correctKey;
    if (isCorrect) {
      playCorrect();
      hapticTap();
      // Side-burst FROM the option that was tapped — feels like the cheer
      // is reacting to the student's specific choice, not the whole card.
      const tapEl = document.querySelector<HTMLElement>(
        `[data-quiz-opt="${key}"]`
      );
      const rect = (tapEl ?? cardRef.current)?.getBoundingClientRect();
      if (rect) {
        celebrateSideBurst({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        });
      } else {
        celebrateBurst();
      }
      setTimeout(() => onAnswer(label, true), 900);
    } else {
      playWrong();
      hapticError();
      onWrong?.();
      const { line, index } = pickEncouragement(
        "quiz",
        lastEncouragementIdx.current
      );
      lastEncouragementIdx.current = index;
      setEncouragement(line);
      // Re-enable the choices after the shake so the student can retry.
      setTimeout(() => setPicked(null), 700);
    }
  };
  // Keep the ref in sync with the latest closure.
  handlePickRef.current = handlePick;

  const pickedOption = picked
    ? widget.options.find((o) => o.key === picked) ?? null
    : null;

  return (
    <div ref={cardRef} className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider">
          Quick check
        </p>
        {voiceSupported && picked === null && (
          <button
            onMouseDown={handleMicDown}
            onMouseUp={handleMicUp}
            onMouseLeave={() => {
              if (recording) handleMicUp();
            }}
            onTouchStart={handleMicDown}
            onTouchEnd={handleMicUp}
            disabled={recording}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors select-none",
              recording
                ? "bg-canvas-white text-void-black animate-pulse"
                : "bg-iron text-ash-gray hover:text-canvas-white hover:bg-[#2e2e2e]"
            )}
            title="Hold to answer with your voice"
          >
            <Mic className="w-3 h-3" />
            {recording ? "Listening…" : "Answer with voice"}
          </button>
        )}
      </div>
      <p className="text-base font-medium text-canvas-white mb-4 leading-relaxed">
        {widget.question}
      </p>
      {voiceError && (
        <p className="text-[11px] text-ash-gray mb-3 italic">{voiceError}</p>
      )}

      <div className="flex flex-col gap-2">
        {widget.options.map((opt) => {
          const isPicked = picked === opt.key;
          const isCorrect = opt.key.toUpperCase() === widget.correctKey;
          const showResult = picked !== null;
          return (
            <button
              key={opt.key}
              data-quiz-opt={opt.key}
              onClick={() => handlePick(opt.key, opt.label)}
              disabled={picked !== null}
              className={cn(
                "text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-3",
                !showResult
                  ? "border-[var(--border-subtle)] bg-coal hover:border-[var(--border-strong)] hover:bg-iron cursor-pointer"
                  : isPicked && isCorrect
                    ? "border-emerald-400 bg-coal text-canvas-white"
                    : isPicked && !isCorrect
                      ? "border-rose-400 bg-coal text-rose-800"
                      : isCorrect
                        ? "border-emerald-300 bg-coal/50 text-canvas-white"
                        : "border-[var(--border-subtle)] bg-coal text-ash-gray"
              )}
            >
              <span
                className={cn(
                  "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold",
                  !showResult
                    ? "bg-iron text-ash-gray"
                    : isPicked && isCorrect
                      ? "bg-canvas-white text-void-black"
                      : isPicked && !isCorrect
                        ? "bg-canvas-white text-void-black"
                        : isCorrect
                          ? "bg-canvas-white text-void-black"
                          : "bg-iron text-ash-gray"
                )}
              >
                {showResult && isPicked
                  ? isCorrect
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <XCircle className="w-4 h-4" />
                  : opt.key}
              </span>
              <span className="flex-1">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {picked !== null && picked.toUpperCase() === widget.correctKey && (
        <div className="mt-4 text-center">
          <p className="text-xs text-canvas-white font-medium mb-1">
            Great answer!
          </p>
          <p className="text-[11px] text-ash-gray max-w-[42ch] mx-auto leading-relaxed">
            {pickedOption?.label && `You chose: ${pickedOption.label}.`}{" "}
            That&apos;s the right pick — moving on.
          </p>
        </div>
      )}
      {picked === null && encouragement && (
        <p className="text-xs mt-4 text-center text-ash-gray">
          {encouragement}
        </p>
      )}
    </div>
  );
}
