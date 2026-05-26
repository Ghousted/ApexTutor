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

/** Side-burst from a specific point. Use on quiz-correct so the cheer
 *  literally erupts from the option the student tapped. */
export function celebrateSideBurst(origin: { x: number; y: number }) {
  if (reducedMotion()) return;
  const fromLeft = origin.x < 0.5;
  confetti({
    particleCount: 40,
    angle: fromLeft ? 60 : 120,
    spread: 55,
    startVelocity: 45,
    decay: 0.93,
    scalar: 0.85,
    ticks: 120,
    colors: PALETTE,
    origin,
  });
}

/** Top-down cascade — used for streak milestones (3-in-a-row, 5-day streak).
 *  Particles rain from the top edge across the full width. */
export function celebrateCascade() {
  if (reducedMotion()) return;
  const end = Date.now() + 800;
  const tick = () => {
    confetti({
      particleCount: 4,
      angle: 270,
      spread: 80,
      startVelocity: 12,
      gravity: 1.1,
      ticks: 200,
      decay: 0.95,
      scalar: 0.7,
      colors: PALETTE,
      origin: { x: Math.random(), y: -0.05 },
    });
    if (Date.now() < end) {
      requestAnimationFrame(tick);
    }
  };
  tick();
}

/** Fountain from the bottom — sustained for ~2s. Use for COURSE complete
 *  (a bigger deal than a single lesson). */
export function celebrateFountain() {
  if (reducedMotion()) return;
  const end = Date.now() + 1800;
  const tick = () => {
    confetti({
      particleCount: 5,
      angle: 90,
      spread: 50,
      startVelocity: 55,
      gravity: 0.85,
      ticks: 220,
      decay: 0.92,
      scalar: 1,
      shapes: ["circle", "square"],
      colors: PALETTE,
      origin: { x: 0.5, y: 1.05 },
    });
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 35,
      startVelocity: 50,
      gravity: 0.85,
      ticks: 220,
      decay: 0.92,
      scalar: 1,
      colors: PALETTE,
      origin: { x: 0.1, y: 1.05 },
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 35,
      startVelocity: 50,
      gravity: 0.85,
      ticks: 220,
      decay: 0.92,
      scalar: 1,
      colors: PALETTE,
      origin: { x: 0.9, y: 1.05 },
    });
    if (Date.now() < end) {
      requestAnimationFrame(tick);
    }
  };
  tick();
}

/** Single big "first ever" burst — bigger than a quiz-correct, smaller
 *  than a lesson-complete. Used for milestone moments like first correct
 *  answer of the session. */
export function celebrateFirstWin() {
  if (reducedMotion()) return;
  confetti({
    particleCount: 100,
    spread: 100,
    startVelocity: 45,
    decay: 0.93,
    scalar: 1.05,
    ticks: 160,
    shapes: ["star", "circle"],
    colors: PALETTE,
    origin: { x: 0.5, y: 0.45 },
  });
}
