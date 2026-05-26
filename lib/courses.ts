// Course catalog data model — replaces the old hardcoded lib/lessons.ts.
//
// Hierarchy:
//   courses/{courseId}                       — course metadata
//   courses/{courseId}/lessons/{lessonId}    — ordered lessons within a course
//
//   enrollments/{uid}_{courseId}             — per-student course progress
//
// Lessons hold an inline `steps[]` array because each course tops out at a
// few dozen lessons and each lesson at ~10 steps — well under Firestore's
// 1 MiB per-doc ceiling. Steps as a flat array keep reordering, drag-drop,
// and AI bulk-generation simple (no sub-collection churn).

import { adminDb } from "./firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Step types ─────────────────────────────────────────────────────────
// Each step is one atomic interaction in a lesson. Adding a new step type:
// extend the discriminated union here, render it in the LessonPlayer.

export type StepIntro = {
  type: "intro";
  /** What the tutor says when this step appears. Spoken aloud + shown. */
  script: string;
};

export type StepExplainer = {
  type: "explainer";
  script: string;
  /** Optional bullet points the student can see while the tutor speaks. */
  bullets?: string[];
};

export type StepQuiz = {
  type: "quiz";
  script: string;
  question: string;
  options: Array<{ key: string; label: string }>;
  correctKey: string;
};

export type StepFractionBar = {
  type: "fraction-bar";
  script: string;
  /** "3/4" — denominator becomes cell count; student fills to match. */
  target: string;
};

export type StepMatch = {
  type: "match-pairs";
  script: string;
  prompt?: string;
  pairs: Array<{ left: string; right: string }>;
};

export type StepSortSequence = {
  type: "sort-sequence";
  script: string;
  /** Heading shown above the items (e.g. "Put these steps in order"). */
  prompt?: string;
  /** Items stored in their CORRECT order. The widget shuffles for display. */
  items: string[];
};

export type StepCheckpoint = {
  type: "checkpoint";
  /** Optional summary the tutor delivers before advancing. */
  script?: string;
};

export type StepTrueFalse = {
  type: "true-false";
  script: string;
  statement: string;
  /** Whether the statement is true. */
  answer: boolean;
};

export type StepFillBlank = {
  type: "fill-blank";
  script: string;
  /** Sentence containing `___` (three underscores) as the blank marker. */
  sentence: string;
  /** The canonical answer to display + check against. */
  answer: string;
  /** Acceptable alternative spellings/forms (case-insensitive). */
  alternatives?: string[];
};

export type StepNumberLine = {
  type: "number-line";
  script: string;
  prompt?: string;
  min: number;
  max: number;
  /** The number the student is trying to place. */
  target: number;
  /** Optional unit shown next to numbers ("°C", "%", "min", etc.). */
  unit?: string;
  /** ± tolerance in absolute value; defaults to (max-min)/20. */
  tolerance?: number;
};

export type StepHighlight = {
  type: "highlight";
  script: string;
  prompt?: string;
  /** Passage text; student taps individual words. */
  passage: string;
  /** Words that should be tapped (case + punctuation insensitive). */
  targets: string[];
};

export type StepReadingPassage = {
  type: "reading-passage";
  script: string;
  passage: string;
  question: string;
  options: Array<{ key: string; label: string }>;
  correctKey: string;
};

export type StepTapLabel = {
  type: "tap-label";
  script: string;
  prompt?: string;
  /** Public URL of the image to label. */
  imageUrl: string;
  /** Hotspot centers as 0..1 fractions of image width/height with the label
   *  the student is trying to identify. */
  hotspots: Array<{ x: number; y: number; label: string }>;
};

export type Step =
  | StepIntro
  | StepExplainer
  | StepQuiz
  | StepFractionBar
  | StepMatch
  | StepSortSequence
  | StepCheckpoint
  | StepTrueFalse
  | StepFillBlank
  | StepNumberLine
  | StepHighlight
  | StepReadingPassage
  | StepTapLabel;

// ─── Course + Lesson docs ───────────────────────────────────────────────

export interface CourseDoc {
  id: string;
  title: string;
  subject: string;
  description: string;
  /** Free-form copy explaining what the student will learn. */
  overview?: string;
  /** Concrete "by the end you'll be able to…" outcomes. Shown on the course
   *  detail page in place of the prose overview when present. */
  outcomes?: string[];
  /** Grade band the course is aimed at. Optional. */
  gradeBand?: { min: number; max: number };
  /** Instructor ID — references the static lib/instructors.ts. */
  instructorId: string | null;
  status: "draft" | "published";
  /** Catalog sort order. Lower = earlier. */
  order: number;
  /** Whether this course is included in the free tier. */
  freeTier: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Cached count for the admin list — denormalized, updated on lesson edits. */
  lessonCount: number;
}

