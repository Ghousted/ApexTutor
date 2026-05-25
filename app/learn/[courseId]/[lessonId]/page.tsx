import { notFound } from "next/navigation";
import { getCourse, getLesson, listLessons } from "@/lib/courses";
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
    />
  );
}
