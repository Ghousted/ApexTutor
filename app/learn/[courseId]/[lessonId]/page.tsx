import { notFound, redirect } from "next/navigation";
import { getCourse, getLesson, listLessons } from "@/lib/courses";
import { getServerSession, hasActiveServerSubscription } from "@/lib/serverAuth";
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
  if (!course.freeTier) {
    const session = await getServerSession();
    if (!session) {
      // Not signed in — punt to the catalog. The course detail page
      // shows the paywall and a clearer route to sign-in / upgrade.
      redirect(`/courses/${courseId}?locked=1`);
    }
    const active = await hasActiveServerSubscription(session.uid);
    if (!active) {
      redirect(`/courses/${courseId}?locked=1`);
    }
  }

  // Only reached when the course is free OR the user is verified-active.
  const lesson = await getLesson(courseId, lessonId);
  if (!lesson) notFound();

  // Look up the next lesson in this course (for the "Next lesson" CTA).
  const allLessons = await listLessons(courseId);
  const idx = allLessons.findIndex((l) => l.id === lessonId);
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
