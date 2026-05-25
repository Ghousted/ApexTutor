"use client";

import { BookOpen, Sparkles } from "lucide-react";
import type { Lesson } from "@/lib/lessons";
import type { Widget } from "@/lib/widgetParser";
import QuizCard from "./widgets/QuizCard";
import FractionBar from "./widgets/FractionBar";
import MatchPairs from "./widgets/MatchPairs";
import SortSequence from "./widgets/SortSequence";

/**
 * The right-side interactive panel of the chat. Default content is the
 * current lesson card. When the AI emits a widget marker, the latest widget
 * takes over the panel until either (a) the student interacts with it or
 * (b) a new widget replaces it.
 */
export default function Workspace({
  lesson,
  widget,
  studentName,
  onQuizAnswer,
  onFractionAnswer,
  onMatchAnswer,
  onSortAnswer,
}: {
  lesson: Lesson | null;
  widget: Widget | null;
  studentName: string | null;
  onQuizAnswer: (label: string, isCorrect: boolean) => void;
  onFractionAnswer: (filled: number, total: number, isCorrect: boolean) => void;
  onMatchAnswer: (correctCount: number, total: number) => void;
  onSortAnswer: (correctCount: number, total: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
      {/* Active widget (if any) — takes precedence over the default panel. */}
      {widget?.type === "quiz" && (
        <QuizCard widget={widget} onAnswer={onQuizAnswer} />
      )}
      {widget?.type === "fraction-bar" && (
        <FractionBar widget={widget} onAnswer={onFractionAnswer} />
      )}
      {widget?.type === "match-pairs" && (
        <MatchPairs widget={widget} onAnswer={onMatchAnswer} />
      )}
      {widget?.type === "sort-sequence" && (
        <SortSequence widget={widget} onAnswer={onSortAnswer} />
      )}
      {/* number-line widget queued for the next round. */}

      {/* Always-on lesson card. Sits below an active widget so the student
          still has the lesson context for reference. */}
      {lesson && <LessonCard lesson={lesson} studentName={studentName} />}

      {/* Empty state — no lesson yet (e.g., onboarding hasn't run). */}
      {!lesson && !widget && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
          <Sparkles className="w-6 h-6 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">
            Your tutor will show interactive practice here.
          </p>
        </div>
      )}
    </div>
  );
}

function LessonCard({
  lesson,
  studentName,
}: {
  lesson: Lesson;
  studentName: string | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
            Today&apos;s lesson
          </p>
          <p className="text-xs text-slate-500">
            Grade-level practice {studentName ? `for ${studentName}` : ""}
          </p>
        </div>
      </div>

      <h2 className="text-base font-bold text-ink mb-2">{lesson.title}</h2>
      <p className="text-sm text-slate-600 leading-relaxed mb-4">
        {lesson.objective}
      </p>

      <div className="border-t border-slate-100 pt-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Examples we&apos;ll cover
        </p>
        <ul className="flex flex-col gap-1.5">
          {lesson.keyExamples.map((ex, i) => (
            <li
              key={i}
              className="text-xs text-slate-600 flex items-start gap-1.5"
            >
              <span className="text-indigo-400 font-bold">·</span>
              <span>{ex}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
