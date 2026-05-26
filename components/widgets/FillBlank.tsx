"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";
import { pickEncouragement } from "@/lib/encouragement";

/**
 * Fill-in-the-blank widget — student types the missing word/number into
 * an inline input embedded in the sentence. Matches case-insensitively
 * against `answer` + any `alternatives`.
 *
 * Universal across subjects: vocabulary, history dates, science terms,
 * fact recall, plus math (8 × 7 = ___).
 */
export default function FillBlank({
  sentence,
  answer,
  alternatives,
  onAnswer,
  onWrong,
}: {
  sentence: string;
  answer: string;
  alternatives?: string[];
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<"correct" | "wrong" | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const lastEncIdx = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (!picked || !cardRef.current) return;
    if (picked === "correct") {
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
  }, [picked]);

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const acceptable = [answer, ...(alternatives ?? [])].map(normalize);

  const handleSubmit = () => {
    if (picked === "correct") return;
    if (!value.trim()) return;
    const ok = acceptable.includes(normalize(value));
    if (ok) {
      setPicked("correct");
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
      setPicked("wrong");
      playWrong();
      hapticError();
      onWrong?.();
      const { line, index } = pickEncouragement("quiz", lastEncIdx.current);
      lastEncIdx.current = index;
      setEncouragement(line);
      setTimeout(() => {
        setPicked(null);
        inputRef.current?.focus();
      }, 700);
    }
  };

  // Split sentence around the first ___ marker so we can place the input
  // inline. Falls back to "input below" if there's no marker.
  const idx = sentence.indexOf("___");
  const before = idx >= 0 ? sentence.slice(0, idx) : sentence;
  const after = idx >= 0 ? sentence.slice(idx + 3) : "";

  // Input width based on the longest acceptable answer so the visual gap
  // doesn't give away the length too sharply.
  const inputWidth = Math.max(
    6,
    Math.min(18, Math.max(answer.length, ...(alternatives ?? []).map((s) => s.length)) + 4)
  );

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-3">
        Fill in the blank
      </p>

      <div className="text-base font-medium text-canvas-white mb-4 leading-relaxed">
        <span>{before}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          disabled={picked === "correct"}
          aria-label="Your answer"
          className={cn(
            "inline-block mx-1 align-baseline bg-iron border-b-2 border-canvas-white px-2 py-1 rounded-sm text-canvas-white outline-none focus:bg-[#2e2e2e] transition-colors text-center",
            picked === "correct" && "border-emerald-400",
            picked === "wrong" && "border-rose-400"
          )}
          style={{ width: `${inputWidth}ch` }}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span>{after}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ash-gray min-h-[18px]">
          {picked === "correct"
            ? `Nice — "${answer}" is right.`
            : encouragement ?? "Type your answer and press Enter."}
        </p>
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || picked === "correct"}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-opacity flex items-center gap-1.5 shrink-0",
            picked === "correct"
              ? "bg-canvas-white text-void-black"
              : "bg-canvas-white hover:opacity-90 text-void-black disabled:bg-iron disabled:text-ash-gray"
          )}
        >
          {picked === "correct" ? (
            <>
              <Check className="w-3.5 h-3.5" /> Correct
            </>
          ) : (
            "Check"
          )}
        </button>
      </div>
    </div>
  );
}
