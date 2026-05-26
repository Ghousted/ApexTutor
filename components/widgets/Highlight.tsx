"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";

/**
 * Highlight-the-word widget — tokenises a passage by word and lets the
 * student tap individual words. The check passes when the set of tapped
 * words matches `targets` (case + punctuation insensitive).
 *
 * Use cases: identify all the verbs, tap every adjective, find the
 * misspellings, mark the dates in a paragraph.
 */
export default function Highlight({
  prompt,
  passage,
  targets,
  onAnswer,
  onWrong,
}: {
  prompt?: string;
  passage: string;
  targets: string[];
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState<"correct" | "wrong" | null>(null);
  const { playCorrect, playWrong } = useUiSounds();

  // Tokenise into words, preserving the surrounding whitespace + punctuation
  // so the passage renders normally. Each "word" token carries its index
  // (used as a hit-target identifier) and a normalized form (used for the
  // targets comparison).
  const tokens = useMemo(() => parseTokens(passage), [passage]);
  const targetSet = useMemo(
    () => new Set(targets.map((t) => normalize(t))),
    [targets]
  );

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

  const toggle = (i: number) => {
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
    // Build the set of normalized words the student picked.
    const picked = new Set(
      [...selected]
        .map((i) => tokens[i])
        .filter((t) => t.kind === "word")
        .map((t) => normalize(t.text))
    );
    const allCorrect =
      picked.size === targetSet.size && [...picked].every((p) => targetSet.has(p));

    if (allCorrect) {
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
      setTimeout(() => setSubmitted(null), 800);
    }
  };

  // Per-token classification AFTER submit so the student can see what they
  // got right vs wrong (correct → green outline, wrong picks → red).
  const isWord = (i: number) => tokens[i]?.kind === "word";

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Tap the words
      </p>
      <p className="text-sm text-canvas-white mb-4">
        {prompt ?? "Tap every word that fits the rule."}
      </p>

      <div className="text-base leading-loose text-canvas-white/90 mb-5">
        {tokens.map((t, i) => {
          if (t.kind !== "word") {
            return <span key={i}>{t.text}</span>;
          }
          const picked = selected.has(i);
          const isTarget = targetSet.has(normalize(t.text));
          const showResult = submitted !== null;
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              disabled={submitted === "correct"}
              className={cn(
                "inline-block px-1 -mx-0.5 rounded transition-colors",
                !showResult && picked && "bg-canvas-white text-void-black",
                !showResult && !picked && "hover:bg-iron",
                showResult && picked && isTarget && "bg-emerald-400 text-void-black",
                showResult && picked && !isTarget && "bg-rose-400 text-void-black",
                showResult && !picked && isTarget && "underline decoration-emerald-400 decoration-2"
              )}
            >
              {t.text}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ash-gray">
          {submitted === "wrong"
            ? "Not quite — keep going."
            : `${[...selected].filter(isWord).length} word${
                [...selected].filter(isWord).length === 1 ? "" : "s"
              } picked`}
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
                <Check className="w-3.5 h-3.5" /> Nailed it
              </>
            ) : (
              "Check"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type Token =
  | { kind: "word"; text: string }
  | { kind: "ws"; text: string };

function parseTokens(passage: string): Token[] {
  // Split on whitespace, keeping the delimiters. Punctuation stays attached
  // to the adjacent word — we strip it only for comparison via normalize().
  const result: Token[] = [];
  const re = /(\s+)/;
  const parts = passage.split(re);
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) {
      result.push({ kind: "ws", text: p });
    } else {
      result.push({ kind: "word", text: p });
    }
  }
  return result;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
