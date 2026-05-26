"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Soft drifting white dots — used as a 2s decoration around a celebration
 * focal point (the tutor avatar on lesson complete, the lesson-complete
 * card, etc). Pure cosmetic.
 *
 * Mount only when you want the burst; unmount removes it. Pointer-events
 * none so it never blocks clicks. Honours prefers-reduced-motion (renders
 * nothing).
 */
export default function AmbientParticles({
  count = 14,
  duration = 2,
  className,
  spreadRadius = 1.4,
}: {
  count?: number;
  duration?: number;
  className?: string;
  /** How far particles drift relative to the container size. */
  spreadRadius?: number;
}) {
  const reduced = useReducedMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        startX: 50 + (Math.random() - 0.5) * 20,
        startY: 50 + (Math.random() - 0.5) * 20,
        endX: 50 + (Math.random() - 0.5) * 100 * spreadRadius,
        endY: 50 + (Math.random() - 0.5) * 100 * spreadRadius - 30,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 0.4,
      })),
    [count, spreadRadius]
  );
  if (reduced) return null;

  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 pointer-events-none overflow-visible", className)}
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-canvas-white"
          style={{
            left: `${p.startX}%`,
            top: `${p.startY}%`,
            width: p.size,
            height: p.size,
          }}
          initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
          animate={{
            opacity: [0, 0.95, 0],
            scale: [0.4, 1, 0.6],
            x: `${p.endX - p.startX}%`,
            y: `${p.endY - p.startY}%`,
          }}
          transition={{
            duration,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
