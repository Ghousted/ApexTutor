import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming-aware loading state for /courses. Renders the catalog's chrome
 * (header, title, filter row) instantly, then 4 skeleton cards. Replaces
 * a blank screen during the Firestore listCourses() round-trip.
 */
export default function CoursesLoading() {
  return (
    <main className="min-h-screen bg-void-black">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)]">
        <div className="h-6 w-32 skeleton" />
      </header>

      <section className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-12 flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Filter chips placeholder */}
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </section>
    </main>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-[14px] p-6 bg-coal border border-[var(--border-subtle)]">
      <div className="flex items-start gap-4 mb-4">
        <Skeleton className="w-12 h-12 rounded-md" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-5" />
      <div className="flex gap-2 mb-5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-4 w-40" />
    </div>
  );
}
