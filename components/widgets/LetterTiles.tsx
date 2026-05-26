"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";

/**
 * Letter-tile spelling widget. Student taps letter tiles to build the
 * target word into a row of slots. The pool is the target's letters plus
 * any author-provided decoys, shuffled.
 *
 *   word = "NUCLEUS"  → 7 slots; pool has N U C L E U S + decoys
 *
 * Used for spelling, phonics, scientific terms, vocabulary. We compare
 * case-insensitive against the target word.
 */
export default function LetterTiles({
  prompt,
  word,
  decoys,
  onAnswer,
  onWrong,
}: {
  prompt?: string;
  word: string;
  decoys?: string[];
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const target = useMemo(() => word.toUpperCase().replace(/[^A-Z]/g, ""), [word]);
  const slotCount = target.length;

  // Tile pool — target letters + decoys, shuffled. Each tile is identified
  // by an index so duplicates work (NUCLEUS has two Us).
  const pool = useMemo(() => {
    const letters = [
      ...target.split(""),
      ...(decoys ?? []).map((d) => d.toUpperCase().slice(0, 1)).filter((s) => /[A-Z]/.test(s)),
    ];
    // Fisher-Yates shuffle.
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.map((letter, idx) => ({ id: `${idx}`, letter }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, (decoys ?? []).join("|")]);

  // placed[i] = tile id placed in slot i, or null. used[tileId] = true if
  // that tile is currently committed somewhere.
  const [placed, setPlaced] = useState<(string | null)[]>(
    () => Array(slotCount).fill(null)
  );
  const usedTiles = useMemo(() => new Set(placed.filter(Boolean) as string[]), [placed]);
  const [submitted, setSubmitted] = useState<"correct" | "wrong" | null>(null);
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

  /** Tap a pool tile — places it in the first empty slot. */
  const placeTile = (tileId: string) => {
    if (submitted === "correct" || usedTiles.has(tileId)) return;
    const firstEmpty = placed.findIndex((p) => p === null);
    if (firstEmpty === -1) return;
    setPlaced((prev) => {
      const next = [...prev];
      next[firstEmpty] = tileId;
      return next;
    });
  };

  /** Tap a filled slot — removes that letter back to the pool. */
  const clearSlot = (slotIdx: number) => {
    if (submitted === "correct") return;
    setPlaced((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const builtWord = placed
    .map((id) => (id ? pool.find((t) => t.id === id)?.letter ?? "" : "_"))
    .join("");
  const allPlaced = placed.every((p) => p !== null);

  // Auto-check when every slot is filled — feels game-like, no extra button
  // tap to commit.
  useEffect(() => {
    if (!allPlaced || submitted === "correct") return;
    const ok = builtWord === target;
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
      // Don't auto-clear — let the student fix individual slots so they can
      // see which letter is off.
      setTimeout(() => setSubmitted(null), 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlaced, builtWord]);

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Spell the word
      </p>
      <p className="text-base font-medium text-canvas-white mb-5 leading-relaxed">
        {prompt ?? "Tap the letters in order to spell the word."}
      </p>

      {/* Slot row */}
      <div
        className={cn(
          "flex justify-center gap-1.5 mb-5 flex-wrap",
          submitted === "wrong" && "animate-pulse"
        )}
      >
        {placed.map((tileId, i) => {
          const letter = tileId ? pool.find((t) => t.id === tileId)?.letter : null;
          const isCorrect = submitted === "correct";
          const isWrong = submitted === "wrong" && letter !== target[i];
          return (
            <button
              key={i}
              onClick={() => clearSlot(i)}
              disabled={submitted === "correct"}
              className={cn(
                "w-10 h-12 sm:w-11 sm:h-13 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-colors",
                !letter && "border-dashed border-[var(--border-subtle)] bg-coal text-ash-gray",
                letter && !isCorrect && !isWrong && "border-[var(--border-strong)] bg-iron text-canvas-white",
                isCorrect && "border-emerald-400 bg-coal text-canvas-white",
                isWrong && "border-rose-400 bg-coal text-canvas-white"
              )}
            >
              {letter ?? ""}
            </button>
          );
        })}
      </div>

      {/* Tile pool */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        <AnimatePresence>
          {pool.map((t) => {
            const used = usedTiles.has(t.id);
            return (
              <motion.button
                key={t.id}
                onClick={() => placeTile(t.id)}
                disabled={used || submitted === "correct"}
                whileTap={{ scale: 0.9 }}
                animate={{ opacity: used ? 0.25 : 1, scale: used ? 0.94 : 1 }}
                className={cn(
                  "w-10 h-12 sm:w-11 sm:h-13 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-colors",
                  used
                    ? "border-[var(--border-subtle)] bg-iron text-ash-gray"
                    : "border-canvas-white bg-canvas-white text-void-black hover:opacity-90 cursor-pointer shadow-md"
                )}
              >
                {t.letter}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-2 mt-5">
        <p className="text-xs text-ash-gray">
          {submitted === "correct"
            ? "You spelled it."
            : submitted === "wrong"
              ? "Almost — one or two letters are off."
              : "Letters return to the pool when you tap a slot."}
        </p>
        {placed.some(Boolean) && submitted !== "correct" && (
          <button
            onClick={() => setPlaced(Array(slotCount).fill(null))}
            className="text-xs px-2.5 py-1 rounded-md text-ash-gray hover:text-canvas-white hover:bg-iron transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
