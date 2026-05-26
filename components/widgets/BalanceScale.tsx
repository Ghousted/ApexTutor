"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { motion } from "motion/react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";
import { pickEncouragement } from "@/lib/encouragement";

/**
 * Two-pan balance scale — the student drags weighted items onto the right
 * pan until the right-side total equals the fixed left side. Pan tilt is
 * driven by sum(right) - sum(left) so the scale visibly responds to every
 * drop.
 *
 * Use cases: simple algebra ("balance the equation"), units / conversions,
 * relative weight reasoning.
 */
export default function BalanceScale({
  prompt,
  leftFixed,
  options,
  onAnswer,
  onWrong,
}: {
  prompt?: string;
  leftFixed: Array<{ label: string; weight: number }>;
  options: Array<{ id: string; label: string; weight: number }>;
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Multiset of option-ids currently on the right pan. Same option can be
  // placed multiple times (so "1+1+1" works for "3").
  const [placed, setPlaced] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<"correct" | "wrong" | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const lastEncIdx = useRef<number | undefined>(undefined);
  const { playCorrect, playWrong } = useUiSounds();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 24, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.4)" }
    );
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: "opacity,y,scale" });
    };
  }, []);

  const leftSum = useMemo(
    () => leftFixed.reduce((s, x) => s + x.weight, 0),
    [leftFixed]
  );
  const rightSum = useMemo(() => {
    return placed.reduce((sum, id) => {
      const o = options.find((x) => x.id === id);
      return sum + (o?.weight ?? 0);
    }, 0);
  }, [placed, options]);

  // Tilt angle: -10° when left is heavier, +10° when right is heavier,
  // 0 at balance. Capped so an extreme overload doesn't flip the scale
  // off-screen.
  const diff = rightSum - leftSum;
  const tiltDeg = Math.max(-12, Math.min(12, diff * 4));
  const isBalanced = diff === 0 && placed.length > 0;

  const handleDragEnd = (e: DragEndEvent) => {
    if (submitted === "correct") return;
    if (e.over?.id === "right-pan") {
      const optId = String(e.active.id);
      setPlaced((prev) => [...prev, optId]);
    }
  };

  const handleCheck = () => {
    if (submitted === "correct") return;
    if (isBalanced) {
      setSubmitted("correct");
      playCorrect();
      hapticTap();
      const rect = cardRef.current?.getBoundingClientRect();
      celebrateBurst({
        x: (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) / window.innerWidth,
        y: (rect ? rect.top + rect.height / 2 : window.innerHeight / 2) / window.innerHeight,
      });
      setTimeout(() => onAnswer(true), 900);
    } else {
      setSubmitted("wrong");
      playWrong();
      hapticError();
      onWrong?.();
      const { line, index } = pickEncouragement("quiz", lastEncIdx.current);
      lastEncIdx.current = index;
      setEncouragement(line);
      setTimeout(() => setSubmitted(null), 800);
    }
  };

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Balance the scale
      </p>
      <p className="text-base font-medium text-canvas-white mb-4 leading-relaxed">
        {prompt ?? "Drag weights onto the right pan until both sides balance."}
      </p>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="relative h-48 sm:h-56 mb-4">
          {/* Stand */}
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-1 h-32 bg-iron" />
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-20 h-2 bg-iron rounded-full" />

          {/* Beam — rotates around its midpoint */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: 128, transformOrigin: "50% 50%" }}
            animate={{ rotate: isBalanced ? 0 : tiltDeg }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }}
          >
            {/* Visual beam */}
            <div className="relative w-72 sm:w-80 h-1.5 bg-canvas-white rounded-full" />
            {/* Left pan */}
            <Pan
              label="left"
              items={leftFixed.map((x, i) => ({
                key: `lf-${i}`,
                label: x.label,
                weight: x.weight,
              }))}
              sum={leftSum}
              positionClass="-left-2 -translate-x-1/2 -top-1"
            />
            {/* Right pan — droppable */}
            <RightPan
              items={placed.map((id, i) => {
                const o = options.find((x) => x.id === id);
                return {
                  key: `${id}-${i}`,
                  label: o?.label ?? "?",
                  weight: o?.weight ?? 0,
                };
              })}
              sum={rightSum}
            />
          </motion.div>
        </div>

        {/* Tile pool */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {options.map((o) => (
            <DraggableWeight
              key={o.id}
              id={o.id}
              label={o.label}
              weight={o.weight}
            />
          ))}
        </div>
      </DndContext>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ash-gray">
          Right ={" "}
          <span className="font-semibold text-canvas-white">{rightSum}</span> ·
          Target ={" "}
          <span className="font-semibold text-canvas-white">{leftSum}</span>
        </p>
        <div className="flex items-center gap-1.5">
          {placed.length > 0 && submitted !== "correct" && (
            <button
              onClick={() => setPlaced([])}
              className="text-xs px-2.5 py-1 rounded-md text-ash-gray hover:text-canvas-white hover:bg-iron transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleCheck}
            disabled={submitted === "correct" || placed.length === 0}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-opacity flex items-center gap-1.5",
              submitted === "correct"
                ? "bg-canvas-white text-void-black"
                : "bg-canvas-white hover:opacity-90 text-void-black disabled:bg-iron disabled:text-ash-gray"
            )}
          >
            {submitted === "correct" ? (
              <>
                <Check className="w-3.5 h-3.5" /> Balanced
              </>
            ) : (
              "Check"
            )}
          </button>
        </div>
      </div>
      {encouragement && submitted !== "correct" && (
        <p className="text-xs text-ash-gray mt-3">{encouragement}</p>
      )}
    </div>
  );
}

