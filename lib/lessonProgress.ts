// Per-user lesson progress + grade level, stored in Firestore.
//
// Schema:
//   users/{uid}.profile.gradeLevel             — number, 4..12
//   users/{uid}.profile.currentLessonByInstructor.{instructorId} — lessonId
//   users/{uid}/lessons/{lessonId}             — subcollection doc:
//     status: "in_progress" | "mastered" | "skipped"
//     startedAt, completedAt (timestamps)
//     attempts (count of times the student returned to it)
//
// Subcollection chosen over a single map field because (a) progress will grow
// linearly with curriculum size, (b) it parallels the existing
// users/{uid}/sessions/{sid} pattern, (c) Firestore field maps have a 1MB
// ceiling that subcollections don't.

import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export type LessonStatus = "in_progress" | "mastered" | "skipped";

export interface LessonProgressDoc {
  lessonId: string;
  status: LessonStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: number;
}

export interface UserCurriculumState {
  gradeLevel: number | null;
  currentLessonByInstructor: Record<string, string | null>;
  progress: LessonProgressDoc[];
  /** Parent's display name (used for greeting copy, receipts). */
  parentName: string | null;
  /** Student's first name — used by the AI when greeting and teaching. */
  studentName: string | null;
  /** Student's age — drives the grade-level mapping. */
  studentAge: number | null;
  /** Whether the post-signup onboarding (studentName + age) is done. */
  onboardingComplete: boolean;
}

function userRef(uid: string) {
  return doc(db, "users", uid);
}

function lessonsCol(uid: string) {
  return collection(db, "users", uid, "lessons");
}

function tsToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

/** Read everything the chat needs to know about the user's lesson state. */
export async function loadUserCurriculumState(
  uid: string
): Promise<UserCurriculumState> {
  const [userSnap, progressSnap] = await Promise.all([
    getDoc(userRef(uid)),
    getDocs(lessonsCol(uid)),
  ]);

  const userData = userSnap.data() ?? {};
  const profile = userData.profile ?? {};

  const progress: LessonProgressDoc[] = progressSnap.docs.map((d) => {
    const data = d.data();
    return {
      lessonId: d.id,
      status: (data.status as LessonStatus) ?? "in_progress",
      startedAt: tsToDate(data.startedAt),
      completedAt: tsToDate(data.completedAt),
      attempts: data.attempts ?? 0,
    };
  });

  const studentName = profile.studentName ?? null;
  const studentAge = profile.studentAge ?? null;
  return {
    gradeLevel: profile.gradeLevel ?? null,
    currentLessonByInstructor: profile.currentLessonByInstructor ?? {},
    progress,
    parentName: profile.parentName ?? userData.displayName ?? null,
    studentName,
    studentAge,
    // Onboarding is "done" when we have the student's name + age. Existing
    // accounts that filled in just gradeLevel earlier still need to do this.
    onboardingComplete: Boolean(studentName && studentAge),
  };
}

/** One-shot save: student info + derived grade level, called from the
 *  onboarding modal. */
export async function setStudentInfo(
  uid: string,
  data: { studentName: string; studentAge: number; gradeLevel: number; parentName?: string }
) {
  const profile: Record<string, unknown> = {
    studentName: data.studentName,
    studentAge: data.studentAge,
    gradeLevel: data.gradeLevel,
  };
  if (data.parentName) profile.parentName = data.parentName;
  await setDoc(userRef(uid), { profile }, { merge: true });
}

export async function setUserGradeLevel(uid: string, gradeLevel: number) {
  await setDoc(
    userRef(uid),
    { profile: { gradeLevel } },
    { merge: true }
  );
}

export async function setCurrentLesson(
  uid: string,
  instructorId: string,
  lessonId: string | null
) {
  await setDoc(
    userRef(uid),
    {
      profile: {
        currentLessonByInstructor: { [instructorId]: lessonId },
      },
    },
    { merge: true }
  );
}

export async function markLessonStarted(uid: string, lessonId: string) {
  const ref = doc(lessonsCol(uid), lessonId);
  const existing = await getDoc(ref);
  const prevAttempts = existing.data()?.attempts ?? 0;
  await setDoc(
    ref,
    {
      status: "in_progress",
      startedAt: existing.exists() ? existing.data()?.startedAt : serverTimestamp(),
      attempts: prevAttempts + (existing.exists() ? 0 : 1),
    },
    { merge: true }
  );
}

export async function markLessonMastered(uid: string, lessonId: string) {
  await setDoc(
    doc(lessonsCol(uid), lessonId),
    {
      status: "mastered",
      completedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markLessonSkipped(uid: string, lessonId: string) {
  await setDoc(
    doc(lessonsCol(uid), lessonId),
    { status: "skipped" },
    { merge: true }
  );
}

/** Convenience: list of lesson ids the user has fully mastered. */
export function masteredLessonIds(state: UserCurriculumState): string[] {
  return state.progress.filter((p) => p.status === "mastered").map((p) => p.lessonId);
}

/** Convenience: list of lesson ids the user explicitly skipped. */
export function skippedLessonIds(state: UserCurriculumState): string[] {
  return state.progress.filter((p) => p.status === "skipped").map((p) => p.lessonId);
}

/** Lookup the user's gradeLevel quickly (used at chat start). */
export async function getGradeLevel(uid: string): Promise<number | null> {
  const snap = await getDoc(userRef(uid));
  return snap.data()?.profile?.gradeLevel ?? null;
}
// where + query imported but used in future helpers; suppress unused-import warning
void query;
void where;
