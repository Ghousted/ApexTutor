"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import gsap from "gsap";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";
import { pickEncouragement } from "@/lib/encouragement";

/**
 * Binary judgement widget — student taps True or False on a statement.
 * Faster than a 4-option quiz for yes/no facts. Same mistake-friendly
 * pattern as QuizCard: wrong taps shake + encouragement, re-tap allowed.
 */
export default function TrueFalse({
  statement,
  answer,
  onAnswer,
  onWrong,
}: {
  statement: string;
  answer: boolean;
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const lastEncIdx = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (picked === null || !cardRef.current) return;
    const correct = picked === answer;
    if (correct) {
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
  }, [picked, answer]);

  const handlePick = (choice: boolean) => {
    if (picked !== null) return;
    setPicked(choice);
    const isCorrect = choice === answer;
    if (isCorrect) {
      playCorrect();
      hapticTap();
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) {
        celebrateBurst({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        });
      } else {
        celebrateBurst();
      }
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

  const buttonClass = (kind: "true" | "false") => {
    const isPicked = picked === (kind === "true");
    const showResult = picked !== null;
    const isCorrectChoice = (kind === "true") === answer;
    return cn(
      "flex-1 px-5 py-6 rounded-[14px] border-2 text-base font-semibold transition-all flex items-center justify-center gap-2",
      !showResult
        ? "border-[var(--border-subtle)] bg-iron text-canvas-white hover:border-canvas-white hover:bg-[#2e2e2e] cursor-pointer"
        : isPicked && isCorrectChoice
          ? "border-emerald-400 bg-coal text-canvas-white"
          : isPicked && !isCorrectChoice
            ? "border-rose-400 bg-coal text-canvas-white"
            : isCorrectChoice
              ? "border-emerald-300/60 bg-coal text-canvas-white"
              : "border-[var(--border-subtle)] bg-coal text-ash-gray"
    );
  };

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-3">
        True or false
      </p>
      <p className="text-base font-medium text-canvas-white mb-5 leading-relaxed">
        {statement}
      </p>
      <div className="flex gap-3">
        <motion.button
          onClick={() => handlePick(true)}
          disabled={picked !== null}
          whileTap={{ scale: 0.96 }}
          className={buttonClass("true")}
        >
          <Check className="w-5 h-5" strokeWidth={2.5} />
          True
        </motion.button>
        <motion.button
          onClick={() => handlePick(false)}
          disabled={picked !== null}
          whileTap={{ scale: 0.96 }}
          className={buttonClass("false")}
        >
          <X className="w-5 h-5" strokeWidth={2.5} />
          False
        </motion.button>
      </div>
      {picked === null && encouragement && (
        <p className="text-xs mt-4 text-center text-ash-gray">{encouragement}</p>
      )}
      {picked !== null && picked === answer && (
        <p className="text-xs mt-4 text-center text-canvas-white font-medium">
          Right call.
        </p>
      )}
    </div>
  );
}
