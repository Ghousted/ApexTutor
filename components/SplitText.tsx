"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Word- or letter-stagger headline reveal. GSAP's official SplitText is a
 * paid plugin; this is an MIT-licensable replacement that covers the 95%
 * case: a one-line spring stagger on mount.
 *
 *   <SplitText as="h1" text="Made for grade school" by="word" />
 *
 * Whitespace is preserved between tokens so wrapping behaves normally.
 * Honours prefers-reduced-motion (skips the animation entirely).
 */
export default function SplitText({
  text,
  by = "word",
  className,
  style,
  delay = 0,
  staggerMs = 50,
  as = "span",
}: {
  text: string;
  by?: "word" | "char";
  className?: string;
  style?: React.CSSProperties;
  /** Delay before the first token enters, in ms. */
  delay?: number;
  /** Per-token stagger, in ms. */
  staggerMs?: number;
  /** Element to render. Defaults to <span>. */
  as?: "span" | "h1" | "h2" | "h3" | "p";
}) {
  const reduced = useReducedMotion();
  const tokens = useMemo(() => splitTokens(text, by), [text, by]);
  const Wrapper = motion[as] as typeof motion.span;

  if (reduced) {
    const Tag = as as React.ElementType;
    return (
      <Tag className={className} style={style}>
        {text}
      </Tag>
    );
  }

  return (
    <Wrapper
      className={className}
      style={style}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: delay / 1000,
            staggerChildren: staggerMs / 1000,
          },
        },
      }}
    >
      {tokens.map((tok, i) =>
        tok.kind === "ws" ? (
          <span key={i} aria-hidden="true">
            {tok.text}
          </span>
        ) : (
          <motion.span
            key={i}
            className="inline-block"
            variants={{
              hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
              visible: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { type: "spring", stiffness: 220, damping: 24 },
              },
            }}
          >
            {tok.text}
          </motion.span>
        )
      )}
    </Wrapper>
  );
}

type Token = { kind: "tok" | "ws"; text: string };

function splitTokens(text: string, by: "word" | "char"): Token[] {
  if (by === "char") {
    return text.split("").map((c) => ({
      kind: /\s/.test(c) ? "ws" : "tok",
      text: c,
    }));
  }
  // word — split keeping the whitespace as standalone tokens
  const parts = text.split(/(\s+)/);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ kind: /^\s+$/.test(p) ? "ws" : "tok", text: p }));
}
