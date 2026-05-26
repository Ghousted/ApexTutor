"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Flame,
  HelpCircle,
  Keyboard,
  Lightbulb,
  Loader2,
  MessageCircle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/courses";
import { getInstructor } from "@/lib/instructors";
import { synthesize, pcmToWavBlob, isVoiceReady, prefetchVoice } from "@/lib/tts";
import { latexToSpeech } from "@/lib/latexToSpeech";
import {
  celebrateLessonComplete,
  celebrateSideBurst,
  celebrateCascade,
  celebrateFountain,
  celebrateFirstWin,
} from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { noteLessonCompleted } from "@/lib/dailyGoal";
import { hapticTap, hapticCelebrate } from "@/lib/haptics";
import { useCountUp } from "@/lib/useCountUp";
import AmbientParticles from "./AmbientParticles";
import SplitText from "./SplitText";
import MessageContent from "./MessageContent";
import CourseQAPanel from "./CourseQAPanel";
import TutorAvatar, { type TutorAvatarState } from "./TutorAvatar";
import LoadingDots from "./LoadingDots";
import QuizCard from "./widgets/QuizCard";
import FractionBar from "./widgets/FractionBar";
import MatchPairs from "./widgets/MatchPairs";
import SortSequence from "./widgets/SortSequence";
import TrueFalse from "./widgets/TrueFalse";
import FillBlank from "./widgets/FillBlank";
import NumberLine from "./widgets/NumberLine";
import Highlight from "./widgets/Highlight";
import ReadingPassage from "./widgets/ReadingPassage";
import TapLabel from "./widgets/TapLabel";
import PieDivider from "./widgets/PieDivider";
import BalanceScale from "./widgets/BalanceScale";
import LetterTiles from "./widgets/LetterTiles";

/**
 * Linear lesson player driven by a pre-authored `steps[]` array.
 *
 * Flow:
 *   1. Show step N (tutor avatar + script + widget if interactive).
 *   2. Wait for completion:
 *        - Passive steps (intro, explainer, checkpoint) — student clicks Continue.
 *        - Interactive steps (quiz, fraction-bar, match-pairs, sort-sequence) —
 *          must complete the widget first, then Continue appears.
 *   3. Advance to step N+1, slide animation.
 *   4. Last step done → notify parent (course-level completion).
 */
