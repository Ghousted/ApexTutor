"use client";

import { BookOpen, CheckCircle2, ArrowRight } from "lucide-react";
import type { Lesson } from "@/lib/lessons";

/**
 * Small banner shown above the chat indicating the current lesson. Doubles
 * as the "lesson complete" celebration when triggered by the AI marker.
 */
export default function LessonHeader({
  lesson,
  completed,
  onNext,
}: {
  lesson: Lesson;
  completed: boolean;
  onNext: () => void;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 transition-colors ${
        completed
          ? "bg-emerald-50 border border-emerald-200"
          : "bg-indigo-50 border border-indigo-100"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          completed ? "bg-emerald-500 text-white" : "bg-indigo-500 text-white"
        }`}
      >
        {completed ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <BookOpen className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[10px] uppercase tracking-wider font-semibold ${
            completed ? "text-emerald-700" : "text-indigo-700"
          }`}
        >
          {completed ? "Lesson complete" : "Today's lesson"}
        </p>
        <p className="text-sm font-semibold text-ink truncate">
          {lesson.title}
        </p>
      </div>
      {completed && (
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-full transition-colors shrink-0"
        >
          Next lesson
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
