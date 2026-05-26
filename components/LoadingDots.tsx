"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Brand-consistent three-dot loader. Replaces generic Loader2 spinners
 * where space allows. Honours prefers-reduced-motion.
 *
 *   <LoadingDots />            // default — small white dots
 *   <LoadingDots size="lg" />  // hero/page-level
 *   <LoadingDots label="Loading lesson…" />  // with a caption underneath
 */
export default function LoadingDots({
  size = "md",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const dotPx = size === "sm" ? 5 : size === "lg" ? 10 : 7;
  const gapPx = size === "sm" ? 4 : size === "lg" ? 8 : 6;

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center gap-3",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
    >
      <div className="flex items-center" style={{ gap: gapPx }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="rounded-full bg-canvas-white"
            style={{ width: dotPx, height: dotPx }}
            animate={reduced ? undefined : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.18,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {label && (
        <p className="text-xs text-ash-gray tracking-wide">{label}</p>
      )}
    </div>
  );
}
