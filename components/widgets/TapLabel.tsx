"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { celebrateBurst } from "@/lib/confetti";
import { useUiSounds } from "@/lib/sounds";
import { hapticTap, hapticError } from "@/lib/haptics";

/**
 * Tap-to-label widget — student sees an image with N hotspots and is
 * prompted, one at a time, to tap the correct region for a given label.
 * Strongest fit for science (body parts, cell organelles, planets) and
 * geography (capital cities, biomes), but also works for math diagrams
 * (label the vertices, find the hypotenuse).
 *
 * Hotspot coordinates are stored as 0..1 fractions of image width/height
 * so the same lesson works at any rendered size. Tap tolerance is ~10%
 * of the smaller image dimension.
 */
export default function TapLabel({
  prompt,
  imageUrl,
  hotspots,
  onAnswer,
  onWrong,
}: {
  prompt?: string;
  imageUrl: string;
  hotspots: Array<{ x: number; y: number; label: string }>;
  onAnswer: (isCorrect: boolean) => void;
  onWrong?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [askIdx, setAskIdx] = useState(0);
  // Track which hotspots have been correctly identified so we mark them.
  const [hit, setHit] = useState<Set<number>>(new Set());
  // Brief "wrong tap" pulse position so the student sees their tap registered.
  const [wrongPulse, setWrongPulse] = useState<{ x: number; y: number; key: number } | null>(null);
  // Image load state — distinguishes "loading" from "failed" so the
  // student gets a clearer message than a broken-image icon.
  const [imgState, setImgState] = useState<"loading" | "ok" | "error">("loading");
  const { playCorrect, playWrong } = useUiSounds();

  // Route external images through our proxy so hot-link protection on the
  // origin host doesn't break the lesson. Same-origin (relative) URLs
  // pass through unchanged.
  const proxiedUrl = useMemo(() => {
    if (!imageUrl) return "";
    if (imageUrl.startsWith("/")) return imageUrl;
    if (imageUrl.startsWith(window.location.origin)) return imageUrl;
    return `/api/img-proxy?url=${encodeURIComponent(imageUrl)}`;
  }, [imageUrl]);

  // Randomise the asking order so consecutive playthroughs feel different
  // without changing the underlying hotspots themselves.
  const order = useMemo(() => {
    const idxs = hotspots.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    return idxs;
  }, [hotspots]);

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

  const target = hotspots[order[askIdx]];
  const allDone = askIdx >= order.length;

  // Fire onAnswer once everything's labelled.
  useEffect(() => {
    if (allDone) {
      playCorrect();
      hapticTap();
      const rect = cardRef.current?.getBoundingClientRect();
      celebrateBurst({
        x: (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) / window.innerWidth,
        y: (rect ? rect.top + rect.height / 2 : window.innerHeight / 2) / window.innerHeight,
      });
      const t = setTimeout(() => onAnswer(true), 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (allDone || !target) return;
    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    // 10% of the smaller dimension is the tolerance.
    const dx = fx - target.x;
    const dy = fy - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 0.1) {
      // Hit.
      setHit((prev) => {
        const next = new Set(prev);
        next.add(order[askIdx]);
        return next;
      });
      playCorrect();
      hapticTap();
      setAskIdx((i) => i + 1);
    } else {
      // Miss — pulse where the tap landed.
      playWrong();
      hapticError();
      onWrong?.();
      setWrongPulse({ x: fx, y: fy, key: Date.now() });
      setTimeout(() => setWrongPulse(null), 500);
    }
  };

  return (
    <div
      ref={cardRef}
      className="bg-coal rounded-[14px] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold text-canvas-white uppercase tracking-wider mb-2">
        Tap to label
      </p>
      <p className="text-base font-medium text-canvas-white mb-1">
        {prompt ?? "Tap the right spot on the picture."}
      </p>
      {!allDone && target && (
        <p className="text-sm text-canvas-white mb-4">
          Find:{" "}
          <span className="px-2 py-0.5 rounded-md bg-canvas-white text-void-black font-semibold">
            {target.label}
          </span>
        </p>
      )}

      <div
        className="relative rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-iron mb-3 select-none"
        style={{ aspectRatio: "16 / 10" }}
      >
        {/* Loading + error states. The proxy strips Referer headers that
            many image hosts use to block hot-linking, but truly invalid
            URLs still 502 — surface that to the admin in the player too. */}
        {imgState === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-ash-gray">Loading image…</span>
          </div>
        )}
        {imgState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-canvas-white font-medium mb-1">
              Couldn&apos;t load this image
            </p>
            <p className="text-[11px] text-ash-gray">
              The URL is unreachable or the host blocked the request. Ask
              the admin to use a direct image link (ending in .png / .jpg).
            </p>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={proxiedUrl}
          alt=""
          onClick={handleImageClick}
          onLoad={() => setImgState("ok")}
          onError={() => setImgState("error")}
          draggable={false}
          className={cn(
            "absolute inset-0 w-full h-full object-contain cursor-crosshair",
            allDone && "cursor-default",
            imgState !== "ok" && "opacity-0"
          )}
        />
        {/* Confirmed hits — small white dots at each correctly-tapped point. */}
        {hotspots.map((h, i) =>
          hit.has(i) ? (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-canvas-white border-2 border-emerald-400 shadow-md pointer-events-none"
              style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
              title={h.label}
            />
          ) : null
        )}
        {/* Wrong-tap pulse */}
        {wrongPulse && (
          <motion.span
            key={wrongPulse.key}
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-rose-400 pointer-events-none"
            style={{ left: `${wrongPulse.x * 100}%`, top: `${wrongPulse.y * 100}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ash-gray">
          {allDone ? (
            <span className="inline-flex items-center gap-1 text-canvas-white">
              <Check className="w-3.5 h-3.5" /> All labelled — nice eye.
            </span>
          ) : (
            `${hit.size} of ${hotspots.length} found`
          )}
        </p>
      </div>
    </div>
  );
}
