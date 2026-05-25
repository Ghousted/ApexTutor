"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Check, GripVertical } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { MatchPairsWidget } from "@/lib/widgetParser";

/**
 * Drag-and-drop matching game. Left column shows prompts (e.g. equations);
 * right column shows possible answers shuffled. Student drags each prompt
 * onto its correct answer. GSAP animates entry + success.
 */
export default function MatchPairs({
  widget,
  onAnswer,
}: {
  widget: MatchPairsWidget;
  onAnswer: (correctCount: number, total: number) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Right-column items in a shuffled order so the student can't pattern-match.
  const rightItems = useMemo(
    () => shuffle(widget.pairs.map((p, i) => ({ id: `r${i}`, text: p.right, correctLeftId: `l${i}` }))),
    [widget.pairs]
  );
  const leftItems = useMemo(
    () => widget.pairs.map((p, i) => ({ id: `l${i}`, text: p.left })),
    [widget.pairs]
  );

  // Map left-id → which right-id it's been dropped on (null = unplaced).
  const [placements, setPlacements] = useState<Record<string, string | null>>(
    () => Object.fromEntries(leftItems.map((l) => [l.id, null]))
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const leftId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setPlacements((prev) => {
      const next = { ...prev };
      // Clear any other left-id previously placed on this right slot.
      if (overId) {
        for (const k of Object.keys(next)) {
          if (next[k] === overId) next[k] = null;
        }
      }
      next[leftId] = overId;
      return next;
    });
  };

  const allPlaced = Object.values(placements).every((v) => v !== null);
  const correctCount = leftItems.reduce((acc, l) => {
    const rid = placements[l.id];
    if (!rid) return acc;
    const right = rightItems.find((r) => r.id === rid);
    return right?.correctLeftId === l.id ? acc + 1 : acc;
  }, 0);
  const allCorrect = correctCount === leftItems.length;

  const handleCheck = () => {
    if (submitted) return;
    setSubmitted(true);
    if (!cardRef.current) return;
    if (allCorrect) {
      gsap.fromTo(
        cardRef.current,
        { scale: 1 },
        { scale: 1.04, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }
      );
    } else {
      gsap.fromTo(
        cardRef.current,
        { x: 0 },
        { x: 10, duration: 0.06, repeat: 5, yoyo: true, ease: "power1.inOut" }
      );
    }
    setTimeout(() => onAnswer(correctCount, leftItems.length), 900);
  };

  // For the DragOverlay, find the dragging item's text.
  const draggingText = useMemo(() => {
    if (!draggingId) return null;
    return leftItems.find((l) => l.id === draggingId)?.text ?? null;
  }, [draggingId, leftItems]);

  return (
    <div ref={cardRef} className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-2">
        Drag &amp; match
      </p>
      <p className="text-base font-medium text-ink mb-4">
        {widget.prompt || "Drag each item on the left to its match on the right."}
      </p>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-2 gap-3">
          {/* Left column — draggable items, hidden once placed. */}
          <div className="flex flex-col gap-2">
            {leftItems.map((l) => {
              const placed = placements[l.id] !== null;
              if (placed) return <div key={l.id} className="h-12" />;
              return <DraggableLeft key={l.id} id={l.id} text={l.text} />;
            })}
          </div>

          {/* Right column — drop targets. */}
          <div className="flex flex-col gap-2">
            {rightItems.map((r) => {
              const placedLeftId = Object.entries(placements).find(
                ([, rid]) => rid === r.id
              )?.[0];
              const placedLeft = placedLeftId
                ? leftItems.find((l) => l.id === placedLeftId)
                : undefined;
              const isCorrect = placedLeft?.id === r.correctLeftId;
              return (
                <DropSlot
                  key={r.id}
                  id={r.id}
                  rightText={r.text}
                  placedLeft={placedLeft?.text}
                  submitted={submitted}
                  isCorrect={submitted && isCorrect}
                  isWrong={submitted && placedLeft !== undefined && !isCorrect}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {draggingText ? (
            <div className="px-3 py-2.5 bg-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg cursor-grabbing">
              {draggingText}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-slate-500">
          {submitted
            ? `${correctCount} of ${leftItems.length} correct`
            : `${Object.values(placements).filter(Boolean).length} of ${leftItems.length} placed`}
        </p>
        <button
          onClick={handleCheck}
          disabled={submitted || !allPlaced}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
            submitted
              ? allCorrect
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
              : "bg-ink hover:bg-slate-800 text-white disabled:bg-slate-200 disabled:text-slate-400"
          )}
        >
          {submitted ? (
            allCorrect ? (
              <>
                <Check className="w-3.5 h-3.5" /> All right!
              </>
            ) : (
              "Some off"
            )
          ) : (
            "Check"
          )}
        </button>
      </div>
    </div>
  );
}

function DraggableLeft({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "h-12 px-3 flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-sm font-medium text-ink transition-colors cursor-grab",
        isDragging && "opacity-30"
      )}
    >
      <GripVertical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      <span className="flex-1 text-left truncate">{text}</span>
    </button>
  );
}

function DropSlot({
  id,
  rightText,
  placedLeft,
  submitted,
  isCorrect,
  isWrong,
}: {
  id: string;
  rightText: string;
  placedLeft?: string;
  submitted: boolean;
  isCorrect: boolean;
  isWrong: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-12 px-3 flex items-center gap-2 rounded-xl border-2 transition-colors text-sm",
        !placedLeft && !isOver && "border-dashed border-slate-200 bg-slate-50",
        !placedLeft && isOver && "border-indigo-400 bg-indigo-50",
        placedLeft && !submitted && "border-indigo-200 bg-white",
        isCorrect && "border-emerald-400 bg-emerald-50",
        isWrong && "border-rose-400 bg-rose-50"
      )}
    >
      {placedLeft && (
        <span className="font-medium text-indigo-700 mr-1">{placedLeft}</span>
      )}
      <span className="flex-1 text-right text-slate-600">→ {rightText}</span>
    </div>
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