export default function CoursePlayer({
  courseId,
  lessonId,
  lessonTitle,
  lessonObjective,
  steps,
  instructorId,
  studentName,
  nextLessonId,
  initialStepIndex = 0,
  streak = 0,
  onStepAdvance,
  onLessonComplete,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  lessonObjective: string;
  steps: Step[];
  instructorId: string | null;
  studentName?: string | null;
  /** id of the next lesson in the same course, or null if this was the last. */
  nextLessonId: string | null;
  /** Step to resume on (e.g., from saved progress). Bounded by steps.length. */
  initialStepIndex?: number;
  /** Current consecutive-day completion streak — shown as a small chip. */
  streak?: number;
  /** Called whenever the active step index changes (for progress saving). */
  onStepAdvance?: (newIndex: number) => void;
  /** Called once the student finishes the last step. Parent can mark progress. */
  onLessonComplete?: () => void;
}) {
  const router = useRouter();
  const instructor = useMemo(
    () => getInstructor(instructorId) ?? null,
    [instructorId]
  );

  // Resume from saved progress; clamp to a valid index.
  const safeInitial = Math.max(
    0,
    Math.min(initialStepIndex, Math.max(steps.length - 1, 0))
  );
  const [stepIdx, setStepIdx] = useState(safeInitial);
  const [stepDone, setStepDone] = useState(false);
  const [lessonFinished, setLessonFinished] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  // Voice mode — on by default for the Synthesis-style audio-first feel.
  // Student can mute via the speaker icon in the header.
  const [voiceOn, setVoiceOn] = useState(true);
  const [voicePlaying, setVoicePlaying] = useState(false);
  // Browsers block autoplay across navigations — even when the prior page
  // had a user click. We gate the lesson behind a one-tap "Start" overlay
  // whose click event unlocks the AudioContext for the rest of the session.
  // After this is true, every subsequent step's voice plays automatically.
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  // Pre-lesson interstitial — shows on first mount with the lesson title,
  // objective, tutor avatar, and a single "Start" button. Dismissing it
  // also unlocks audio (the tap satisfies the autoplay gesture check).
  // Always shown, even when voice is muted, so the student gets a
  // proper "lesson is starting" beat.
  const [lessonStarted, setLessonStarted] = useState(false);
  // Tracks whether the Kokoro voice model is loaded. Used to show a small
  // "Voice loading…" pill in the header so the student knows the silence
  // is temporary, not broken. Non-blocking — the lesson stays interactive.
  const [voiceReady, setVoiceReady] = useState<boolean>(isVoiceReady());
  useEffect(() => {
    if (voiceReady) return;
    let cancelled = false;
    prefetchVoice().finally(() => {
      if (!cancelled) setVoiceReady(isVoiceReady());
    });
    return () => {
      cancelled = true;
    };
  }, [voiceReady]);

  // Briefly active when the student answers wrong — drives the tutor's
  // "encouraging" pose. Cleared by a timeout.
  const [isEncouraging, setIsEncouraging] = useState(false);
  const encouragingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerEncouraging = () => {
    if (encouragingTimerRef.current) clearTimeout(encouragingTimerRef.current);
    setIsEncouraging(true);
    encouragingTimerRef.current = setTimeout(() => setIsEncouraging(false), 2200);
  };
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastSpokenStepRef = useRef<number>(-1);
  const stageRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const total = steps.length;
  const step = steps[stepIdx];
  const progressPct = Math.round(((stepIdx + (stepDone ? 1 : 0)) / total) * 100);

  // Slide-in animation for the active step.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, x: 32 },
      { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }
    );
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: "opacity,x" });
    };
  }, [stepIdx]);

  // Animate progress bar to its current width.
  useEffect(() => {
    if (!progressBarRef.current) return;
    gsap.to(progressBarRef.current, {
      width: `${progressPct}%`,
      duration: 0.7,
      ease: "power2.out",
    });
  }, [progressPct]);

  // Track which step indices have been completed in this session so going
  // back to a previously-finished step keeps its "Continue" button visible.
  const completedStepsRef = useRef<Set<number>>(new Set());

  // Passive step types auto-mark stepDone so Continue is immediately available.
  // Interactive ones wait for the widget's onAnswer callback — unless the
  // student has already completed this step (e.g., via the back button).
  useEffect(() => {
    if (!step) return;
    const alreadyDone = completedStepsRef.current.has(stepIdx);
    setStepDone(
      alreadyDone ||
        step.type === "intro" ||
        step.type === "explainer" ||
        step.type === "checkpoint"
    );
  }, [step, stepIdx]);

  // Track "correct" momentum for surprise celebrations.
  const correctStreakRef = useRef(0);
  const hasHadFirstCorrectRef = useRef(false);
  const [streakChip, setStreakChip] = useState<string | null>(null);
  // Idle-hint state — fires after 25s on an interactive step that's still
  // incomplete. Resets every time the student does anything.
  const [showIdleHint, setShowIdleHint] = useState(false);
  // Open state for the keyboard shortcuts overlay (triggered by `?` key).
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Hint state — count + most-recent text. Capped at 2 hints per step so
  // the student can't farm the tutor into giving the answer outright.
  const [hintCountByStep, setHintCountByStep] = useState<Record<number, number>>({});
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // ─── Voice playback for the step script ──────────────────────────────
  const stopVoice = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setVoicePlaying(false);
  };

  // Auto-play the current step's script when it appears, if voice is on.
  // Guarded by lastSpokenStepRef so React Strict Mode's double-mount doesn't
  // synthesize twice. Also re-fires when the student toggles voice on.
  // Gated by lessonStarted — the pre-lesson interstitial holds playback
  // until the student taps "Start" (which also unlocks audio).
  useEffect(() => {
    if (!voiceOn || !audioUnlocked || !lessonStarted) {
      stopVoice();
      return;
    }
    if (!step || !instructor) return;
    if (lastSpokenStepRef.current === stepIdx) return;
    lastSpokenStepRef.current = stepIdx;

    // Compose the full narration for THIS step (script + question + options
     // + bullets etc.) so the voice actually reads the interactive content,
     // not just the lead-in script.
    const fullText = composeNarration(step, studentName);
    const cleaned = latexToSpeech(fullText).slice(0, 900);
    if (!cleaned.trim()) return;

    let cancelled = false;
    (async () => {
      stopVoice();
      try {
        setVoicePlaying(true);
        const { audio, samplingRate } = await synthesize(
          cleaned,
          "English",
          instructor.voiceId
        );
        if (cancelled) return;
        const wav = pcmToWavBlob(audio, samplingRate);
        const url = URL.createObjectURL(wav);
        objectUrlRef.current = url;
        const el = new Audio(url);
        el.playbackRate = 1.05;
        audioRef.current = el;
        el.onended = () => {
          stopVoice();
        };
        el.onerror = () => stopVoice();
        await el.play().catch(() => {
          // autoplay may be blocked on first load — silently fall through
          stopVoice();
        });
      } catch (e) {
        console.warn("[CoursePlayer voice] synth failed:", e);
        stopVoice();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, voiceOn, instructor?.voiceId, audioUnlocked, lessonStarted]);

  // Stop any lingering audio when the player unmounts.
  useEffect(() => () => stopVoice(), []);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────
  // Space: advance when ready; ←: previous step; M: mute/unmute voice;
  // 1-4: select quiz option N (broadcast via custom event); ?: shortcuts;
  // Esc: close overlays. Skipped while typing in inputs.
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      // Don't interfere with browser shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (qaOpen) setQaOpen(false);
        return;
      }
      if (e.key === " " || e.code === "Space") {
        if (stepDone && !lessonFinished) {
          e.preventDefault();
          handleAdvance();
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleStepBack();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (voiceOn) stopVoice();
        else {
          if (!audioUnlocked) handleStartLesson();
          lastSpokenStepRef.current = -1;
        }
        setVoiceOn((v) => !v);
        return;
      }
      // Quiz option selection 1-4 (broadcasts to QuizCard).
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        window.dispatchEvent(
          new CustomEvent("course-player:select-option", { detail: { index: idx } })
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepDone, lessonFinished, voiceOn, audioUnlocked, qaOpen, shortcutsOpen]);

  // ─── Idle hint ────────────────────────────────────────────────────────
  // Fires after 25s on an interactive step that's still incomplete.
  // Cancelled on any pointer/keyboard activity or when the step advances.
  useEffect(() => {
    setShowIdleHint(false);
    if (!step) return;
    const isInteractive =
      step.type === "quiz" ||
      step.type === "fraction-bar" ||
      step.type === "match-pairs" ||
      step.type === "sort-sequence" ||
      step.type === "true-false" ||
      step.type === "fill-blank" ||
      step.type === "number-line" ||
      step.type === "highlight" ||
      step.type === "reading-passage" ||
      step.type === "tap-label" ||
      step.type === "pie-divider" ||
      step.type === "balance-scale" ||
      step.type === "letter-tiles";
    if (!isInteractive || stepDone) return;

    let timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setShowIdleHint(true);
    }, 25000);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setShowIdleHint(true), 25000);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [step, stepIdx, stepDone]);

  const { playAdvance, playComplete } = useUiSounds();

  // One-tap audio unlock. Browsers block <audio>.play() unless the call
  // path traces back to a direct user gesture in the current document.
  // We play a tiny silent buffer synchronously inside the click handler
  // to satisfy that requirement; subsequent voice playback then works
  // even though it goes through async synthesize().
  const handleStartLesson = () => {
    // Always begin the lesson — even if audio was already unlocked from
    // a previous lesson in this session, the student still needs to
    // dismiss the interstitial.
    setLessonStarted(true);
    if (audioUnlocked) return;
    try {
      const silence = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
      );
      silence.volume = 0;
      silence.play().catch(() => {
        /* ignore — gesture itself is enough */
      });
    } catch {
      // ignore
    }
    setAudioUnlocked(true);
    lastSpokenStepRef.current = -1;
  };

  const handleAdvance = () => {
    completedStepsRef.current.add(stepIdx);
    if (stepIdx + 1 >= total) {
      setLessonFinished(true);
      playComplete();
      celebrateLessonComplete();
      hapticCelebrate();
      // Track session + daily counters so the dashboard / wrap-up card
      // both reflect the finish.
      if (typeof window !== "undefined") {
        try {
          const cur = Number(sessionStorage.getItem("session:lessonsDone") ?? "0");
          sessionStorage.setItem("session:lessonsDone", String(cur + 1));
        } catch {
          // ignore quota errors
        }
        noteLessonCompleted();
      }
      onLessonComplete?.();
      return;
    }
    const nextIdx = stepIdx + 1;
    setStepIdx(nextIdx);
    playAdvance();
    hapticTap();
    onStepAdvance?.(nextIdx);
  };

  /** Go back to the previous step. Doesn't reset stepDone for steps the
   *  student already finished — the Continue button is immediately
   *  available again. */
  const handleStepBack = () => {
    if (stepIdx === 0) return;
    setStepIdx((i) => Math.max(0, i - 1));
    setShowIdleHint(false);
  };

  /** Request a hint from the AI. Throttled to 2 hints per step. Shows the
   *  hint text briefly + speaks it via Kokoro so it feels like the tutor
   *  reached over to whisper. */
  const requestHint = async () => {
    if (hintLoading) return;
    const used = hintCountByStep[stepIdx] ?? 0;
    if (used >= 2) return;
    setHintLoading(true);
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepType: step?.type,
          lessonTitle,
          lessonObjective,
          stepContext: summarizeStep(step),
        }),
      });
      const data = (await res.json()) as { hint?: string };
      const hint = data.hint ?? "Try reading the prompt once more — slowly.";
      setHintText(hint);
      setHintCountByStep((prev) => ({ ...prev, [stepIdx]: used + 1 }));
      // Speak via Kokoro so the tutor's voice lands too — best effort.
      if (voiceOn && audioUnlocked && instructor) {
        try {
          const { audio, samplingRate } = await synthesize(
            hint,
            "English",
            instructor.voiceId
          );
          // Stop any current playback so the hint isn't talked over.
          stopVoice();
          const wav = pcmToWavBlob(audio, samplingRate);
          const url = URL.createObjectURL(wav);
          objectUrlRef.current = url;
          const el = new Audio(url);
          el.playbackRate = 1.05;
          audioRef.current = el;
          setVoicePlaying(true);
          el.onended = () => stopVoice();
          el.onerror = () => stopVoice();
          await el.play().catch(() => stopVoice());
        } catch {
          // ignore voice failures — the text is still visible
        }
      }
      // Auto-fade the bubble after 10s; student can re-tap for another.
      setTimeout(() => setHintText(null), 10000);
    } catch (e) {
      console.warn("[CoursePlayer hint] failed:", e);
    } finally {
      setHintLoading(false);
    }
  };

  /** Fired by QuizCard on every answer (right or wrong). Drives the
   *  "3 in a row" + "first correct of session" surprise moments. */
  const handleAnswerResult = (isCorrect: boolean) => {
    if (!isCorrect) {
      correctStreakRef.current = 0;
      return;
    }
    correctStreakRef.current += 1;
    if (!hasHadFirstCorrectRef.current) {
      hasHadFirstCorrectRef.current = true;
      setStreakChip("Nice — first one down!");
      celebrateFirstWin();
      setTimeout(() => setStreakChip(null), 2200);
      return;
    }
    if (correctStreakRef.current >= 3) {
      setStreakChip(`${correctStreakRef.current} in a row 🔥`);
      celebrateCascade();
      setTimeout(() => setStreakChip(null), 2200);
    }
  };

  const handleGoToNextLesson = () => {
    if (!nextLessonId) {
      router.push(`/courses/${courseId}`);
      return;
    }
    router.push(`/learn/${courseId}/${nextLessonId}`);
  };

  if (!step) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingDots size="lg" label="Loading lesson…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void-black flex flex-col inside-surface">
      {/* Header */}
      <header className="px-4 md:px-8 py-4 border-b border-[var(--border-subtle)] bg-void-black">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Link
            href={`/courses/${courseId}`}
            className="shrink-0 p-2 rounded-lg text-ash-gray hover:text-canvas-white hover:bg-coal transition-colors"
            aria-label="Back to course"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <button
            onClick={handleStepBack}
            disabled={stepIdx === 0}
            className="shrink-0 p-2 rounded-lg text-ash-gray hover:text-canvas-white hover:bg-coal transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous step"
            title="Previous step (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <p className="text-xs font-semibold text-canvas-white truncate">
                {lessonTitle}
              </p>
              <p className="text-[10px] font-medium text-ash-gray shrink-0">
                Step {stepIdx + 1} of {total}
              </p>
            </div>
            <div className="h-1 bg-iron rounded-full overflow-hidden">
              <div
                ref={progressBarRef}
                className="h-full bg-canvas-white"
                style={{ width: "0%" }}
              />
            </div>
          </div>
          {/* Right cluster — streak (subtle), voice, help */}
          {streak > 0 && <HeaderStreakChip streak={streak} />}
          <button
            onClick={() => {
              if (voiceOn) {
                stopVoice();
              } else {
                if (!audioUnlocked) handleStartLesson();
                lastSpokenStepRef.current = -1;
              }
              setVoiceOn((v) => !v);
            }}
            className={cn(
              "shrink-0 p-2 rounded-lg transition-colors relative",
              voiceOn
                ? "text-canvas-white hover:bg-coal"
                : "text-ash-gray hover:bg-coal"
            )}
            aria-label={voiceOn ? "Mute tutor voice" : "Unmute tutor voice"}
            title={voiceOn ? "Mute voice (M)" : "Unmute voice (M)"}
          >
            {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {voicePlaying && voiceOn && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-canvas-white animate-ping" />
            )}
          </button>
          <button
            onClick={() => setShortcutsOpen((v) => !v)}
            className="hidden sm:inline-flex shrink-0 p-2 rounded-lg text-ash-gray hover:text-canvas-white hover:bg-coal transition-colors"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Stage */}
      <main className="flex-1 px-4 md:px-8 py-6 md:py-10 flex flex-col items-center relative">
        {/* Pre-lesson interstitial — title, objective, tutor, big Start.
            Single tap dismisses + unlocks audio + begins the lesson. */}
        <AnimatePresence>
          {!lessonStarted && !lessonFinished && (
            <motion.div
              key="lesson-intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6 bg-void-black/85 backdrop-blur-md"
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 220,
                  damping: 22,
                  delay: 0.15,
                }}
                className="flex flex-col items-center text-center max-w-md"
              >
                <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-3">
                  Today&apos;s lesson · ~{Math.max(2, Math.round(total * 0.9))} min
                </p>
                <TutorAvatar
                  instructorId={instructor?.id ?? null}
                  state="idle"
                  size={96}
                  className="mb-5"
                />
                <h2
                  className="font-bold text-canvas-white mb-3 leading-tight"
                  style={{
                    fontSize: "clamp(24px, 4vw, 36px)",
                    letterSpacing: "-0.54px",
                  }}
                >
                  {lessonTitle}
                </h2>
                {lessonObjective && (
                  <p className="text-sm text-ash-gray mb-7 leading-relaxed max-w-prose">
                    {lessonObjective}
                  </p>
                )}
                <button
                  onClick={handleStartLesson}
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-canvas-white text-void-black rounded-lg font-semibold text-base shadow-md btn-shimmer tap-squish"
                >
                  <Volume2 className="w-4 h-4" />
                  Start lesson
                </button>
                <p className="text-[11px] text-ash-gray mt-4 max-w-[28ch]">
                  {voiceOn
                    ? "Your tutor will speak. Mute the voice anytime from the header."
                    : "Voice is muted. Tap the speaker icon to turn it on."}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {lessonFinished ? (
          <LessonCompleteCard
            instructorId={instructor?.id ?? null}
            instructorShortName={instructor?.shortName ?? "Your tutor"}
            instructorInitial={instructor?.avatarInitial ?? "T"}
            lessonTitle={lessonTitle}
            hasNextLesson={Boolean(nextLessonId)}
            onContinue={handleGoToNextLesson}
          />
        ) : (
          <div ref={stageRef} className="w-full max-w-2xl flex flex-col gap-6">
            {/* Tutor speech */}
            {instructor && (
              <div className="flex items-start gap-3">
                <TutorAvatar
                  instructorId={instructor.id}
                  state={avatarState(step.type, voicePlaying, isEncouraging)}
                  size={56}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-ash-gray font-semibold mb-1.5">
                    {instructor.name}
                  </p>
                  <div className="relative bg-coal border border-[var(--border-subtle)] rounded-[14px] px-4 py-3 text-canvas-white">
                    <div className="absolute -left-1.5 top-3 w-3 h-3 bg-coal border-l border-t border-[var(--border-subtle)] rotate-45" />
                    {hasScript(step) ? (
                      <MessageContent
                        text={renderScript(step.script ?? "", { studentName })}
                      />
                    ) : (
                      <p className="text-sm text-ash-gray italic">…</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Widget (interactive steps) or extra panel (explainer bullets).
                AnimatePresence makes the outgoing step slide left + fade while
                the new one slides in from the right — feels like the lesson
                turns a page instead of cutting between scenes. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`step-${stepIdx}`}
                initial={{ opacity: 0, x: 32, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -32, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 220, damping: 26 }}
              >
                <StepBody
                  step={step}
                  onComplete={() => setStepDone(true)}
                  onWrong={triggerEncouraging}
                  onAnswerResult={handleAnswerResult}
                />
              </motion.div>
            </AnimatePresence>

            {/* Hint button — always available on interactive steps, capped
                at 2 hints per step. Also surfaces the idle-hint suggestion
                when inactivity has been detected. */}
            {(step.type === "quiz" ||
              step.type === "fraction-bar" ||
              step.type === "match-pairs" ||
              step.type === "sort-sequence" ||
              step.type === "true-false" ||
              step.type === "fill-blank" ||
              step.type === "number-line" ||
              step.type === "highlight" ||
              step.type === "reading-passage" ||
              step.type === "tap-label" ||
              step.type === "pie-divider" ||
              step.type === "balance-scale" ||
              step.type === "letter-tiles") && !stepDone && (
              <div className="self-start flex flex-col gap-2">
                <button
                  onClick={requestHint}
                  disabled={hintLoading || (hintCountByStep[stepIdx] ?? 0) >= 2}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
                    showIdleHint
                      ? "bg-coal border-canvas-white text-canvas-white"
                      : "bg-coal border-[var(--border-subtle)] text-ash-gray hover:border-[var(--border-strong)] hover:text-canvas-white",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  aria-label="Get a hint from the tutor"
                >
                  {hintLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lightbulb className="w-3.5 h-3.5" />
                  )}
                  {hintLoading
                    ? "Asking your tutor…"
                    : (hintCountByStep[stepIdx] ?? 0) >= 2
                      ? "No more hints — give it a try"
                      : showIdleHint
                        ? "Stuck? Tap for a hint"
                        : `Need a hint?${
                            (hintCountByStep[stepIdx] ?? 0) > 0
                              ? ` (${2 - (hintCountByStep[stepIdx] ?? 0)} left)`
                              : ""
                          }`}
                </button>
                <AnimatePresence>
                  {hintText && (
                    <motion.div
                      key={hintText}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="bg-iron border border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm text-canvas-white max-w-[42ch]"
                    >
                      💡 {hintText}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Continue — springs in when the step becomes complete */}
            <AnimatePresence>
              {stepDone && (
                <motion.button
                  key="continue"
                  initial={{ opacity: 0, y: 14, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 380, damping: 24 }}
                  onClick={handleAdvance}
                  className="self-stretch px-5 py-3.5 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold flex items-center justify-center gap-2 shadow-md btn-shimmer tap-squish"
                >
                  {stepIdx + 1 >= total ? "Finish lesson" : "Continue"}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer: just the objective caption; the Q&A entry point is now the
          floating button below, which the student can spot from anywhere. */}
      <footer className="px-4 md:px-8 py-3 border-t border-[var(--border-subtle)] bg-void-black">
        <p className="max-w-3xl mx-auto text-[10px] text-ash-gray text-center truncate">
          {lessonObjective}
        </p>
      </footer>

      {/* ─── Floating Q&A button — persistent, hard to miss ─────────── */}
      {!lessonFinished && (
        <button
          onClick={() => setQaOpen(true)}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 px-4 py-3 bg-canvas-white text-void-black rounded-full shadow-md hover:opacity-90 transition-opacity font-medium text-sm"
          aria-label="Ask a question"
          title="Ask a question (?)"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Ask</span>
        </button>
      )}

      {/* ─── Surprise celebration chip (3-in-a-row, first correct) ──── */}
      <AnimatePresence>
        {streakChip && (
          <motion.div
            key="streak-chip"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-canvas-white text-void-black text-sm font-semibold shadow-md"
          >
            {streakChip}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Keyboard shortcuts overlay ─────────────────────────────── */}
      <AnimatePresence>
        {shortcutsOpen && (
          <motion.div
            key="shortcuts-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShortcutsOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-coal border border-[var(--border-strong)] rounded-[14px] p-6 w-full max-w-sm relative"
            >
              <button
                onClick={() => setShortcutsOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-md text-ash-gray hover:text-canvas-white hover:bg-iron"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-semibold text-canvas-white mb-4">
                Keyboard shortcuts
              </h3>
              <ul className="flex flex-col gap-2 text-sm">
                <ShortcutRow keyLabel="Space" label="Continue" />
                <ShortcutRow keyLabel="←" label="Previous step" />
                <ShortcutRow keyLabel="1-4" label="Pick a quiz option" />
                <ShortcutRow keyLabel="M" label="Mute / unmute voice" />
                <ShortcutRow keyLabel="?" label="Show this menu" />
                <ShortcutRow keyLabel="Esc" label="Close panels" />
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CourseQAPanel
        open={qaOpen}
        onClose={() => setQaOpen(false)}
        lessonTitle={lessonTitle}
        lessonObjective={lessonObjective}
        currentStepText={summarizeStep(step)}
        studentName={studentName}
      />
    </div>
  );
}

/** Streak chip with a counter animation when it changes mid-lesson
 *  (e.g., after the lesson-complete bump fires). */
function HeaderStreakChip({ streak }: { streak: number }) {
  const display = useCountUp(streak);
  return (
    <span
      className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-iron border border-[var(--border-subtle)] text-[10px] font-semibold text-canvas-white shrink-0"
      title={`${streak}-day streak`}
    >
      <Flame className="w-3 h-3" />
      {display}
    </span>
  );
}

/** Small row in the keyboard shortcuts overlay. */
function ShortcutRow({ keyLabel, label }: { keyLabel: string; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-ash-gray">{label}</span>
      <kbd className="px-2 py-0.5 rounded-md bg-iron border border-[var(--border-strong)] text-canvas-white text-xs font-mono">
        {keyLabel}
      </kbd>
    </li>
  );
}

/** Map current step + voice state to a TutorAvatar state. */
function avatarState(
  stepType: Step["type"],
  voicePlaying: boolean,
  isEncouraging: boolean
): TutorAvatarState {
  if (isEncouraging) return "encouraging";
  if (voicePlaying) return "talking";
  if (stepType === "checkpoint") return "celebrating";
  if (
    stepType === "quiz" ||
    stepType === "fraction-bar" ||
    stepType === "match-pairs" ||
    stepType === "sort-sequence" ||
    stepType === "true-false" ||
    stepType === "fill-blank" ||
    stepType === "number-line" ||
    stepType === "highlight" ||
    stepType === "reading-passage" ||
    stepType === "tap-label" ||
    stepType === "pie-divider" ||
    stepType === "balance-scale" ||
    stepType === "letter-tiles"
  ) {
    return "thinking";
  }
  return "idle";
}

function summarizeStep(step: Step | undefined): string {
  if (!step) return "";
  const parts: string[] = [`Step type: ${step.type}.`];
  if ("script" in step && step.script) parts.push(step.script);
  if (step.type === "quiz") parts.push(`Question: ${step.question}`);
  if (step.type === "fraction-bar") parts.push(`Target fraction: ${step.target}`);
  if (step.type === "match-pairs") {
    parts.push(`Pairs: ${step.pairs.map((p) => `${p.left}↔${p.right}`).join(", ")}`);
  }
  if (step.type === "sort-sequence") {
    parts.push(`Items in correct order: ${step.items.join(" → ")}`);
  }
  if (step.type === "true-false") {
    parts.push(`Statement: ${step.statement} · Correct: ${step.answer ? "true" : "false"}`);
  }
  if (step.type === "fill-blank") {
    parts.push(`Sentence: ${step.sentence} · Answer: ${step.answer}`);
  }
  if (step.type === "number-line") {
    parts.push(`Number line ${step.min}..${step.max}, target ${step.target}${step.unit ?? ""}`);
  }
  if (step.type === "highlight") {
    parts.push(`Passage: ${step.passage.slice(0, 200)} · Targets: ${step.targets.join(", ")}`);
  }
  if (step.type === "reading-passage") {
    parts.push(`Passage: ${step.passage.slice(0, 200)} · Question: ${step.question}`);
  }
  if (step.type === "tap-label") {
    parts.push(`Image labels: ${step.hotspots.map((h) => h.label).join(", ")}`);
  }
  if (step.type === "pie-divider") {
    parts.push(`Pie with ${step.slices} slices, select ${step.selectTarget}.`);
  }
  if (step.type === "balance-scale") {
    parts.push(
      `Left pan: ${step.leftFixed.map((x) => `${x.label}(${x.weight})`).join(", ")}. Need to match.`
    );
  }
  if (step.type === "letter-tiles") {
    parts.push(`Spell: ${step.word}`);
  }
  return parts.join(" ");
}

// ─── Step body — chooses the right widget or static layout ─────────────

function StepBody({
  step,
  onComplete,
  onWrong,
  onAnswerResult,
}: {
  step: Step;
  onComplete: () => void;
  onWrong?: () => void;
  /** Fires for every quiz answer (right or wrong). Used by the parent to
   *  drive surprise celebrations like "3 in a row". */
  onAnswerResult?: (isCorrect: boolean) => void;
}) {
  switch (step.type) {
    case "intro":
      // Already shown in speech bubble — no extra body needed.
      return null;

    case "explainer":
      return step.bullets && step.bullets.length > 0 ? (
        <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-5">
          <ul className="flex flex-col gap-2.5">
            {step.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-canvas-white/90">
                <span className="w-5 h-5 mt-0.5 rounded-md bg-iron border border-[var(--border-strong)] text-canvas-white text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null;

    case "true-false":
      return (
        <TrueFalse
          statement={step.statement}
          answer={step.answer}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "fill-blank":
      return (
        <FillBlank
          sentence={step.sentence}
          answer={step.answer}
          alternatives={step.alternatives}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "number-line":
      return (
        <NumberLine
          prompt={step.prompt}
          min={step.min}
          max={step.max}
          target={step.target}
          unit={step.unit}
          tolerance={step.tolerance}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "highlight":
      return (
        <Highlight
          prompt={step.prompt}
          passage={step.passage}
          targets={step.targets}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "reading-passage":
      return (
        <ReadingPassage
          passage={step.passage}
          question={step.question}
          options={step.options}
          correctKey={step.correctKey}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "tap-label":
      return (
        <TapLabel
          prompt={step.prompt}
          imageUrl={step.imageUrl}
          hotspots={step.hotspots}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "pie-divider":
      return (
        <PieDivider
          prompt={step.prompt}
          slices={step.slices}
          selectTarget={step.selectTarget}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "balance-scale":
      return (
        <BalanceScale
          prompt={step.prompt}
          leftFixed={step.leftFixed}
          options={step.options}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "letter-tiles":
      return (
        <LetterTiles
          prompt={step.prompt}
          word={step.word}
          decoys={step.decoys}
          onAnswer={(isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "checkpoint":
      return (
        <div className="bg-coal border border-[var(--border-subtle)] rounded-[14px] p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-canvas-white shrink-0" />
          <p className="text-sm text-canvas-white font-medium">
            Checkpoint passed. Keep going!
          </p>
        </div>
      );

    case "quiz":
      return (
        <QuizCard
          widget={{
            type: "quiz",
            question: step.question,
            options: step.options,
            correctKey: step.correctKey,
          }}
          onAnswer={(_label, isCorrect) => {
            onAnswerResult?.(isCorrect);
            onComplete();
          }}
          onWrong={() => {
            onAnswerResult?.(false);
            onWrong?.();
          }}
        />
      );

    case "fraction-bar":
      return (
        <FractionBar
          widget={{ type: "fraction-bar", value: step.target }}
          onAnswer={() => onComplete()}
        />
      );

    case "match-pairs":
      return (
        <MatchPairs
          widget={{
            type: "match-pairs",
            pairs: step.pairs,
            prompt: step.prompt,
          }}
          onAnswer={() => onComplete()}
        />
      );

    case "sort-sequence":
      return (
        <SortSequence
          widget={{
            type: "sort-sequence",
            items: step.items,
            prompt: step.prompt,
          }}
          onAnswer={() => onComplete()}
        />
      );
  }
}

function hasScript(step: Step): step is Extract<Step, { script: string | undefined }> {
  return "script" in step;
}

/** Build the full narration text for a step. The voice reads:
 *  - intro/checkpoint        → script only
 *  - explainer               → script + each bullet as a numbered list
 *  - quiz                    → script + "Here's the question..." + question +
 *                              each option ("A: option text")
 *  - fraction-bar            → script + "Try to make X out of Y"
 *  - match-pairs             → script + prompt
 *  - sort-sequence           → script + prompt + each item to sort
 *
 *  Each piece gets the {{studentName}} substitution. Returned string is
 *  passed through latexToSpeech() by the caller for math handling. */
function composeNarration(
  step: Step,
  studentName?: string | null
): string {
  const sub = (s: string) => renderScript(s ?? "", { studentName });
  const lines: string[] = [];

  if ("script" in step && step.script) {
    lines.push(sub(step.script));
  }

  switch (step.type) {
    case "explainer": {
      if (step.bullets && step.bullets.length > 0) {
        // Read bullets as "First, ... Second, ... Third, ..." for natural
        // listening flow. Falls back to numbers past three.
        const numberWord = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
        step.bullets.forEach((b, i) => {
          const prefix = numberWord[i] ?? `Number ${i + 1}`;
          lines.push(`${prefix}, ${sub(b)}`);
        });
      }
      break;
    }
    case "quiz": {
      const q = sub(step.question);
      if (q) lines.push(`Here's the question. ${q}`);
      step.options.forEach((opt) => {
        lines.push(`${opt.key}: ${sub(opt.label)}`);
      });
      break;
    }
    case "fraction-bar": {
      const m = step.target.match(/(\d+)\s*\/\s*(\d+)/);
      if (m) {
        lines.push(`Try to make ${m[1]} out of ${m[2]}.`);
      }
      break;
    }
    case "match-pairs": {
      if (step.prompt) lines.push(sub(step.prompt));
      break;
    }
    case "sort-sequence": {
      // Read the prompt only. We deliberately DON'T read out the items —
      // they're stored in correct order, so narrating them would hand the
      // student the answer.
      if (step.prompt) lines.push(sub(step.prompt));
      break;
    }
    case "true-false": {
      lines.push(`True or false — ${sub(step.statement)}`);
      break;
    }
    case "fill-blank": {
      // Read the sentence aloud but say "blank" in place of ___ so the
      // student knows where the gap is even without seeing the input.
      const spoken = step.sentence.replace(/_{3,}/g, " blank ");
      lines.push(`Fill in the blank. ${sub(spoken)}`);
      break;
    }
    case "number-line": {
      const fmt = (v: number) =>
        `${Number.isInteger(v) ? v : v.toFixed(1)}${step.unit ?? ""}`;
      lines.push(
        step.prompt
          ? sub(step.prompt)
          : `Place the marker at ${fmt(step.target)} on the line.`
      );
      lines.push(`The line runs from ${fmt(step.min)} to ${fmt(step.max)}.`);
      break;
    }
    case "highlight": {
      if (step.prompt) lines.push(sub(step.prompt));
      // We don't read the passage itself (could be long); the on-screen
      // text is the reading task. The script + prompt set up the activity.
      break;
    }
    case "reading-passage": {
      // Read the question — the passage is on-screen for the student to
      // read themselves. Reading it aloud would defeat the comprehension
      // exercise.
      lines.push(`Read the passage, then answer this. ${sub(step.question)}`);
      step.options.forEach((opt) => {
        lines.push(`${opt.key}: ${sub(opt.label)}`);
      });
      break;
    }
    case "tap-label": {
      if (step.prompt) lines.push(sub(step.prompt));
      else lines.push("Tap the right spot on the picture as the tutor asks.");
      break;
    }
    case "pie-divider": {
      if (step.prompt) lines.push(sub(step.prompt));
      else {
        lines.push(
          `The pizza is split into ${step.slices} equal slices. Tap ${step.selectTarget} of them.`
        );
      }
      break;
    }
    case "balance-scale": {
      if (step.prompt) lines.push(sub(step.prompt));
      else lines.push("Drag weights onto the right pan until both sides balance.");
      break;
    }
    case "letter-tiles": {
      if (step.prompt) lines.push(sub(step.prompt));
      else lines.push("Tap the letters in the right order to spell the word.");
      break;
    }
  }

  return lines.join(". ").replace(/\.+/g, ".");
}

/** Tiny template substitution — replaces {{studentName}} so authors can
 *  personalize scripts without coding. */
function renderScript(
  raw: string,
  vars: { studentName?: string | null }
): string {
  const name = vars.studentName?.trim();
  return raw
    .replace(/\{\{\s*studentName\s*\}\}/g, name || "friend")
    .replace(/\{\{[^}]+\}\}/g, ""); // strip any unknown vars
}

// ─── Lesson complete card ──────────────────────────────────────────────

function LessonCompleteCard({
  instructorId,
  instructorShortName,
  instructorInitial,
  lessonTitle,
  hasNextLesson,
  onContinue,
}: {
  instructorId: string | null;
  instructorShortName: string;
  instructorInitial: string;
  lessonTitle: string;
  hasNextLesson: boolean;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = ref.current;
    const check = checkRef.current;
    const tweens: gsap.core.Tween[] = [];
    if (wrap) {
      tweens.push(
        gsap.fromTo(
          wrap,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
        )
      );
    }
    if (check) {
      tweens.push(
        gsap.fromTo(
          check,
          { scale: 0, rotate: -180 },
          { scale: 1, rotate: 0, duration: 0.7, delay: 0.2, ease: "back.out(2)" }
        )
      );
    }
    return () => {
      tweens.forEach((t) => t.kill());
      if (wrap) gsap.set(wrap, { clearProps: "opacity,y" });
      if (check) gsap.set(check, { clearProps: "scale,rotate" });
    };
  }, []);

  return (
    <div
      ref={ref}
      className="w-full max-w-md text-center py-12 px-4 flex flex-col items-center"
    >
      {/* Course-complete is a bigger moment than lesson-complete — different
          badge, different copy, bigger avatar, sustained fountain. */}
      {!hasNextLesson && <CourseCompleteFlourish />}
      <div ref={checkRef} className="relative mb-6">
        {/* 2-second drift of white dots around the celebrating avatar. */}
        <AmbientParticles
          count={hasNextLesson ? 14 : 22}
          spreadRadius={hasNextLesson ? 1.4 : 2.2}
        />
        <TutorAvatar
          instructorId={instructorId}
          state="celebrating"
          size={hasNextLesson ? 96 : 120}
        />
      </div>
      <div className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3 text-[10px] uppercase tracking-wider font-semibold",
        hasNextLesson
          ? "text-ash-gray"
          : "bg-canvas-white text-void-black"
      )}>
        {hasNextLesson
          ? `Lesson complete · ${instructorInitial}`
          : "Course mastered"}
      </div>
      <SplitText
        as="h2"
        text={hasNextLesson ? lessonTitle : "You finished the course"}
        by="word"
        className="font-bold text-canvas-white mb-2 block"
        style={{
          fontSize: hasNextLesson
            ? "clamp(22px, 3vw, 32px)"
            : "clamp(28px, 4vw, 44px)",
          letterSpacing: "-0.48px",
          lineHeight: 1.2,
        }}
        staggerMs={50}
        delay={300}
      />
      <p className="text-sm text-ash-gray mb-6 max-w-prose">
        {hasNextLesson
          ? `${instructorShortName} thinks you crushed it.`
          : `${instructorShortName} is genuinely proud. Replay any lesson anytime — or pick a new course.`}
      </p>
      <SessionStat />
      <div className="h-6" />
      <button
        onClick={onContinue}
        className="w-full px-5 py-3 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold text-sm transition-opacity flex items-center justify-center gap-2 shadow-md btn-shimmer tap-squish"
      >
        {hasNextLesson ? "Next lesson" : "Back to course"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Small "session" stats row — shown under the lesson-complete copy. Reads
 *  the per-tab counter set when handleAdvance finishes a lesson. */
function SessionStat() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cur = Number(sessionStorage.getItem("session:lessonsDone") ?? "0");
      if (cur > 0) setCount(cur);
    } catch {
      // ignore
    }
  }, []);
  if (!count) return null;
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-iron border border-[var(--border-subtle)] text-xs text-canvas-white">
      <span className="text-canvas-white font-semibold">{count}</span>
      <span className="text-ash-gray">
        lesson{count === 1 ? "" : "s"} this session
      </span>
    </div>
  );
}

/** Fires a second confetti burst ~600ms after the card mounts, so a course
 *  completion feels like a two-wave celebration instead of one. Renders
 *  nothing visually itself — it just triggers the side effect. */
function CourseCompleteFlourish() {
  useEffect(() => {
    // Sustained fountain from the bottom edge — feels bigger than a lesson.
    const t = setTimeout(() => celebrateFountain(), 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}
