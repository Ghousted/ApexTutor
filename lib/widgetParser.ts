// Parses interactive-widget markers out of AI-streamed text. The AI emits
// these markers inline; the client extracts them, strips them from the
// displayed bubble, and pushes the widget to the right-side workspace panel.
//
// Supported markers (extensible — add new kinds here as they're built):
//
//   [[QUIZ:Q=...;A=...;B=...;C=...;correct=A]]
//   [[WHITEBOARD]]
//   [[WHITEBOARD:prompt=Draw step by step]]
//   [[FRACTION_BAR:value=3/4]]             (Phase 2)
//   [[NUMBER_LINE:from=-5;to=5;mark=3]]    (Phase 2)
//
// Stream-safe: partial markers (mid-stream `[[QUIZ:` with no closing `]]`)
// are left alone; only fully-formed markers are extracted. The display
// stripper hides complete markers; partial ones temporarily render as text
// until the closing brackets arrive.

export type Widget =
  | QuizWidget
  | FractionBarWidget
  | NumberLineWidget
  | MatchPairsWidget
  | SortSequenceWidget;

export interface QuizWidget {
  type: "quiz";
  question: string;
  options: Array<{ key: string; label: string }>;
  correctKey: string;
}

export interface SortSequenceWidget {
  type: "sort-sequence";
  /** Items in their CORRECT order. Widget shuffles for display. */
  items: string[];
  prompt?: string;
}

export interface FractionBarWidget {
  type: "fraction-bar";
  value: string; // "3/4"
}

export interface NumberLineWidget {
  type: "number-line";
  from: number;
  to: number;
  mark?: number;
}

export interface MatchPairsWidget {
  type: "match-pairs";
  /** Pairs of left↔right items the student must connect via drag-drop. */
  pairs: Array<{ left: string; right: string }>;
  /** Heading shown above the columns (e.g. "Match each equation to its solution"). */
  prompt?: string;
}

const MARKER_RE = /\[\[([A-Z_]+)(?::([^\]]*))?\]\]/g;

/** Strip all complete widget markers from text for display. */
export function stripMarkers(text: string): string {
  return text.replace(MARKER_RE, "").replace(/\s+/g, " ").trim();
}

/** Extract all widgets from a fully-streamed AI message. */
export function parseWidgets(text: string): Widget[] {
  const out: Widget[] = [];
  const re = new RegExp(MARKER_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const kind = match[1];
    const params = parseParams(match[2] ?? "");
    const widget = buildWidget(kind, params);
    if (widget) out.push(widget);
  }
  return out;
}

function parseParams(s: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of s.split(";")) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    result[k.trim()] = rest.join("=").trim();
  }
  return result;
}

function buildWidget(kind: string, p: Record<string, string>): Widget | null {
  switch (kind) {
    case "QUIZ": {
      const question = p.Q || p.question || "";
      const options: Array<{ key: string; label: string }> = [];
      for (const key of ["A", "B", "C", "D", "E"]) {
        if (p[key]) options.push({ key, label: p[key] });
      }
      const correctKey = (p.correct || p.answer || "").toUpperCase();
      if (!question || options.length < 2) return null;
      return { type: "quiz", question, options, correctKey };
    }
    case "SORT": {
      // items syntax: "first|second|third|fourth" (in correct order)
      const items = (p.items || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length < 2) return null;
      return {
        type: "sort-sequence",
        items,
        prompt: p.prompt || undefined,
      };
    }
    case "FRACTION_BAR":
      // Accept either `value=3/4` (read-only display) or `target=3/4` (the
      // student fills cells to match). Both are normalized to `value`.
      return p.value || p.target
        ? { type: "fraction-bar", value: p.value || p.target }
        : null;
    case "MATCH": {
      // pairs syntax: "left1=>right1|left2=>right2|..."
      const raw = p.pairs || "";
      const pairs = raw
        .split("|")
        .map((chunk) => {
          const [l, r] = chunk.split("=>");
          if (!l || !r) return null;
          return { left: l.trim(), right: r.trim() };
        })
        .filter((x): x is { left: string; right: string } => x !== null);
      if (pairs.length < 2) return null;
      return { type: "match-pairs", pairs, prompt: p.prompt || undefined };
    }
    case "NUMBER_LINE": {
      const from = Number(p.from);
      const to = Number(p.to);
      if (!isFinite(from) || !isFinite(to)) return null;
      const mark = Number(p.mark);
      return {
        type: "number-line",
        from,
        to,
        mark: isFinite(mark) ? mark : undefined,
      };
    }
    default:
      return null;
  }
}
