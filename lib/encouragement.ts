// Encouraging lines shown after a wrong widget answer. Synthesis-style:
// never punitive, always inviting another try. The tutor speaks one of
// these out loud (Kokoro) so the student feels heard, not graded.
//
// Keep them short — Kokoro renders best on <12 words.

const QUIZ = [
  "Not quite — give it another try.",
  "Close! Take another look.",
  "Almost — what if you read the question again?",
  "Hmm, not this time. You've got this.",
];

const FRACTION_BAR = [
  "Not the right amount yet — adjust the cells.",
  "Close — count the cells one more time.",
  "Almost there. Try a different number of cells.",
];

const MATCH_PAIRS = [
  "Those two don't match — try another pairing.",
  "Not yet — look for a different partner for that one.",
  "Close, but not quite. Keep going.",
];

const SORT_SEQUENCE = [
  "The order isn't quite right yet. Try again.",
  "Almost — think about what comes first.",
  "Not yet — what should come before that one?",
];

const POOLS: Record<string, string[]> = {
  quiz: QUIZ,
  "fraction-bar": FRACTION_BAR,
  "match-pairs": MATCH_PAIRS,
  "sort-sequence": SORT_SEQUENCE,
};

/**
 * Pick a random encouragement for a given widget type. The optional
 * `lastIndex` argument avoids repeating the previous line.
 */
export function pickEncouragement(
  widgetType: string,
  lastIndex?: number
): { line: string; index: number } {
  const pool = POOLS[widgetType] ?? QUIZ;
  if (pool.length === 1) return { line: pool[0], index: 0 };
  let i = Math.floor(Math.random() * pool.length);
  if (lastIndex !== undefined && i === lastIndex) {
    i = (i + 1) % pool.length;
  }
  return { line: pool[i], index: i };
}
