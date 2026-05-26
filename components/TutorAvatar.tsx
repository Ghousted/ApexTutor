"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useInstructorAvatar } from "@/lib/instructorAvatar";
import DiceBearAvatar from "./DiceBearAvatar";

/**
 * Tutor face for the lesson player + lesson-complete card + anywhere a
 * professor's identity should be visible.
 *
 * Renders the admin-chosen DiceBear avatar (per instructor) inside a Motion
 * container that conveys mood/state via body language. The face itself is
 * static (it's an SVG portrait), so we lean on the container's scale,
 * rotation, and a halo ring to communicate:
 *
 *   - idle        → gentle 3-second breathing scale
 *   - talking     → subtle bobbing scale + a soft pulsing halo around the
 *                   avatar so the student visually sees the tutor is
 *                   speaking (since DiceBear can't move its mouth)
 *   - celebrating → quick bounce + sparkle particles burst
 *   - encouraging → slight head tilt + a friendly nod
 *   - thinking    → micro-sway, no halo
 *
 * Falls back gracefully when no instructor id is passed (renders a neutral
 * lorelei silhouette).
 */
export type TutorAvatarState =
  | "idle"
  | "talking"
  | "celebrating"
  | "encouraging"
  | "thinking";

export interface TutorAvatarProps {
  /** Instructor id from lib/instructors.ts. */
  instructorId?: string | null;
  state?: TutorAvatarState;
  size?: number;
  className?: string;
}

export default function TutorAvatar({
  instructorId,
  state = "idle",
  size = 56,
  className,
}: TutorAvatarProps) {
  const reduced = useReducedMotion();
  // Resolves admin's published DiceBear pick (or local draft, or source
  // default) for this instructor. Null only while the layers are loading.
  const resolved = useInstructorAvatar(instructorId);

  // ─── Body language by state ──────────────────────────────────────────
  const rotate =
    state === "encouraging" ? [-6, -2, -6] : state === "thinking" ? [-1.5, 1.5, -1.5] : 0;
  const scale =
    state === "celebrating"
      ? [1, 1.12, 0.96, 1.04, 1]
      : state === "talking"
        ? [1, 1.03, 1, 1.02, 1]
        : reduced
          ? 1
          : [1, 1.015, 1];

  const transitionScale =
    state === "celebrating"
      ? { duration: 0.7, ease: "easeOut" as const }
      : state === "talking"
        ? { duration: 0.55, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const };

  const transitionRotate =
    state === "encouraging"
      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const }
      : state === "thinking"
        ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 0.2 };

  return (
    <div
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* Talking halo — soft pulsing ring around the avatar so the student
          sees the tutor "speaking" even though the DiceBear face is static. */}
      {state === "talking" && !reduced && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border border-canvas-white/30"
          animate={{ scale: [1, 1.25, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <motion.div
        className="rounded-full overflow-hidden border border-[var(--border-strong)] bg-iron"
        style={{ width: size, height: size }}
        animate={{ rotate, scale }}
        transition={{ rotate: transitionRotate, scale: transitionScale }}
      >
        {resolved ? (
          <DiceBearAvatar
            style={resolved.style}
            seed={resolved.seed}
            size={size}
            rounded="full"
          />
        ) : (
          // Neutral placeholder while overrides are resolving — keeps layout
          // stable so the slot doesn't pop in.
          <div className="w-full h-full bg-iron" />
        )}
      </motion.div>

      {/* Celebrating sparkle — four dots pop around the head. */}
      {state === "celebrating" && !reduced && (
        <motion.svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute inset-0 pointer-events-none"
          style={{ width: size, height: size }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.7] }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <circle cx="82" cy="18" r="2.5" fill="#ffffff" />
          <circle cx="18" cy="20" r="2.2" fill="#ffffff" />
          <circle cx="14" cy="78" r="2" fill="#ffffff" />
          <circle cx="86" cy="78" r="2.4" fill="#ffffff" />
        </motion.svg>
      )}
    </div>
  );
}
