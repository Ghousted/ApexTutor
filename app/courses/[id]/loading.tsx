import { Skeleton } from "@/components/ui/skeleton";

export default function CourseDetailLoading() {
  return (
    <main className="min-h-screen bg-void-black">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)]">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-24" />
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        {/* Hero */}
        <div className="flex items-start gap-4 mb-6">
          <Skeleton className="w-20 h-20 rounded-[14px]" />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>

        {/* About card */}
        <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-5 mb-6 flex flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Lessons */}
        <div className="bg-coal rounded-[14px] border border-[var(--border-subtle)] overflow-hidden mb-6">
          <header className="px-5 py-3 border-b border-[var(--border-subtle)]">
            <Skeleton className="h-3 w-40" />
          </header>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3">
                <Skeleton className="w-7 h-7 rounded-md" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Skeleton className="h-14 w-full" />
      </section>
    </main>
  );
}
