// Monochrome confetti — matches the Krea Midnight Terminal palette so
// celebrations feel "of the brand" instead of clashing with the dark UI.
//
// Caller passes an optional origin (0..1, x/y normalised viewport coords);
// defaults to centre. No-ops if the user has prefers-reduced-motion set.

"use client";

import confetti from "canvas-confetti";

const PALETTE = ["#ffffff", "#a3a3a3", "#f5f5f5"];

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Quick celebratory burst — use on quiz-correct, fraction-bar correct, etc. */
export function celebrateBurst(origin: { x: number; y: number } = { x: 0.5, y: 0.5 }) {
  if (reducedMotion()) return;
  confetti({
    particleCount: 60,
    spread: 65,
    startVelocity: 40,
    decay: 0.92,
    scalar: 0.9,
    ticks: 120,
    colors: PALETTE,
    origin,
  });
}

/** Bigger, lesson-complete celebration — two-stage burst for the level-up beat. */
export function celebrateLessonComplete() {
  if (reducedMotion()) return;
  const defaults = {
    spread: 360,
    ticks: 200,
    gravity: 0.7,
    decay: 0.94,
    startVelocity: 35,
    colors: PALETTE,
  };
  confetti({
    ...defaults,
    particleCount: 80,
    scalar: 1.1,
    shapes: ["circle"],
    origin: { x: 0.5, y: 0.4 },
  });
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 60,
      scalar: 0.8,
      shapes: ["square"],
      origin: { x: 0.5, y: 0.5 },
    });
  }, 200);
}
