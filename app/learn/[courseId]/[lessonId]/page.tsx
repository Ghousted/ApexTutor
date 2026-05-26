import { notFound, redirect } from "next/navigation";
import { getCourse, getLesson, listLessons } from "@/lib/courses";
import {
  getServerSession,
  hasActiveServerSubscription,
  getServerEnrollment,
} from "@/lib/serverAuth";
import LearnLessonClient from "./LearnLessonClient";

export const dynamic = "force-dynamic";

export default async function LearnLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const course = await getCourse(courseId);
  if (!course || course.status !== "published") notFound();

  // ─── Server-side paywall ──────────────────────────────────────────────
  // For paid courses we verify the session cookie + subscription BEFORE
  // fetching the lesson, so the response HTML never contains the step
  // data for unauthorized requests. Anyone hitting the URL directly
  // gets a 302 back to the course detail page; no leak.
  let sessionUid: string | null = null;
  if (!course.freeTier) {
    const session = await getServerSession();
    if (!session) {
      redirect(`/courses/${courseId}?locked=1`);
    }
    const active = await hasActiveServerSubscription(session.uid);
    if (!active) {
      redirect(`/courses/${courseId}?locked=1`);
    }
    sessionUid = session.uid;
  } else {
    // Free courses still need the session to enforce progression order
    // (so a returning student can't deep-link to lesson 5 before finishing
    // 1-4). Anonymous users get the catalog redirect — we don't want to
    // ship lesson bodies to unauthenticated browsers.
    const session = await getServerSession();
    if (session) sessionUid = session.uid;
  }

  // Lesson order + paywall both pass; now look up the lesson.
  const lesson = await getLesson(courseId, lessonId);
  if (!lesson) notFound();

  const allLessons = await listLessons(courseId);
  const idx = allLessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) notFound();

  // ─── Progressive-unlock gate ─────────────────────────────────────────
  // Students can replay any completed lesson and access the next-up
  // lesson (the first uncompleted one). Anything further is locked until
  // they finish the prerequisites. Anonymous viewers see only lesson 1.
  const enrollment = sessionUid
    ? await getServerEnrollment(sessionUid, courseId)
    : null;
  const completed = new Set(enrollment?.completedLessonIds ?? []);
  // First uncompleted lesson index = the one the student is currently
  // allowed to start (their "next up").
  const firstUncompletedIdx = allLessons.findIndex((l) => !completed.has(l.id));
  // If everything is complete, firstUncompletedIdx === -1; in that case
  // every index is permitted (free replay across the whole course).
  const maxAllowedIdx =
    firstUncompletedIdx === -1 ? allLessons.length - 1 : firstUncompletedIdx;
  if (idx > maxAllowedIdx) {
    redirect(`/courses/${courseId}?locked-step=1`);
  }

  const nextLessonId =
    idx >= 0 && idx + 1 < allLessons.length ? allLessons[idx + 1].id : null;

  return (
    <LearnLessonClient
      courseId={courseId}
      lessonId={lessonId}
      lessonTitle={lesson.title}
      lessonObjective={lesson.objective}
      steps={lesson.steps}
      instructorId={course.instructorId}
      nextLessonId={nextLessonId}
      freeTier={course.freeTier}
      courseTitle={course.title}
    />
  );
}
