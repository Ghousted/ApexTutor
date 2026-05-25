import Link from "next/link";
import { listCourses } from "@/lib/courses";
import Logo from "@/components/Logo";
import CoursesCatalogClient, {
  type CatalogCourse,
} from "./CoursesCatalogClient";

export const metadata = { title: "Courses · Apex Tutor" };

// Always re-fetch courses so newly-published / edited courses appear
// immediately. The catalog is tiny — no need to ISR.
export const dynamic = "force-dynamic";

export default async function CoursesCatalogPage() {
  const courses = await listCourses({ publishedOnly: true });

  // Strip server-only fields (Dates) before passing to the client filter.
  const catalog: CatalogCourse[] = courses.map((c) => ({
    id: c.id,
    title: c.title,
    subject: c.subject,
    description: c.description,
    gradeBand: c.gradeBand,
    instructorId: c.instructorId,
    lessonCount: c.lessonCount,
    freeTier: c.freeTier,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-3">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-10 md:py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-ink mb-3">
            Courses
          </h1>
          <p className="text-slate-500 text-sm md:text-base max-w-xl mx-auto">
            Each course is a linear, hands-on sequence taught by one of our
            tutors. Pick one to start learning.
          </p>
        </div>

        <CoursesCatalogClient courses={catalog} />
      </section>
    </main>
  );
}
