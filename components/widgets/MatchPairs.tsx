"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { MatchPairsWidget } from "@/lib/widgetParser";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";

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
  const [submitted, setSubmitted] = useState(false);
  const { playCorrect, playWrong } = useUiSounds();
  // Per-slot "just landed" pulse state — keyed by right-id with the result
  // ("good"/"bad") so we can drive a brief CSS animation on landing.
  const [landed, setLanded] = useState<Record<string, "good" | "bad" | null>>({});

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

  const handleDragStart = (_e: DragStartEvent) => {
    // no-op (left in case we wire a "now dragging" cue later)
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const leftId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const right = rightItems.find((r) => r.id === overId);
    if (!right) return;
    const isCorrectDrop = right.correctLeftId === leftId;

    if (isCorrectDrop) {
      // Snap it in place + give a quick positive cue.
      playCorrect();
      hapticTap();
      setPlacements((prev) => {
        const next = { ...prev };
        // Clear any other left previously on this slot.
        for (const k of Object.keys(next)) {
          if (next[k] === overId) next[k] = null;
        }
        next[leftId] = overId;
        return next;
      });
      flashLanded(overId, "good");
    } else {
      // Wrong placement — bounce back. We don't store the placement at all
      // so the left item visibly returns to the column.
      playWrong();
      hapticError();
      flashLanded(overId, "bad");
    }
  };

  /** Brief visual pulse on a drop slot after a landing attempt. */
  const flashLanded = (slotId: string, kind: "good" | "bad") => {
    setLanded((prev) => ({ ...prev, [slotId]: kind }));
    setTimeout(() => {
      setLanded((prev) => ({ ...prev, [slotId]: null }));
    }, 500);
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

  return (
    <div ref={cardRef} className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Drag &amp; match
      </p>
      <p className="text-base font-medium text-canvas-white mb-4">
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
                  landed={landed[r.id] ?? null}
                />
              );
            })}
          </div>
        </div>

      </DndContext>

      <div className="flex items-center justify-between mt-4 gap-2">
        <p className="text-xs text-ash-gray">
          {submitted
            ? `${correctCount} of ${leftItems.length} correct`
            : `${Object.values(placements).filter(Boolean).length} of ${leftItems.length} placed`}
        </p>
        <div className="flex items-center gap-1.5">
          {!submitted && Object.values(placements).some(Boolean) && (
            <button
              onClick={() =>
                setPlacements(
                  Object.fromEntries(leftItems.map((l) => [l.id, null]))
                )
              }
              className="text-xs px-2.5 py-1 rounded-md text-ash-gray hover:text-canvas-white hover:bg-iron transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleCheck}
            disabled={submitted || !allPlaced}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5",
            submitted
              ? allCorrect
                ? "bg-canvas-white text-void-black"
                : "bg-canvas-white text-void-black"
              : "bg-canvas-white hover:opacity-90 text-void-black disabled:bg-iron disabled:text-ash-gray"
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
    </div>
  );
}

function DraggableLeft({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });
  // Move the original element under the cursor. Previously we used a
  // DragOverlay, but the overlay had different padding than the source so
  // the visual offset drifted away from the cursor. Applying the transform
  // directly keeps the dragged element pixel-aligned with the pointer.
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // While dragging, lift above adjacent rows + drop targets.
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "h-12 px-3 flex items-center gap-2 bg-iron border border-[var(--border-subtle)] rounded-lg text-sm font-medium text-canvas-white transition-colors",
        isDragging
          ? "cursor-grabbing shadow-md ring-1 ring-canvas-white/40"
          : "cursor-grab hover:border-[var(--border-strong)]"
      )}
    >
      <GripVertical className="w-3.5 h-3.5 text-canvas-white shrink-0" />
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
  landed,
}: {
  id: string;
  rightText: string;
  placedLeft?: string;
  submitted: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  /** "good" or "bad" briefly after a landing attempt; null otherwise. */
  landed: "good" | "bad" | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-12 px-3 flex items-center gap-2 rounded-lg border-2 transition-colors text-sm",
        !placedLeft && !isOver && "border-dashed border-[var(--border-subtle)] bg-coal",
        !placedLeft && isOver && "border-[var(--border-strong)] bg-iron",
        placedLeft && !submitted && "border-canvas-white bg-iron",
        isCorrect && "border-emerald-400 bg-coal",
        isWrong && "border-rose-400 bg-coal",
        landed === "good" && "ring-2 ring-canvas-white/70 animate-pulse",
        landed === "bad" && "ring-2 ring-rose-400/70"
      )}
    >
      {placedLeft && (
        <span className="font-medium text-canvas-white mr-1">{placedLeft}</span>
      )}
      <span className="flex-1 text-right text-ash-gray">→ {rightText}</span>
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
