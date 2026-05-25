import LessonEditorClient from "./LessonEditorClient";

export const metadata = { title: "Edit lesson · Admin" };

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  return <LessonEditorClient courseId={id} lessonId={lessonId} />;
}