function Pan({
  label,
  items,
  sum,
  positionClass,
}: {
  label: string;
  items: Array<{ key: string; label: string; weight: number }>;
  sum: number;
  positionClass: string;
}) {
  return (
    <div className={cn("absolute", positionClass)}>
      {/* Hang strings + plate */}
      <div className="relative flex flex-col items-center">
        <span className="block w-px h-8 bg-canvas-white/40" />
        <div className="w-28 sm:w-32 h-12 rounded-b-full bg-iron border border-[var(--border-strong)] flex flex-wrap items-center justify-center gap-0.5 px-2 overflow-hidden">
          {items.length === 0 ? (
            <span className="text-[10px] text-ash-gray">{label}</span>
          ) : (
            items.map((it) => (
              <span
                key={it.key}
                title={`${it.label} (${it.weight})`}
                className="text-[10px] font-mono text-canvas-white bg-coal border border-[var(--border-subtle)] rounded px-1.5 py-0.5"
              >
                {it.label}
              </span>
            ))
          )}
        </div>
        <p className="text-[10px] text-ash-gray mt-1">Σ {sum}</p>
      </div>
    </div>
  );
}

function RightPan({
  items,
  sum,
}: {
  items: Array<{ key: string; label: string; weight: number }>;
  sum: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "right-pan" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute -right-2 translate-x-1/2 -top-1 transition-transform",
        isOver && "scale-105"
      )}
    >
      <div className="relative flex flex-col items-center">
        <span className="block w-px h-8 bg-canvas-white/40" />
        <div
          className={cn(
            "w-28 sm:w-32 h-12 rounded-b-full border flex flex-wrap items-center justify-center gap-0.5 px-2 overflow-hidden",
            isOver
              ? "bg-canvas-white/10 border-canvas-white"
              : "bg-iron border-[var(--border-strong)]"
          )}
        >
          {items.length === 0 ? (
            <span className="text-[10px] text-ash-gray">drop here</span>
          ) : (
            items.map((it) => (
              <span
                key={it.key}
                title={`${it.label} (${it.weight})`}
                className="text-[10px] font-mono text-canvas-white bg-coal border border-[var(--border-subtle)] rounded px-1.5 py-0.5"
              >
                {it.label}
              </span>
            ))
          )}
        </div>
        <p className="text-[10px] text-ash-gray mt-1">Σ {sum}</p>
      </div>
    </div>
  );
}

function DraggableWeight({
  id,
  label,
  weight,
}: {
  id: string;
  label: string;
  weight: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 30 : undefined,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium select-none",
        isDragging
          ? "bg-canvas-white text-void-black border-canvas-white cursor-grabbing shadow-md"
          : "bg-iron text-canvas-white border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-grab"
      )}
    >
      <span>{label}</span>
      <span className="text-[10px] text-ash-gray font-mono">({weight})</span>
    </button>
  );
}
