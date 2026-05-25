import AdminCourseDetailClient from "./AdminCourseDetailClient";

export const metadata = { title: "Edit course · Admin" };

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminCourseDetailClient courseId={id} />;
}
