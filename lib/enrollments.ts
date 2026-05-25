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

/** Mark a lesson as completed and append it to completedLessonIds. */
export async function markLessonComplete(
  uid: string,
  courseId: string,
  lessonId: string,
  nextLessonId: string | null
): Promise<void> {
  await updateDoc(ref(uid, courseId), {
    lastVisitedAt: serverTimestamp(),
    currentLessonId: nextLessonId,
    completedLessonIds: arrayUnion(lessonId),
    [`lessons.${lessonId}.completed`]: true,
    [`lessons.${lessonId}.completedAt`]: serverTimestamp(),
  } as Record<string, FieldValue | unknown>);
}
