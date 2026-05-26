// Smooth number-counter hook. Every number that changes in the UI should
// pass through this so the value tweens instead of snapping.
//
//   const display = useCountUp(streak);   // animates from prev to streak
//   <span>{display}</span>
//
// Uses requestAnimationFrame directly (cheaper than a full motion value
// for tiny scalars). Defaults to 600ms ease-out which feels satisfying
// without being slow.

"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(
  target: number,
  options: { durationMs?: number; format?: (n: number) => string } = {}
): string {
  const { durationMs = 600, format = (n) => Math.round(n).toString() } = options;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDisplay(target);
      return;
    }
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Cubic ease-out for a "settling" feel.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return format(display);
}
