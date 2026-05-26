"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";
import { pickEncouragement } from "@/lib/encouragement";

/**
 * "Pizza" widget — a pie divided into N equal slices. The student taps
 * slices to "take" them. Used for fractions, division, and equal sharing.
 *
 *   slices=8, selectTarget=3 → "Show 3/8"
 *   slices=4, selectTarget=4 → "Eat the whole pizza"
 *
 * SVG paths per slice (pie-shaped arcs). Filled slices animate via Motion
 * scale-pop on tap. Check passes when selected count === selectTarget.
 */
export default function PieDivider({
  prompt,
  slices,
  selectTarget,
  onAnswer,
  onWrong,
}: {
  prompt?: string;
  slices: number;
  selectTarget: number;
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState<"correct" | "wrong" | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const lastEncIdx = useRef<number | undefined>(undefined);
  const { playCorrect, playWrong } = useUiSounds();

  // Card entrance animation (same pattern as our other widgets so the
  // entry feel is consistent across the lesson).
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

  // Build slice paths once per slice count. Each slice is a wedge from the
  // pie center to two points on the perimeter (one per cut line).
  const slicePaths = useMemo(() => {
    const cx = 100;
    const cy = 100;
    const r = 90;
    return Array.from({ length: slices }).map((_, i) => {
      const a1 = (i / slices) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 1) / slices) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      // Always small-arc + clockwise since each slice is < 360°.
      const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
      return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    });
  }, [slices]);

  const toggleSlice = (i: number) => {
    if (submitted === "correct") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleCheck = () => {
    if (submitted === "correct") return;
    const ok = selected.size === selectTarget;
    if (ok) {
      setSubmitted("correct");
      playCorrect();
      hapticTap();
      const rect = cardRef.current?.getBoundingClientRect();
      celebrateBurst({
        x: (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) / window.innerWidth,
        y: (rect ? rect.top + rect.height / 2 : window.innerHeight / 2) / window.innerHeight,
      });
      setTimeout(() => onAnswer(true), 900);
    } else {
      setSubmitted("wrong");
      playWrong();
      hapticError();
      onWrong?.();
      const { line, index } = pickEncouragement("fraction-bar", lastEncIdx.current);
      lastEncIdx.current = index;
      setEncouragement(line);
      setTimeout(() => setSubmitted(null), 800);
    }
  };

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Pizza slice
      </p>
      <p className="text-base font-medium text-canvas-white mb-4 leading-relaxed">
        {prompt ?? `Tap ${selectTarget} out of ${slices} slices.`}
      </p>

      <div className="flex justify-center mb-4">
        <svg
          viewBox="0 0 200 200"
          className="w-56 h-56 sm:w-64 sm:h-64 select-none"
          aria-hidden
        >
          {/* Plate / pan circle behind the pizza for visual depth */}
          <circle
            cx={100}
            cy={100}
            r={94}
            fill="none"
            stroke="#2e2e2e"
            strokeWidth={2}
          />
          {/* Slice wedges. Selected ones fill with white, others stay iron. */}
          {slicePaths.map((d, i) => {
            const isSelected = selected.has(i);
            return (
              <motion.path
                key={i}
                d={d}
                stroke="#171717"
                strokeWidth={1.5}
                strokeLinejoin="round"
                onClick={() => toggleSlice(i)}
                whileTap={{ scale: 0.94 }}
                style={{ transformOrigin: "100px 100px", cursor: submitted === "correct" ? "default" : "pointer" }}
                animate={{
                  fill: isSelected ? "#ffffff" : "#262626",
                }}
                transition={{ duration: 0.2 }}
              />
            );
          })}
          {/* Center dot — purely decorative */}
          <circle cx={100} cy={100} r={3} fill="#171717" />
        </svg>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ash-gray">
          Selected:{" "}
          <span className="font-semibold text-canvas-white">
            {selected.size}/{slices}
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          {selected.size > 0 && submitted !== "correct" && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-2.5 py-1 rounded-md text-ash-gray hover:text-canvas-white hover:bg-iron transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleCheck}
            disabled={submitted === "correct" || selected.size === 0}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-opacity flex items-center gap-1.5",
              submitted === "correct"
                ? "bg-canvas-white text-void-black"
                : "bg-canvas-white hover:opacity-90 text-void-black disabled:bg-iron disabled:text-ash-gray"
            )}
          >
            {submitted === "correct" ? (
              <>
                <Check className="w-3.5 h-3.5" /> Perfect slice
              </>
            ) : (
              "Check"
            )}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {encouragement && submitted !== "correct" && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="text-xs text-ash-gray mt-3"
          >
            {encouragement}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
