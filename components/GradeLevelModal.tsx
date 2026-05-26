"use client";

import { useState } from "react";
import { Loader2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * One-shot modal shown on the very first chat session of an account.
 * Captures grade level so the curriculum can pick an appropriate first
 * lesson. No "skip" option — knowing the grade is required to drive the
 * lesson plan, which is the whole point of this product.
 */
export default function GradeLevelModal({
  open,
  onSubmit,
}: {
  open: boolean;
  onSubmit: (grade: number) => Promise<void> | void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (picked === null) return;
    setSubmitting(true);
    try {
      await onSubmit(picked);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative bg-coal rounded-[14px] shadow-2xl w-full max-w-md p-7">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-[14px] bg-iron text-canvas-white">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-canvas-white text-center mb-2">
          What grade are you in?
        </h2>
        <p className="text-sm text-ash-gray text-center mb-6">
          We&apos;ll pick the right starting lesson for your level. You can
          always speed up or slow down later.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setPicked(g)}
              disabled={submitting}
              className={cn(
                "py-3 rounded-lg text-sm font-medium transition-all border",
                picked === g
                  ? "bg-canvas-white text-void-black border-[var(--border-strong)] shadow"
                  : "bg-coal text-canvas-white/90 border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
              )}
            >
              Grade {g}
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={picked === null || submitting}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium text-sm transition-all",
            picked === null
              ? "bg-iron text-ash-gray cursor-not-allowed"
              : "bg-canvas-white hover:opacity-90 text-void-black"
          )}
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Start learning
        </button>
      </div>
    </div>
  );
}
