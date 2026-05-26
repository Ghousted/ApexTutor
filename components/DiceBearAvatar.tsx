"use client";

import { useMemo } from "react";
import { createAvatar, type Style } from "@dicebear/core";
import {
  loreleiNeutral,
  lorelei,
  adventurer,
  adventurerNeutral,
  bottts,
  funEmoji,
  pixelArt,
  personas,
  micah,
  notionists,
} from "@dicebear/collection";
import { cn } from "@/lib/utils";

/**
 * Reusable DiceBear avatar. Renders an inline SVG (data-URI) so it's
 * deterministic, offline, and ssr-safe.
 *
 * Two consumer surfaces:
 *   - Students (account page + landing header) pick from STUDENT_STYLES
 *   - Professors (admin instructors page) pick from PROFESSOR_STYLES
 *
 * `seed` controls the variation within a style — same seed + same style →
 * same picture every render.
 */

export const STUDENT_STYLES = [
  { id: "lorelei", label: "Lorelei", factory: lorelei },
  { id: "adventurer", label: "Adventurer", factory: adventurer },
  { id: "bottts", label: "Bottts", factory: bottts },
  { id: "fun-emoji", label: "Fun Emoji", factory: funEmoji },
  { id: "pixel-art", label: "Pixel Art", factory: pixelArt },
  { id: "notionists", label: "Notionists", factory: notionists },
] as const;

export const PROFESSOR_STYLES = [
  { id: "personas", label: "Personas", factory: personas },
  { id: "lorelei-neutral", label: "Lorelei", factory: loreleiNeutral },
  { id: "adventurer-neutral", label: "Adventurer", factory: adventurerNeutral },
  { id: "micah", label: "Micah", factory: micah },
  { id: "notionists", label: "Notionists", factory: notionists },
] as const;

export type StudentStyleId = (typeof STUDENT_STYLES)[number]["id"];
export type ProfessorStyleId = (typeof PROFESSOR_STYLES)[number]["id"];
export type AnyStyleId = StudentStyleId | ProfessorStyleId;

const ALL_STYLES = [...STUDENT_STYLES, ...PROFESSOR_STYLES] as const;

function resolveStyle(id: string) {
  return ALL_STYLES.find((s) => s.id === id) ?? STUDENT_STYLES[0];
}

export default function DiceBearAvatar({
  style,
  seed,
  size = 40,
  className,
  rounded = "full",
}: {
  style: string;
  seed: string;
  size?: number;
  className?: string;
  rounded?: "full" | "lg" | "none";
}) {
  const dataUri = useMemo(() => {
    const def = resolveStyle(style);
    // Each DiceBear style has its own narrow Options type; we don't care
    // about the specifics here (no per-style overrides), so widen the
    // factory to a shared Style<Record<string, unknown>> for createAvatar.
    const avatar = createAvatar(def.factory as unknown as Style<Record<string, unknown>>, {
      seed: seed || "default",
      size,
      backgroundType: ["solid"],
      backgroundColor: ["171717", "262626"],
    });
    return avatar.toDataUri();
  }, [style, seed, size]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUri}
      alt=""
      width={size}
      height={size}
      className={cn(
        "object-cover shrink-0",
        rounded === "full" && "rounded-full",
        rounded === "lg" && "rounded-lg",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
