"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { motion, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";
import { pickEncouragement } from "@/lib/encouragement";

/**
 * Number-line estimation widget. The student drags a marker along a
 * horizontal axis to mark where the `target` value lies between `min`
 * and `max`. Tolerance defaults to ~5% of the range.
 *
 * Subject-agnostic: math (place 7 between 0 and 10), science (room
 * temperature on a 0-100°C scale), history (year on a timeline).
 */
export default function NumberLine({
  prompt,
  min,
  max,
  target,
  unit,
  tolerance,
  onAnswer,
  onWrong,
}: {
  prompt?: string;
  min: number;
  max: number;
  target: number;
  unit?: string;
  tolerance?: number;
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState<"correct" | "wrong" | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const lastEncIdx = useRef<number | undefined>(undefined);
  const { playCorrect, playWrong } = useUiSounds();

  // Position of the marker (0..1 fraction of the track).
  const [pct, setPct] = useState<number>(0.5);
  const dragX = useMotionValue(0);

  const tol = tolerance ?? Math.max(1, (max - min) * 0.05);
  const labeledValue = min + pct * (max - min);
  const isClose = Math.abs(labeledValue - target) <= tol;

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

  const handleSubmit = () => {
    if (submitted === "correct") return;
    if (isClose) {
      setSubmitted("correct");
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
      setSubmitted("wrong");
      playWrong();
      hapticError();
      onWrong?.();
      const { line, index } = pickEncouragement("quiz", lastEncIdx.current);
      lastEncIdx.current = index;
      setEncouragement(line);
      setTimeout(() => setSubmitted(null), 700);
    }
  };

  // ─── Drag handling ───────────────────────────────────────────────────
  const onDrag = (_: unknown, info: { point: { x: number } }) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (info.point.x - rect.left) / rect.width));
    setPct(fraction);
    dragX.set(fraction * rect.width);
  };

  // Static tick positions for visual context (5 evenly-spaced labels).
  const ticks = Array.from({ length: 5 }).map((_, i) => {
    const fraction = i / 4;
    return {
      fraction,
      value: min + fraction * (max - min),
    };
  });

  const fmt = (v: number) =>
    `${Number.isInteger(v) ? v : v.toFixed(1)}${unit ? unit : ""}`;

  // Translate marker position to use a CSS calc — keeps marker visually
  // pinned even when the parent resizes.
  const markerX = useTransform(() => `calc(${pct * 100}% - 14px)`);

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Place it on the line
      </p>
      <p className="text-base font-medium text-canvas-white mb-1">
        {prompt ?? `Drag the marker to ${fmt(target)}`}
      </p>
      <p className="text-xs text-ash-gray mb-5">
        Range: {fmt(min)} – {fmt(max)}
      </p>

      {/* Track + draggable marker */}
      <div className="relative pt-2 pb-9 mb-3">
        <div
          ref={trackRef}
          className="h-2 bg-iron rounded-full relative"
        >
          {/* Track fill up to the marker */}
          <motion.div
            className="absolute inset-y-0 left-0 bg-canvas-white/30 rounded-full"
            style={{ width: `${pct * 100}%` }}
          />
          {/* Target indicator — faint vertical line so the student can
              read whether they're roughly close after a wrong attempt. */}
          {submitted === "wrong" && (
            <span
              aria-hidden
              className="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 bg-rose-400"
              style={{ left: `calc(${((target - min) / (max - min)) * 100}% - 1px)` }}
            />
          )}
          {/* Ticks below */}
          <div className="absolute inset-x-0 top-full mt-1 flex justify-between text-[10px] text-ash-gray font-medium">
            {ticks.map((t, i) => (
              <span key={i} className="-translate-x-1/2 text-center" style={{ minWidth: 24 }}>
                {fmt(t.value)}
              </span>
            ))}
          </div>
        </div>
        {/* Marker */}
        <motion.button
          drag="x"
          dragMomentum={false}
          dragConstraints={trackRef}
          onDrag={onDrag}
          disabled={submitted === "correct"}
          aria-label="Marker"
          className={cn(
            "absolute top-0 w-7 h-7 rounded-full bg-canvas-white border-2 transition-colors cursor-grab active:cursor-grabbing shadow-md",
            submitted === "correct" && "border-emerald-400",
            submitted === "wrong" && "border-rose-400",
            !submitted && "border-canvas-white"
          )}
          style={{ x: markerX }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ash-gray">
          Your pick:{" "}
          <span className="font-semibold text-canvas-white">{fmt(labeledValue)}</span>
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitted === "correct"}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-opacity flex items-center gap-1.5",
            submitted === "correct"
              ? "bg-canvas-white text-void-black"
              : "bg-canvas-white hover:opacity-90 text-void-black"
          )}
        >
          {submitted === "correct" ? (
            <>
              <Check className="w-3.5 h-3.5" /> Right on
            </>
          ) : (
            "Check"
          )}
        </button>
      </div>
      {encouragement && submitted !== "correct" && (
        <p className="text-xs text-ash-gray mt-3">{encouragement}</p>
      )}
    </div>
  );
}
