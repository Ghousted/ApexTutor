"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { FractionBarWidget } from "@/lib/widgetParser";

/**
 * Interactive fraction-bar board. The widget says "make 3/4" — the student
 * clicks cells until the right number is filled. GSAP animates each fill so
 * it feels satisfying.
 */
export default function FractionBar({
  widget,
  onAnswer,
}: {
  widget: FractionBarWidget;
  onAnswer: (filled: number, total: number, isCorrect: boolean) => void;
}) {
  const [num, denom] = parseFraction(widget.value);
  const cardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Student-controlled fill count.
  const [filled, setFilled] = useState<boolean[]>(
    Array.from({ length: denom }, () => false)
  );
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.4)" }
    );
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: "opacity,y" });
    };
  }, []);

  const toggle = (i: number) => {
    if (submitted) return;
    setFilled((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
    // Pop animation on the toggled cell.
    const el = cellRefs.current[i];
    if (el) {
      gsap.fromTo(
        el,
        { scale: 0.85 },
        { scale: 1, duration: 0.3, ease: "back.out(2)" }
      );
    }
  };

  const filledCount = filled.filter(Boolean).length;
  const isCorrect = filledCount === num;

  const handleCheck = () => {
    if (submitted) return;
    setSubmitted(true);
    if (!cardRef.current) return;
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
    setTimeout(() => onAnswer(filledCount, denom, isCorrect), 900);
  };

  return (
    <div ref={cardRef} className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-2">
        Visual practice
      </p>
      <p className="text-base font-medium text-ink mb-4">
        Make{" "}
        <span className="font-bold text-indigo-600">
          {num}/{denom}
        </span>{" "}
        by clicking cells.
      </p>

      <div className="flex w-full rounded-xl overflow-hidden border-2 border-slate-200 mb-4">
        {filled.map((isFilled, i) => (
          <button
            key={i}
            ref={(el) => {
              cellRefs.current[i] = el;
            }}
            onClick={() => toggle(i)}
            disabled={submitted}
            aria-label={`Cell ${i + 1}`}
            className={cn(
              "flex-1 h-16 transition-colors border-r border-slate-200 last:border-r-0",
              isFilled
                ? "bg-indigo-500"
                : "bg-white hover:bg-indigo-50 cursor-pointer",
              submitted && !isCorrect && isFilled && "bg-rose-400",
              submitted && isCorrect && "bg-emerald-500"
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Filled:{" "}
          <span className="font-semibold text-ink">
            {filledCount}/{denom}
          </span>
        </p>
        <button
          onClick={handleCheck}
          disabled={submitted || filledCount === 0}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
            submitted
              ? isCorrect
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
              : "bg-ink hover:bg-slate-800 text-white disabled:bg-slate-200 disabled:text-slate-400"
          )}
        >
          {submitted ? (
            isCorrect ? (
              <>
                <Check className="w-3.5 h-3.5" /> Correct
              </>
            ) : (
              "Not quite"
            )
          ) : (
            "Check"
          )}
        </button>
      </div>
    </div>
  );
}

function parseFraction(s: string): [number, number] {
  const [a, b] = s.split("/").map((x) => parseInt(x.trim(), 10));
  return [
    Number.isFinite(a) ? a : 1,
    Number.isFinite(b) && b > 0 ? Math.min(b, 12) : 4,
  ];
}
