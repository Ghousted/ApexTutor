import { Suspense } from "react";
import InstructorsPageClient from "./InstructorsPageClient";

export default function InstructorsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white flex items-center justify-center text-slate-400">
          Loading...
        </div>
      }
    >
      <InstructorsPageClient />
    </Suspense>
  );
}
