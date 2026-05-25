"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { QuizWidget } from "@/lib/widgetParser";

/**
 * Interactive multiple-choice card. Student taps an option, gets immediate
 * visual feedback (green check / red X), and the choice is reported up to
 * the chat so the AI sees it as the next user message.
 */
export default function QuizCard({
  widget,
  onAnswer,
}: {
  widget: QuizWidget;
  onAnswer: (label: string, isCorrect: boolean) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

  const handlePick = (key: string, label: string) => {
    if (picked !== null) return; // already answered
    setPicked(key);
    const isCorrect = key.toUpperCase() === widget.correctKey;
    // Wait a beat so the student sees the feedback before the AI responds.
    setTimeout(() => onAnswer(label, isCorrect), 900);
  };

  return (
    <div ref={cardRef} className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-3">
        Quick check
      </p>
      <p className="text-base font-medium text-ink mb-4 leading-relaxed">
        {widget.question}
      </p>

      <div className="flex flex-col gap-2">
        {widget.options.map((opt) => {
          const isPicked = picked === opt.key;
          const isCorrect = opt.key.toUpperCase() === widget.correctKey;
          const showResult = picked !== null;
          return (
            <button
              key={opt.key}
              onClick={() => handlePick(opt.key, opt.label)}
              disabled={picked !== null}
              className={cn(
                "text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-3",
                !showResult
                  ? "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer"
                  : isPicked && isCorrect
                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                    : isPicked && !isCorrect
                      ? "border-rose-400 bg-rose-50 text-rose-800"
                      : isCorrect
                        ? "border-emerald-300 bg-emerald-50/50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400"
              )}
            >
              <span
                className={cn(
                  "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold",
                  !showResult
                    ? "bg-slate-100 text-slate-500"
                    : isPicked && isCorrect
                      ? "bg-emerald-500 text-white"
                      : isPicked && !isCorrect
                        ? "bg-rose-500 text-white"
                        : isCorrect
                          ? "bg-emerald-300 text-white"
                          : "bg-slate-100 text-slate-400"
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

      {picked !== null && (
        <p
          className={cn(
            "text-xs mt-4 text-center",
            picked.toUpperCase() === widget.correctKey
              ? "text-emerald-600 font-medium"
              : "text-slate-500"
          )}
        >
          {picked.toUpperCase() === widget.correctKey
            ? "Great answer!"
            : "Let's see what your tutor says..."}
        </p>
      )}
    </div>
  );
}
