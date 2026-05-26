// Tiny haptic-feedback helpers. Mobile-only; desktops + iOS Safari ignore
// navigator.vibrate. Designed to feel like Duolingo / mobile-game
// micro-feedback: a small thump on success, a triple-buzz on failure.
//
// Respect prefers-reduced-motion: any user who opted out of motion
// shouldn't get vibration either.

function vibrate(pattern: number | number[]): void {
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw on vibrate inside iframes; ignore.
  }
}

/** A single soft thump — use for correct answers, lesson advance. */
export function hapticTap() {
  vibrate(15);
}

/** A triple buzz — use for wrong answers / soft errors. */
export function hapticError() {
  vibrate([30, 50, 30]);
}

/** A celebration pattern — use for lesson + course complete. */
export function hapticCelebrate() {
  vibrate([20, 40, 20, 40, 40]);
}
