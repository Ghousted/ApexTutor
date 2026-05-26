// UI sound effects — single import point so volume + asset paths live here.
//
// Drop CC0 / royalty-free .mp3 files in /public/sounds/ matching the keys
// below. Recommended source: Kenney UI Audio (kenney.nl/assets/ui-audio) —
// pick clean, short (<200ms) tones; avoid anything cute or chiming so the
// vibe matches the Krea Midnight Terminal aesthetic.
//
// If a file is missing, useSound silently no-ops — no crash, just silence.
// Honours prefers-reduced-motion: when set, all sounds are muted.

"use client";

import useSound from "use-sound";
import { useReducedMotion } from "motion/react";

const VOLUME = 0.35;

const ASSETS = {
  click: "/sounds/click.mp3",        // tiny tick — used on button presses
  correct: "/sounds/correct.mp3",    // soft positive blip
  wrong: "/sounds/wrong.mp3",        // muted negative thunk (NOT a buzzer)
  complete: "/sounds/complete.mp3",  // longer success — lesson finished
  advance: "/sounds/advance.mp3",    // step → step whoosh
} as const;

/**
 * Shared UI sound bundle. Memoised by use-sound so re-renders don't
 * reload the audio buffer.
 */
export function useUiSounds() {
  const reduced = useReducedMotion();
  const muted = Boolean(reduced);
  const vol = muted ? 0 : VOLUME;

  const [playClick] = useSound(ASSETS.click, { volume: vol, soundEnabled: !muted });
  const [playCorrect] = useSound(ASSETS.correct, { volume: vol, soundEnabled: !muted });
  const [playWrong] = useSound(ASSETS.wrong, { volume: vol, soundEnabled: !muted });
  const [playComplete] = useSound(ASSETS.complete, { volume: vol * 1.2, soundEnabled: !muted });
  const [playAdvance] = useSound(ASSETS.advance, { volume: vol * 0.7, soundEnabled: !muted });

  return { playClick, playCorrect, playWrong, playComplete, playAdvance };
}
