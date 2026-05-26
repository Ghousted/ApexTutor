"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Cursor-tracked 3D tilt wrapper. Drop around any card to get a subtle
 * "the surface is real" feel on hover. Tilt amount caps at ±4° so it
 * doesn't look cartoonish, and the spring is critically damped so the
 * card returns smoothly when the cursor leaves.
 *
 * Skipped entirely under prefers-reduced-motion.
 */
export default function TiltCard({
  children,
  className,
  maxTiltDeg = 4,
  scale = 1.01,
}: {
  children: React.ReactNode;
  className?: string;
  maxTiltDeg?: number;
  scale?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [0, 1], [maxTiltDeg, -maxTiltDeg]), {
    stiffness: 200,
    damping: 20,
  });
  const rotY = useSpring(useTransform(mx, [0, 1], [-maxTiltDeg, maxTiltDeg]), {
    stiffness: 200,
    damping: 20,
  });
  const s = useSpring(1, { stiffness: 200, damping: 20 });

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
    my.set(Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)));
    s.set(scale);
  };
  const onPointerLeave = () => {
    if (reduced) return;
    mx.set(0.5);
    my.set(0.5);
    s.set(1);
  };

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        rotateX: rotX,
        rotateY: rotY,
        scale: s,
        transformStyle: "preserve-3d",
        transformPerspective: 1000,
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
