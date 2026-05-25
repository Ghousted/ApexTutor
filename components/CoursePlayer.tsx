"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/courses";
import { getInstructor } from "@/lib/instructors";
import { synthesize, pcmToWavBlob } from "@/lib/tts";
import { latexToSpeech } from "@/lib/latexToSpeech";
import MessageContent from "./MessageContent";
import CourseQAPanel from "./CourseQAPanel";
import QuizCard from "./widgets/QuizCard";
import FractionBar from "./widgets/FractionBar";
import MatchPairs from "./widgets/MatchPairs";
import SortSequence from "./widgets/SortSequence";

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

  // Passive step types auto-mark stepDone so Continue is immediately available.
  // Interactive ones wait for the widget's onAnswer callback.
  useEffect(() => {
    if (!step) return;
    setStepDone(
      step.type === "intro" ||
        step.type === "explainer" ||
        step.type === "checkpoint"
    );
  }, [step]);

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
  useEffect(() => {
    if (!voiceOn) {
      stopVoice();
      return;
    }
    if (!step || !instructor) return;
    if (lastSpokenStepRef.current === stepIdx) return;
    lastSpokenStepRef.current = stepIdx;

    const scriptText = hasScript(step) ? (step.script ?? "") : "";
    const cleaned = latexToSpeech(
      renderScript(scriptText, { studentName })
    ).slice(0, 700);
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
  }, [stepIdx, voiceOn, instructor?.voiceId]);

  // Stop any lingering audio when the player unmounts.
  useEffect(() => () => stopVoice(), []);

  const handleAdvance = () => {
    if (stepIdx + 1 >= total) {
      setLessonFinished(true);
      onLessonComplete?.();
      return;
    }
    const nextIdx = stepIdx + 1;
    setStepIdx(nextIdx);
    onStepAdvance?.(nextIdx);
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
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fef8f3] via-white to-white flex flex-col">
      {/* Header */}
      <header className="px-4 md:px-8 py-4 border-b border-slate-100">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href={`/courses/${courseId}`}
            className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-100 transition-colors"
            aria-label="Back to course"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <button
            onClick={() => {
              if (voiceOn) stopVoice();
              setVoiceOn((v) => !v);
              // Allow re-speaking the current step when re-enabling voice.
              if (!voiceOn) lastSpokenStepRef.current = -1;
            }}
            className={cn(
              "shrink-0 p-2 rounded-lg transition-colors relative",
              voiceOn
                ? "text-indigo-600 hover:bg-indigo-50"
                : "text-slate-400 hover:bg-slate-100"
            )}
            aria-label={voiceOn ? "Mute tutor voice" : "Unmute tutor voice"}
            title={voiceOn ? "Voice on" : "Voice muted"}
          >
            {voiceOn ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            {voicePlaying && voiceOn && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-700 truncate">
                {lessonTitle}
              </p>
              <p className="text-[10px] font-medium text-slate-400 shrink-0">
                Step {stepIdx + 1} of {total}
              </p>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                ref={progressBarRef}
                className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                style={{ width: "0%" }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Stage */}
      <main className="flex-1 px-4 md:px-8 py-6 md:py-10 flex flex-col items-center">
        {lessonFinished ? (
          <LessonCompleteCard
            instructorShortName={instructor?.shortName ?? "Your tutor"}
            instructorAccentColor={instructor?.accentColor ?? "#6366F1"}
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
                <div
                  className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white text-lg md:text-xl font-bold shadow-md shrink-0"
                  style={{ background: instructor.accentColor }}
                >
                  {instructor.avatarInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                    {instructor.name}
                  </p>
                  <div className="relative bg-[#fef0e1] border border-orange-100 rounded-2xl px-4 py-3">
                    <div className="absolute -left-1.5 top-3 w-3 h-3 bg-[#fef0e1] border-l border-t border-orange-100 rotate-45" />
                    {hasScript(step) ? (
                      <MessageContent
                        text={renderScript(step.script ?? "", { studentName })}
                      />
                    ) : (
                      <p className="text-sm text-slate-400 italic">…</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Widget (interactive steps) or extra panel (explainer bullets) */}
            <StepBody
              key={`step-${stepIdx}`}
              step={step}
              onComplete={() => setStepDone(true)}
            />

            {/* Continue */}
            {stepDone && (
              <button
                onClick={handleAdvance}
                className="self-stretch px-5 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
              >
                {stepIdx + 1 >= total ? "Finish lesson" : "Continue"}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </main>

      <footer className="px-4 md:px-8 py-3 border-t border-slate-100 bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => setQaOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Ask a question
          </button>
          <p className="text-[10px] text-slate-400 truncate">
            {lessonObjective}
          </p>
        </div>
      </footer>

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
  return parts.join(" ");
}

// ─── Step body — chooses the right widget or static layout ─────────────

function StepBody({
  step,
  onComplete,
}: {
  step: Step;
  onComplete: () => void;
}) {
  switch (step.type) {
    case "intro":
      // Already shown in speech bubble — no extra body needed.
      return null;

    case "explainer":
      return step.bullets && step.bullets.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <ul className="flex flex-col gap-2">
            {step.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="w-5 h-5 mt-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null;

    case "checkpoint":
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
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
          onAnswer={() => onComplete()}
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
  instructorShortName,
  instructorAccentColor,
  instructorInitial,
  lessonTitle,
  hasNextLesson,
  onContinue,
}: {
  instructorShortName: string;
  instructorAccentColor: string;
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
      className="w-full max-w-md text-center py-8 px-4 flex flex-col items-center"
    >
      <div
        ref={checkRef}
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-lg"
        style={{ background: instructorAccentColor }}
      >
        <CheckCircle2 className="w-10 h-10 text-white" />
      </div>
      <p
        className="text-[10px] uppercase tracking-wider font-semibold mb-1"
        style={{ color: instructorAccentColor }}
      >
        Lesson complete · {instructorInitial}
      </p>
      <h2 className="text-2xl font-bold text-ink mb-2">{lessonTitle}</h2>
      <p className="text-sm text-slate-500 mb-6">
        {instructorShortName} thinks you crushed it.
      </p>
      <button
        onClick={onContinue}
        className="w-full px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        {hasNextLesson ? "Next lesson" : "Back to course"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