export interface LessonDoc {
  id: string;
  courseId: string;
  title: string;
  objective: string;
  order: number;
  steps: Step[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Firestore collection references ────────────────────────────────────

function coursesCol() {
  return adminDb().collection("courses");
}
function lessonsCol(courseId: string) {
  return adminDb().collection("courses").doc(courseId).collection("lessons");
}

function tsToDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

function snapToCourse(d: FirebaseFirestore.QueryDocumentSnapshot): CourseDoc {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? "Untitled",
    subject: data.subject ?? "",
    description: data.description ?? "",
    overview: data.overview ?? undefined,
    outcomes: Array.isArray(data.outcomes)
      ? (data.outcomes as unknown[]).map(String).filter(Boolean)
      : undefined,
    gradeBand: data.gradeBand ?? undefined,
    instructorId: data.instructorId ?? null,
    status: data.status ?? "draft",
    order: data.order ?? 0,
    freeTier: Boolean(data.freeTier),
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
    lessonCount: data.lessonCount ?? 0,
  };
}

function snapToLesson(
  courseId: string,
  d: FirebaseFirestore.QueryDocumentSnapshot
): LessonDoc {
  const data = d.data();
  return {
    id: d.id,
    courseId,
    title: data.title ?? "Untitled lesson",
    objective: data.objective ?? "",
    order: data.order ?? 0,
    steps: Array.isArray(data.steps) ? (data.steps as Step[]) : [],
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}

// ─── Course CRUD ────────────────────────────────────────────────────────

export async function listCourses(opts: {
  publishedOnly?: boolean;
} = {}): Promise<CourseDoc[]> {
  let q: FirebaseFirestore.Query = coursesCol().orderBy("order", "asc");
  if (opts.publishedOnly) q = q.where("status", "==", "published");
  const snap = await q.get();
  return snap.docs.map(snapToCourse);
}

export async function getCourse(courseId: string): Promise<CourseDoc | null> {
  const snap = await coursesCol().doc(courseId).get();
  if (!snap.exists) return null;
  return snapToCourse(snap as FirebaseFirestore.QueryDocumentSnapshot);
}

export async function createCourse(
  data: Omit<
    CourseDoc,
    "id" | "createdAt" | "updatedAt" | "lessonCount" | "order"
  > & { order?: number }
): Promise<string> {
  const ref = await coursesCol().add({
    title: data.title,
    subject: data.subject,
    description: data.description,
    overview: data.overview ?? null,
    gradeBand: data.gradeBand ?? null,
    instructorId: data.instructorId ?? null,
    status: data.status ?? "draft",
    order: data.order ?? Date.now(), // bumps to end; admin can reorder later
    freeTier: Boolean(data.freeTier),
    lessonCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateCourse(
  courseId: string,
  patch: Partial<
    Omit<CourseDoc, "id" | "createdAt" | "updatedAt" | "lessonCount">
  >
): Promise<void> {
  await coursesCol()
    .doc(courseId)
    .update({
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function deleteCourse(courseId: string): Promise<void> {
  // Delete all lessons first (Firestore doesn't cascade).
  const lessonsSnap = await lessonsCol(courseId).get();
  const batch = adminDb().batch();
  lessonsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(coursesCol().doc(courseId));
  await batch.commit();
}

// ─── Lesson CRUD ────────────────────────────────────────────────────────

export async function listLessons(courseId: string): Promise<LessonDoc[]> {
  const snap = await lessonsCol(courseId).orderBy("order", "asc").get();
  return snap.docs.map((d) => snapToLesson(courseId, d));
}

export async function getLesson(
  courseId: string,
  lessonId: string
): Promise<LessonDoc | null> {
  const snap = await lessonsCol(courseId).doc(lessonId).get();
  if (!snap.exists) return null;
  return snapToLesson(
    courseId,
    snap as FirebaseFirestore.QueryDocumentSnapshot
  );
}

export async function createLesson(
  courseId: string,
  data: { title: string; objective: string; steps?: Step[]; order?: number }
): Promise<string> {
  const ref = await lessonsCol(courseId).add({
    title: data.title,
    objective: data.objective,
    steps: data.steps ?? [],
    order: data.order ?? Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await coursesCol()
    .doc(courseId)
    .update({
      lessonCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  return ref.id;
}

export async function updateLesson(
  courseId: string,
  lessonId: string,
  patch: Partial<Omit<LessonDoc, "id" | "courseId" | "createdAt" | "updatedAt">>
): Promise<void> {
  await lessonsCol(courseId)
    .doc(lessonId)
    .update({
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    });
  await coursesCol()
    .doc(courseId)
    .update({ updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteLesson(
  courseId: string,
  lessonId: string
): Promise<void> {
  await lessonsCol(courseId).doc(lessonId).delete();
  await coursesCol()
    .doc(courseId)
    .update({
      lessonCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/** Bulk-reorder lessons. Pass `[{id, order}, ...]`; we batch-write. */
export async function reorderLessons(
  courseId: string,
  order: Array<{ id: string; order: number }>
): Promise<void> {
  const batch = adminDb().batch();
  for (const o of order) {
    batch.update(lessonsCol(courseId).doc(o.id), {
      order: o.order,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}
