"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { SortSequenceWidget } from "@/lib/widgetParser";

/**
 * Drag-to-sequence game. Receives `items[]` in the correct order, shuffles
 * them for display, and the student drags rows up/down until the order
 * matches. GSAP handles success-state animation (green flash on correct
 * cards) and wrong-state shake.
 *
 * Uses @dnd-kit for the drag mechanics (accessibility + touch) and GSAP for
 * the visual polish.
 */
export default function SortSequence({
  widget,
  onAnswer,
}: {
  widget: SortSequenceWidget;
  onAnswer: (correctCount: number, total: number) => void;
}) {
  const correctOrder = widget.items;

  // Initial shuffled order. Memoized so it stays stable across renders.
  const initial = useMemo(() => {
    const shuffled = shuffle(
      correctOrder.map((label, i) => ({ id: `i${i}`, label, correctIndex: i }))
    );
    // Edge case: if the shuffle happens to already match, swap two so the
    // student actually has work to do.
    if (shuffled.every((it, idx) => it.correctIndex === idx) && shuffled.length > 1) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    return shuffled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctOrder.join("|")]);

  const [items, setItems] = useState(initial);
  const [submitted, setSubmitted] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // Entry animation.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.4)" }
    );
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: "opacity,y" });
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    if (submitted) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((it) => it.id === active.id);
    const newIdx = items.findIndex((it) => it.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setItems((prev) => arrayMove(prev, oldIdx, newIdx));
  };

  const correctCount = items.reduce(
    (acc, it, idx) => (it.correctIndex === idx ? acc + 1 : acc),
    0
  );
  const allCorrect = correctCount === items.length;

  const handleCheck = () => {
    if (submitted) return;
    setSubmitted(true);

    // GSAP feedback per item: green flash for correct, red flash for wrong.
    items.forEach((it, idx) => {
      const el = itemRefs.current[it.id];
      if (!el) return;
      const ok = it.correctIndex === idx;
      gsap.fromTo(
        el,
        { backgroundColor: ok ? "#ecfdf5" : "#fef2f2" },
        {
          backgroundColor: ok ? "#ffffff" : "#ffffff",
          duration: 1.2,
          ease: "power2.out",
        }
      );
    });

    // Whole-card reaction.
    if (cardRef.current) {
      if (allCorrect) {
        gsap.fromTo(
          cardRef.current,
          { scale: 1 },
          { scale: 1.03, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }
        );
      } else {
        gsap.fromTo(
          cardRef.current,
          { x: 0 },
          { x: 8, duration: 0.06, repeat: 5, yoyo: true, ease: "power1.inOut" }
        );
      }
    }

    setTimeout(() => onAnswer(correctCount, items.length), 1000);
  };

  return (
    <div ref={cardRef} className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Put in order
      </p>
      <p className="text-base font-medium text-canvas-white mb-4">
        {widget.prompt ||
          "Drag the rows up or down so they appear in the correct order, top to bottom."}
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {items.map((it, idx) => (
              <SortableRow
                key={it.id}
                id={it.id}
                index={idx}
                label={it.label}
                submitted={submitted}
                isCorrect={submitted && it.correctIndex === idx}
                isWrong={submitted && it.correctIndex !== idx}
                refSetter={(el) => {
                  itemRefs.current[it.id] = el;
                }}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-ash-gray">
          {submitted
            ? `${correctCount} of ${items.length} in place`
            : "Drag rows to reorder, then check."}
        </p>
        <button
          onClick={handleCheck}
          disabled={submitted}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
            submitted
              ? allCorrect
                ? "bg-canvas-white text-void-black"
                : "bg-canvas-white text-void-black"
              : "bg-canvas-white hover:opacity-90 text-void-black"
          )}
        >
          {submitted ? (
            allCorrect ? (
              <>
                <Check className="w-3.5 h-3.5" /> Perfect order!
              </>
            ) : (
              "Some out of place"
            )
          ) : (
            "Check"
          )}
        </button>
      </div>
    </div>
  );
}

function SortableRow({
  id,
  index,
  label,
  submitted,
  isCorrect,
  isWrong,
  refSetter,
}: {
  id: string;
  index: number;
  label: string;
  submitted: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  refSetter: (el: HTMLLIElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  // Compose refs: @dnd-kit's setNodeRef + parent's ref for GSAP animation.
  const setRefs = (el: HTMLLIElement | null) => {
    setNodeRef(el);
    refSetter(el);
  };

  return (
    <li
      ref={setRefs}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-lg border-2 bg-coal text-sm font-medium text-canvas-white",
        !submitted && "border-[var(--border-subtle)]",
        submitted && isCorrect && "border-emerald-400",
        submitted && isWrong && "border-rose-400",
        isDragging && "shadow-lg ring-2 ring-canvas-white z-10"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        disabled={submitted}
        className="p-1 text-ash-gray hover:text-canvas-white cursor-grab disabled:cursor-not-allowed"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span
        className={cn(
          "w-6 h-6 rounded-full bg-iron text-xs font-bold flex items-center justify-center shrink-0",
          submitted && isCorrect && "bg-canvas-white text-void-black",
          submitted && isWrong && "bg-iron text-canvas-white"
        )}
      >
        {index + 1}
      </span>
      <span className="flex-1">{label}</span>
    </li>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
