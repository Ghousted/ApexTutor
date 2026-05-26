// Per-student course enrollment + progress, stored in Firestore.
//
// Schema:
//   users/{uid}/enrollments/{courseId}
//     enrolledAt          — first time the student opened the course
//     lastVisitedAt       — most recent activity
//     currentLessonId     — pointer the catalog uses to surface "Continue"
//     completedLessonIds  — array of lesson ids the student finished
//     lessons             — map of {lessonId: { lastStepIndex, completed, completedAt }}
//
// Reads / writes from client SDK (signed-in user writing their own doc),
// guarded by Firestore rules: only the matching uid can read/write.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  FieldValue,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";

export interface LessonProgress {
  lastStepIndex: number;
  completed: boolean;
  completedAt: Date | null;
}

export interface EnrollmentDoc {
  courseId: string;
  enrolledAt: Date | null;
  lastVisitedAt: Date | null;
  currentLessonId: string | null;
  completedLessonIds: string[];
  lessons: Record<string, LessonProgress>;
  /** Consecutive-day streak of completing at least one lesson. */
  streak: number;
  /** YYYY-MM-DD of the last lesson the student completed in this course.
   *  Drives streak math without dragging Timestamp objects into the client. */
  lastCompletionDate: string | null;
}

function todayKey(): string {
  // Local-time YYYY-MM-DD. Streaks should feel like "you came back today",
  // not "you came back in UTC."
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayBefore(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function ref(uid: string, courseId: string) {
  return doc(db, "users", uid, "enrollments", courseId);
}

function tsToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

/** Read the student's enrollment for a course. Null if they've never started. */
export async function getEnrollment(
  uid: string,
  courseId: string
): Promise<EnrollmentDoc | null> {
  const snap = await getDoc(ref(uid, courseId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    courseId,
    enrolledAt: tsToDate(data.enrolledAt),
    lastVisitedAt: tsToDate(data.lastVisitedAt),
    currentLessonId: data.currentLessonId ?? null,
    completedLessonIds: Array.isArray(data.completedLessonIds)
      ? data.completedLessonIds
      : [],
    lessons: typeof data.lessons === "object" && data.lessons
      ? Object.fromEntries(
          Object.entries(data.lessons as Record<string, Record<string, unknown>>).map(
            ([id, p]) => [
              id,
              {
                lastStepIndex: Number(p.lastStepIndex ?? 0),
                completed: Boolean(p.completed),
                completedAt: tsToDate(p.completedAt),
              },
            ]
          )
        )
      : {},
    streak: Number(data.streak ?? 0),
    lastCompletionDate:
      typeof data.lastCompletionDate === "string" ? data.lastCompletionDate : null,
  };
}

/** Create the enrollment doc on first visit. Idempotent. */
export async function ensureEnrollment(
  uid: string,
  courseId: string,
  initialLessonId: string | null
): Promise<void> {
  const snap = await getDoc(ref(uid, courseId));
  if (snap.exists()) {
    // Touch lastVisitedAt only.
    await setDoc(
      ref(uid, courseId),
      { lastVisitedAt: serverTimestamp() },
      { merge: true }
    );
    return;
  }
  await setDoc(ref(uid, courseId), {
    enrolledAt: serverTimestamp(),
    lastVisitedAt: serverTimestamp(),
    currentLessonId: initialLessonId,
    completedLessonIds: [],
    lessons: {},
  });
}

/** Save the student's step position within a lesson. Debounced by caller. */
export async function setLessonProgress(
  uid: string,
  courseId: string,
  lessonId: string,
  lastStepIndex: number
): Promise<void> {
  // Use updateDoc — only updateDoc interprets dot-notation as nested paths.
  // setDoc({merge:true}) would create a top-level field literally named
  // "lessons.{id}.lastStepIndex" instead of nesting it.
  await updateDoc(ref(uid, courseId), {
    lastVisitedAt: serverTimestamp(),
    currentLessonId: lessonId,
    [`lessons.${lessonId}.lastStepIndex`]: lastStepIndex,
  } as Record<string, FieldValue | unknown>);
}

export interface CompletionResult {
  /** New streak value AFTER applying this completion. */
  streak: number;
  /** True only when this completion incremented the streak (i.e., first
   *  completion of a new day). Useful for the UI to fire a "+1 day" toast. */
  streakIncreased: boolean;
}

/** Mark a lesson as completed and append it to completedLessonIds. Returns
 *  the new streak so the UI can celebrate. */
export async function markLessonComplete(
  uid: string,
  courseId: string,
  lessonId: string,
  nextLessonId: string | null
): Promise<CompletionResult> {
  // Read the current streak/lastCompletionDate to compute next state. We
  // do this client-side rather than via a Firestore transaction — collisions
  // are unlikely (one student finishing two lessons in the same race) and
  // the worst case is a 1-off streak count.
  const snap = await getDoc(ref(uid, courseId));
  const data = snap.exists() ? snap.data() : {};
  const today = todayKey();
  const lastDate = typeof data.lastCompletionDate === "string" ? data.lastCompletionDate : null;
  const prevStreak = Number(data.streak ?? 0);

  let nextStreak = prevStreak;
  let streakIncreased = false;
  if (lastDate === today) {
    // Already completed a lesson today — no change.
    nextStreak = Math.max(prevStreak, 1);
  } else if (lastDate === dayBefore(today)) {
    nextStreak = prevStreak + 1;
    streakIncreased = true;
  } else {
    // Gap, or first ever completion — restart at 1.
    nextStreak = 1;
    streakIncreased = true;
  }

  await updateDoc(ref(uid, courseId), {
    lastVisitedAt: serverTimestamp(),
    currentLessonId: nextLessonId,
    completedLessonIds: arrayUnion(lessonId),
    [`lessons.${lessonId}.completed`]: true,
    [`lessons.${lessonId}.completedAt`]: serverTimestamp(),
    streak: nextStreak,
    lastCompletionDate: today,
  } as Record<string, FieldValue | unknown>);

  return { streak: nextStreak, streakIncreased };
}
