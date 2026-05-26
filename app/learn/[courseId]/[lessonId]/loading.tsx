import { Skeleton } from "@/components/ui/skeleton";
import LoadingDots from "@/components/LoadingDots";

export default function LearnLessonLoading() {
  return (
    <div className="min-h-screen bg-void-black flex flex-col">
      {/* Header skeleton */}
      <header className="px-4 md:px-8 py-4 border-b border-[var(--border-subtle)]">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-md" />
          <Skeleton className="w-8 h-8 rounded-md" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        </div>
      </header>

      {/* Stage — centered loading state with branded dots */}
      <main className="flex-1 flex items-center justify-center px-4">
        <LoadingDots size="lg" label="Loading your lesson…" />
      </main>
    </div>
  );
}
