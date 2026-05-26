// Daily-goal tracker. Stores "lessons completed on date X" in localStorage
// so the dashboard can show a Duolingo-style daily target without a
// Firestore write on every lesson finish.
//
// We deliberately key by *local* calendar date, not UTC — a student who
// finishes a lesson at 11pm and another at 1am should NOT see "2 days done"
// the next morning; they should see "today's goal achieved" then a fresh
// goal the following midnight.

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dailyGoal";
const HISTORY_KEY = "dailyHistory";

interface DailyGoalState {
  /** YYYY-MM-DD local date for which `lessonsDone` is the count. */
  date: string;
  lessonsDone: number;
  /** Target the student is working toward today. Defaults to 1. */
  target: number;
}

/** Per-date lesson count history for the activity strip. Capped at last
 *  60 days so the storage doesn't grow unbounded. */
type History = Record<string, number>;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function read(): DailyGoalState {
  if (typeof window === "undefined") {
    return { date: today(), lessonsDone: 0, target: 1 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), lessonsDone: 0, target: 1 };
    const parsed = JSON.parse(raw) as DailyGoalState;
    // Roll over if we're on a new day.
    if (parsed.date !== today()) {
      return { date: today(), lessonsDone: 0, target: parsed.target || 1 };
    }
    return parsed;
  } catch {
    return { date: today(), lessonsDone: 0, target: 1 };
  }
}

function write(state: DailyGoalState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("daily-goal-changed"));
  } catch {
    // ignore quota / private mode
  }
}

function readHistory(): History {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as History) : {};
  } catch {
    return {};
  }
}

function writeHistory(h: History): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    window.dispatchEvent(new Event("daily-history-changed"));
  } catch {
    // ignore
  }
}

/** Call when a lesson is completed. Idempotency caller's responsibility —
 *  we just increment. Also stamps the day in the history map for the
 *  activity strip. */
export function noteLessonCompleted(): DailyGoalState {
  const cur = read();
  const next: DailyGoalState = {
    ...cur,
    date: today(),
    lessonsDone: cur.date === today() ? cur.lessonsDone + 1 : 1,
  };
  write(next);
  // History stamp.
  const h = readHistory();
  h[today()] = (h[today()] ?? 0) + 1;
  // Trim to last ~60 days to keep storage tiny.
  const dates = Object.keys(h).sort();
  while (dates.length > 60) {
    const oldest = dates.shift()!;
    delete h[oldest];
  }
  writeHistory(h);
  return next;
}

/** Returns the last N calendar days (oldest first) paired with the count
 *  of lessons completed on that day. Today is always the last entry. */
export function useActivityStrip(days = 7): { date: string; count: number }[] {
  const [history, setHistory] = useState<History>({});
  useEffect(() => {
    setHistory(readHistory());
    const onChange = () => setHistory(readHistory());
    window.addEventListener("daily-history-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("daily-history-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const out: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: key, count: history[key] ?? 0 });
  }
  return out;
}

export function setDailyTarget(target: number): void {
  const cur = read();
  write({ ...cur, target: Math.max(1, target) });
}

/** Reactive hook — re-renders when the goal state changes (same-tab events
 *  via custom event + cross-tab via the storage event). */
export function useDailyGoal(): DailyGoalState {
  const [state, setState] = useState<DailyGoalState>(() => ({
    date: today(),
    lessonsDone: 0,
    target: 1,
  }));

  useEffect(() => {
    setState(read());
    const onChange = () => setState(read());
    window.addEventListener("daily-goal-changed", onChange);
    window.addEventListener("storage", onChange);
    // Re-check at the top of every minute in case the date rolled while
    // the tab was open (passing midnight).
    const interval = setInterval(() => {
      const cur = read();
      setState((prev) => (prev.date === cur.date && prev.lessonsDone === cur.lessonsDone ? prev : cur));
    }, 60_000);
    return () => {
      window.removeEventListener("daily-goal-changed", onChange);
      window.removeEventListener("storage", onChange);
      clearInterval(interval);
    };
  }, []);

  return state;
}
