"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";

// Lottie's runtime is ~80KB — dynamic-import so it doesn't ship in the
// initial bundle. Renders nothing during the load (the celebration looks
// fine without it; this is decorative-only juice).
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * One-shot Lottie animation overlaid on top of a celebration moment.
 * Designed to fire WITH our confetti, not instead of it — confetti is
 * the broad gesture, Lottie is the curated visual flourish.
 *
 * Drop CC-licensed monochrome JSON files into /public/lottie/*.json and
 * reference by filename. If the file is missing the component silently
 * renders nothing — confetti still fires.
 */
export default function LottieCelebration({
  src,
  size = 240,
  loop = false,
  className,
  onComplete,
}: {
  /** Path to a Lottie JSON file under /public, e.g. "/lottie/confetti.json". */
  src: string;
  size?: number;
  loop?: boolean;
  className?: string;
  onComplete?: () => void;
}) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, reduced]);

  if (reduced || failed || !data) return null;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <Lottie
        animationData={data}
        loop={loop}
        autoplay
        onComplete={onComplete}
        rendererSettings={{
          preserveAspectRatio: "xMidYMid meet",
        }}
      />
    </div>
  );
}
