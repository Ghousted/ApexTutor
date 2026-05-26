"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";
import { pickEncouragement } from "@/lib/encouragement";

/**
 * Reading-passage widget — a longer text block with a single follow-up
 * question + multi-choice answer. Built for reading comprehension across
 * subjects (history events, science articles, story excerpts).
 *
 * Treated as one "step" so the script + passage + question + check all
 * stay together; otherwise an author would have to chain explainer →
 * quiz manually and the player can't show them as a unit.
 */
export default function ReadingPassage({
  passage,
  question,
  options,
  correctKey,
  onAnswer,
  onWrong,
}: {
  passage: string;
  question: string;
  options: Array<{ key: string; label: string }>;
  correctKey: string;
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const lastEncIdx = useRef<number | undefined>(undefined);
  const { playCorrect, playWrong } = useUiSounds();

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
      gsap.set(el, { clearProps: "opacity,y,scale" });
    };
  }, []);

  const handlePick = (key: string) => {
    if (picked !== null) return;
    setPicked(key);
    const isCorrect = key.toUpperCase() === correctKey.toUpperCase();
    if (isCorrect) {
      playCorrect();
      hapticTap();
      const rect = cardRef.current?.getBoundingClientRect();
      celebrateBurst({
        x: (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) / window.innerWidth,
        y: (rect ? rect.top + rect.height / 2 : window.innerHeight / 2) / window.innerHeight,
      });
      setTimeout(() => onAnswer(true), 900);
    } else {
      playWrong();
      hapticError();
      onWrong?.();
      const { line, index } = pickEncouragement("quiz", lastEncIdx.current);
      lastEncIdx.current = index;
      setEncouragement(line);
      setTimeout(() => setPicked(null), 700);
    }
  };

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-3">
        Read carefully
      </p>
      {/* Passage — sized for comfortable reading, not a tiny script bubble. */}
      <div className="bg-iron border border-[var(--border-subtle)] rounded-[14px] p-4 mb-5 max-h-[44vh] overflow-y-auto">
        <p className="text-sm text-canvas-white/90 leading-relaxed whitespace-pre-wrap">
          {passage}
        </p>
      </div>

      <p className="text-base font-medium text-canvas-white mb-3 leading-relaxed">
        {question}
      </p>

      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const isPicked = picked === opt.key;
          const isCorrect = opt.key.toUpperCase() === correctKey.toUpperCase();
          const show = picked !== null;
          return (
            <button
              key={opt.key}
              onClick={() => handlePick(opt.key)}
              disabled={picked !== null}
              className={cn(
                "text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors flex items-center gap-3",
                !show
                  ? "border-[var(--border-subtle)] bg-iron text-canvas-white hover:border-canvas-white hover:bg-[#2e2e2e] cursor-pointer"
                  : isPicked && isCorrect
                    ? "border-emerald-400 bg-coal text-canvas-white"
                    : isPicked && !isCorrect
                      ? "border-rose-400 bg-coal text-canvas-white"
                      : isCorrect
                        ? "border-emerald-300/60 bg-coal text-canvas-white"
                        : "border-[var(--border-subtle)] bg-coal text-ash-gray"
              )}
            >
              <span className="w-6 h-6 shrink-0 rounded-full bg-iron border border-[var(--border-subtle)] text-canvas-white text-xs font-bold flex items-center justify-center">
                {opt.key}
              </span>
              <span className="flex-1">{opt.label}</span>
              {show && isPicked && isCorrect && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {picked === null && encouragement && (
        <p className="text-xs mt-3 text-ash-gray">{encouragement}</p>
      )}
    </div>
  );
}
