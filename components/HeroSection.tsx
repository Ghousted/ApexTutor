"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { motion, useReducedMotion } from "motion/react";
import { auth } from "@/lib/firebase";
import Logo from "./Logo";
import AuthModal from "./AuthModal";
import TutorAvatar from "./TutorAvatar";

const OUTLINED_QUESTIONS = [
  "How to study addition and subtraction?",
  "Outline all the topics for my science subject.",
  "Explain physics to me like a 5 year old.",
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    // Softer spring: lower stiffness + slightly higher damping = a slower,
    // calmer entrance that breathes instead of snapping.
    transition: { type: "spring" as const, stiffness: 140, damping: 22, mass: 1.1 },
  },
};

// Soft particle field — drifting dots above the aurora. Pure presentation,
// no interaction; respects reduced motion.
const PARTICLES = Array.from({ length: 22 }).map((_, i) => ({
  id: i,
  // Deterministic-feeling spread so SSR doesn't mismatch.
  x: (i * 37) % 100,
  y: ((i * 53) % 80) + 8,
  size: 1 + (i % 4) * 0.6,
  delay: (i * 0.31) % 6,
  duration: 7 + (i % 5),
}));

export default function HeroSection() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const navigatedRef = useRef(false);
  const reduced = useReducedMotion();

  // Cycling typing placeholder.
  const [placeholder, setPlaceholder] = useState(OUTLINED_QUESTIONS[0]);
  const [inputFocused, setInputFocused] = useState(false);
  useEffect(() => {
    if (reduced || inputValue || inputFocused) return;
    let cancelled = false;
    let qIdx = 0;
    let charIdx = OUTLINED_QUESTIONS[0].length;
    let mode: "holding" | "deleting" | "typing" = "holding";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      const target = OUTLINED_QUESTIONS[qIdx];
      let next: number;
      if (mode === "holding") {
        mode = "deleting";
        next = 1800;
      } else if (mode === "deleting") {
        charIdx = Math.max(0, charIdx - 1);
        setPlaceholder(target.slice(0, charIdx));
        if (charIdx === 0) {
          qIdx = (qIdx + 1) % OUTLINED_QUESTIONS.length;
          mode = "typing";
          next = 250;
        } else {
          next = 25;
        }
      } else {
        const newTarget = OUTLINED_QUESTIONS[qIdx];
        charIdx = Math.min(newTarget.length, charIdx + 1);
        setPlaceholder(newTarget.slice(0, charIdx));
        if (charIdx === newTarget.length) {
          mode = "holding";
          next = 1500;
        } else {
          next = 45;
        }
      }
      timer = setTimeout(tick, next);
    };
    timer = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reduced, inputValue, inputFocused]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user && pendingQuery && !navigatedRef.current) {
      navigatedRef.current = true;
      router.push(`/courses?q=${encodeURIComponent(pendingQuery)}`);
    }
  }, [user, pendingQuery, router]);

  const handleSubmit = (message?: string) => {
    const query = (message ?? inputValue).trim();
    if (!query) return;
    if (!user) {
      setPendingQuery(query);
      setAuthOpen(true);
      return;
    }
    router.push(`/courses?q=${encodeURIComponent(query)}`);
  };

  const handleAuthClose = () => {
    setAuthOpen(false);
    if (!user) setPendingQuery(null);
  };

  return (
    <section id="top" className="relative pt-32 pb-40 px-4 overflow-hidden isolate min-h-[88vh] flex items-center">
      {/* ─── Layer 0: Background video ─────────────────────────────── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
        aria-hidden="true"
      >
        <source src="/videos/12421542_3840_2160_30fps.mp4" type="video/mp4" />
      </video>

      {/* ─── Layer 1: Dark scrim + dot grid + grain ─────────────────── */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.82) 60%, #000 100%)",
        }}
      />
      {/* Bottom feather — extends the dark into the next section so the
          handoff to Features reads as a single continuous surface. */}
      <div
        className="absolute inset-x-0 bottom-0 h-40 z-[7] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 100%)",
        }}
      />
      <div className="absolute inset-0 z-[2] pointer-events-none dot-grid dot-grid-mask opacity-50" />
      <div className="absolute inset-0 z-[3] grain" />

      {/* ─── Layer 2: Aurora — drifting radial gradients ─────────────── */}
      <div className="absolute inset-0 z-[4] pointer-events-none overflow-hidden">
        <div className="aurora-layer aurora-a" />
        <div className="aurora-layer aurora-b" />
        <div className="aurora-layer aurora-c" />
      </div>

      {/* ─── Layer 3: Drifting particle field ────────────────────────── */}
      {!reduced && (
        <div
          className="absolute inset-0 z-[5] pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          {PARTICLES.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-full bg-canvas-white"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                opacity: 0.4,
              }}
              animate={{
                y: [0, -40, 0],
                opacity: [0.15, 0.7, 0.15],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      {/* ─── Layer 4: Floating tutor avatars (decorative) ────────────── */}
      {!reduced && (
        <>
          <motion.div
            className="hidden lg:block absolute z-[6] left-[6%] top-[28%] pointer-events-none"
            initial={{ opacity: 0, x: -30, rotate: -6 }}
            animate={{ opacity: 1, x: 0, rotate: -6, y: [0, -10, 0] }}
            transition={{
              opacity: { duration: 0.8, delay: 0.6 },
              x: { duration: 0.8, delay: 0.6 },
              y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <TutorAvatar instructorId="maria-math" state="idle" size={80} />
          </motion.div>
          <motion.div
            className="hidden lg:block absolute z-[6] right-[6%] top-[34%] pointer-events-none"
            initial={{ opacity: 0, x: 30, rotate: 6 }}
            animate={{ opacity: 1, x: 0, rotate: 6, y: [0, -8, 0] }}
            transition={{
              opacity: { duration: 0.8, delay: 0.9 },
              x: { duration: 0.8, delay: 0.9 },
              y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <TutorAvatar instructorId="marco-science" state="idle" size={80} />
          </motion.div>
        </>
      )}

      {/* ─── Layer 10: Content ───────────────────────────────────────── */}
      <motion.div
        className="relative z-10 max-w-3xl mx-auto text-center w-full"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          // Slower cascade — each line breathes for ~180ms before the next
          // begins, giving the eye time to settle on the headline.
          visible: { transition: { staggerChildren: 0.18, delayChildren: 0.25 } },
        }}
      >
        <motion.div className="flex justify-center mb-10" variants={fadeUp}>
          <Logo size="lg" />
        </motion.div>

        {/* Live AI badge */}
        <motion.div variants={fadeUp} className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coal/60 backdrop-blur-md border border-[var(--border-strong)] text-[11px] font-medium text-canvas-white uppercase tracking-wider">
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-canvas-white live-dot" />
            <Sparkles className="w-3 h-3 text-canvas-white" />
            Live AI tutoring
          </div>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-shimmer font-bold mb-7 leading-[1.05]"
          style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            letterSpacing: "-1.08px",
          }}
        >
          99% cheaper than getting
          <br />
          a real-world tutor.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-ash-gray mb-10 max-w-xl mx-auto"
          style={{ fontSize: "16px", lineHeight: 1.5 }}
        >
          Expert AI tutoring in Math and Science for grade-school and
          high-school students. Available anywhere, 24/7.
        </motion.p>

        {/* Search input with animated gradient border on focus */}
        <motion.div variants={fadeUp} className="relative max-w-2xl mx-auto mb-7">
          <div
            className={
              "relative rounded-xl bg-coal/85 backdrop-blur-xl border border-[var(--border-strong)] transition-colors " +
              (inputFocused ? "gradient-border" : "")
            }
          >
            <div className="flex items-center overflow-hidden rounded-xl">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder={
                  placeholder || "What topic or subject do you need help with?"
                }
                className="flex-1 bg-transparent px-5 py-4 text-canvas-white placeholder-ash-gray outline-none text-sm"
              />
              <motion.button
                onClick={() => handleSubmit()}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
                className="m-1.5 px-4 py-2.5 bg-canvas-white text-void-black rounded-lg font-medium text-sm flex items-center gap-1.5 shrink-0"
              >
                Send <ArrowUp className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Suggestion chips */}
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl mx-auto"
        >
          {OUTLINED_QUESTIONS.map((q) => (
            <motion.button
              key={q}
              onClick={() => handleSubmit(q)}
              whileHover={{
                y: -3,
                boxShadow: "0 8px 24px rgba(255,255,255,0.08)",
              }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="text-left px-4 py-3 rounded-lg bg-coal/70 backdrop-blur-md border border-[var(--border-subtle)] text-ash-gray text-xs hover:border-canvas-white hover:text-canvas-white transition-colors"
            >
              {q}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>

      <AuthModal
        open={authOpen}
        onClose={handleAuthClose}
        defaultMode="signup"
        reason="Create a free account to start chatting with Apex Tutor. Your conversation will pick up right where you left off."
      />
    </section>
  );
}
