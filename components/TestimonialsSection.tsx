"use client";

import { useEffect, useRef } from "react";
import { Quote } from "lucide-react";
import { motion } from "motion/react";
import gsap from "gsap";

const TESTIMONIALS = [
  {
    quote:
      "Huge improvement for my son in Math after just a few sessions. He used to struggle to keep up in class but is now confident solving on his own. What I love most is how the tutors break complex topics down into simple, relatable steps. Sulit compared to traditional tutors charging $60/hour or more.",
    name: "Maria L.",
    role: "Parent of Grade 8 Student",
    avatar: "ML",
  },
  {
    quote:
      "I used to struggle a lot with Science, especially Physics and Chemistry. The AI tutorial sessions made everything easier to understand because the lessons felt interactive and personalized. It honestly feels like learning from top teachers, but in a much more approachable way.",
    name: "Ethan R.",
    role: "Senior High School Student",
    avatar: "ER",
  },
  {
    quote:
      "I love how the lessons explain things step by step instead of dumping a wall of text. The tutors really focus on helping me think critically, not just memorize formulas. I feel a lot more prepared now — for school and for real problem solving.",
    name: "Nicole T.",
    role: "First Year College Student",
    avatar: "NT",
  },
];

// Wordmark + full name pairs. Wordmark stays small/uppercase (Linear-style
// "customer logo bar" treatment) and the full name reads underneath as a
// subtle caption on hover.
const UNIVERSITIES = [
  { short: "UP", label: "University of the Philippines" },
  { short: "MAPUA", label: "Mapúa University" },
  { short: "FEU", label: "Far Eastern University" },
  { short: "UE", label: "University of the East" },
  { short: "PUP", label: "Polytechnic University of the Philippines" },
];

export default function TestimonialsSection() {
  // Render the testimonial list twice so the marquee can seamlessly loop by
  // translating exactly -50% — when the first copy scrolls off, the second
  // copy is already in place.
  const items = [...TESTIMONIALS, ...TESTIMONIALS];
  // Universities duplicated for their own seamless ambient marquee.
  const uniItems = [...UNIVERSITIES, ...UNIVERSITIES];

  const trackRef = useRef<HTMLDivElement>(null);
  const uniTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // Respect prefers-reduced-motion — skip the animation entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Base loop: shift the whole track left by half its width (-50%) over
    // 32s, then repeat. xPercent + a duplicated content list gives a seamless
    // wrap without snapping.
    const tween = gsap.to(el, {
      xPercent: -50,
      repeat: -1,
      duration: 32,
      ease: "none",
    });

    // ─── Scroll-velocity coupling ─────────────────────────────────────
    // Faster page scroll = faster (and direction-aware) marquee. When the
    // page stops scrolling, decay back to the baseline 1x speed.
    let lastScrollY = window.scrollY;
    let velocityDecayTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      const cur = window.scrollY;
      const delta = cur - lastScrollY;
      lastScrollY = cur;

      // Direction: scrolling down nudges the marquee forward (already its
      // natural direction); scrolling up flips it briefly.
      const direction = delta >= 0 ? 1 : -1;
      // Map |delta| (typical wheel deltas are 1–40 px) to a speed multiplier.
      // Clamp to keep the effect punchy without spinning out of control.
      const speed = Math.min(10, 1 + Math.abs(delta) / 6);

      gsap.to(tween, {
        timeScale: direction * speed,
        duration: 0.25,
        ease: "power2.out",
        overwrite: true,
      });

      // After the user stops scrolling for ~200ms, ease back to the baseline.
      if (velocityDecayTimer) clearTimeout(velocityDecayTimer);
      velocityDecayTimer = setTimeout(() => {
        gsap.to(tween, {
          timeScale: 1,
          duration: 1.0,
          ease: "power3.out",
          overwrite: true,
        });
      }, 200);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (velocityDecayTimer) clearTimeout(velocityDecayTimer);
      tween.kill();
    };
  }, []);

  // Universities marquee — slow ambient loop, no scroll-velocity coupling.
  // Two reasons: (1) it's a trust bar, not a feature; loud motion would
  // distract; (2) one velocity marquee per page is the right amount of "wow".
  useEffect(() => {
    const el = uniTrackRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.to(el, {
      xPercent: -50,
      repeat: -1,
      duration: 45,
      ease: "none",
    });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <>
      {/* ─── University trust bar ──────────────────────────────────── */}
      <section className="relative py-28 px-4 bg-void-black overflow-hidden isolate">
        {/* Faint dot grid */}
        <div className="absolute inset-0 dot-grid dot-grid-mask opacity-30 pointer-events-none" />

        <motion.div
          className="relative max-w-4xl mx-auto text-center mb-12"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coal/60 backdrop-blur-md border border-[var(--border-strong)] text-[11px] font-medium text-canvas-white uppercase tracking-wider mb-6">
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-canvas-white live-dot" />
            Trusted across PH
          </div>
          <h2
            className="text-shimmer font-bold leading-snug mb-3"
            style={{ fontSize: "clamp(24px, 3vw, 36px)", letterSpacing: "-0.54px" }}
          >
            Trusted by students from
            <br className="hidden md:block" /> leading universities
          </h2>
          <p className="text-ash-gray text-sm">
            Used in study sessions by learners around the world.
          </p>
        </motion.div>

        {/* Marquee */}
        <div className="relative">
          <div
            ref={uniTrackRef}
            className="flex gap-3 will-change-transform"
            style={{ width: "max-content" }}
          >
            {uniItems.map((u, i) => (
              <UniversityMark key={`${u.short}-${i}`} short={u.short} label={u.label} />
            ))}
          </div>
          {/* Edge fades */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-32"
            style={{
              background:
                "linear-gradient(90deg, #000 0%, rgba(0,0,0,0) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-32"
            style={{
              background:
                "linear-gradient(270deg, #000 0%, rgba(0,0,0,0) 100%)",
            }}
          />
        </div>
      </section>

      {/* Testimonials — scroll-velocity marquee. The cosmic-drift gradient
          fades into the surrounding void-black via vertical mask gradients
          so it doesn't read as a sharp band sandwiched between sections. */}
      <section
        id="testimonials"
        className="relative py-28 overflow-hidden isolate scroll-mt-20"
        style={{ background: "var(--gradient-cosmic-drift)" }}
      >
        {/* Top + bottom feather to void-black so the gradient blends in */}
        <div
          className="absolute inset-x-0 top-0 h-32 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, #000 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
          style={{
            background:
              "linear-gradient(0deg, #000 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto mb-14 px-4">
          <div className="flex items-center justify-center gap-3">
            <Quote
              className="w-10 h-10 text-ash-gray opacity-50"
              strokeWidth={1}
              style={{ transform: "scaleX(-1)" }}
            />
            <h2
              className="font-bold text-canvas-white"
              style={{ fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-0.72px" }}
            >
              Testimonials
            </h2>
          </div>
          <p className="text-center text-ash-gray text-xs mt-3">
            Scroll to speed up.
          </p>
        </div>

        {/* Marquee viewport — overflow-hidden lives here; the track is wider
            than the viewport so the loop is always seamless. */}
        <div className="relative">
          <div
            ref={trackRef}
            className="flex gap-5 will-change-transform"
            style={{ width: "max-content" }}
          >
            {items.map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="rounded-[14px] bg-coal/80 backdrop-blur-sm p-6 flex flex-col gap-5 border border-[var(--border-subtle)] w-[340px] sm:w-[380px] shrink-0"
              >
                <p className="text-canvas-white/85 text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-10 h-10 rounded-full bg-iron border border-[var(--border-strong)] flex items-center justify-center shrink-0">
                    <span className="text-canvas-white text-xs font-bold">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-canvas-white font-semibold text-sm">{t.name}</p>
                    <p className="text-ash-gray text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Edge fades — soft mask so cards don't pop in/out at the seams */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-24"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.6), transparent)" }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-24"
            style={{ background: "linear-gradient(270deg, rgba(0,0,0,0.6), transparent)" }}
          />
        </div>
      </section>
    </>
  );
}

/**
 * Stylized "university logo" — clean wordmark in a bordered card. Real
 * crests would require licensed PNGs; this is the Linear/Vercel-style
 * monochrome wordmark treatment that scales cleanly without licensing.
 *
 * Hover: card lifts, border brightens, full name reveals underneath.
 */
function UniversityMark({ short, label }: { short: string; label: string }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="group relative shrink-0 px-7 py-5 rounded-[14px] bg-coal/70 backdrop-blur-sm border border-[var(--border-subtle)] hover:border-canvas-white transition-colors flex flex-col items-center justify-center min-w-[180px]"
      title={label}
    >
      <UniversityGlyph short={short} />
      <p className="text-canvas-white font-bold text-base tracking-[0.15em] mt-2">
        {short}
      </p>
      <p className="text-ash-gray text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center max-w-[160px] leading-tight">
        {label}
      </p>
    </motion.div>
  );
}

/** Real seal images sourced from Wikipedia/Wikimedia Commons. Rendered in
 *  their original colours — the dark card background lets them pop. */
const LOGOS: Record<string, string> = {
  UP: "/logos/up.svg",
  MAPUA: "/logos/mapua.svg",
  FEU: "/logos/feu.svg",
  UE: "/logos/ue.png",
  PUP: "/logos/pup.svg",
};

function UniversityGlyph({ short }: { short: string }) {
  const src = LOGOS[short];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="w-12 h-12 object-contain"
      aria-hidden="true"
    />
  );
}

// Keep the legacy fallback in case a future school is added without an
// official asset. Currently unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FallbackGlyph({ short }: { short: string }) {
  const common = "w-7 h-7 text-canvas-white";
  switch (short) {
    case "UP":
      // Sun rays — UP's oblation/sunburst motif
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3.5" />
          <g strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
            <line x1="4.9" y1="4.9" x2="7" y2="7" />
            <line x1="17" y1="17" x2="19.1" y2="19.1" />
            <line x1="19.1" y1="4.9" x2="17" y2="7" />
            <line x1="7" y1="17" x2="4.9" y2="19.1" />
          </g>
        </svg>
      );
    case "DLSU":
      // Cross — De La Salle Christian Brothers
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 2h4v7h7v4h-7v9h-4v-9H3V9h7V2z" strokeLinejoin="round" />
        </svg>
      );
    case "UST":
      // Arch / pillars — UST's main building
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 21V10l9-6 9 6v11" strokeLinejoin="round" />
          <rect x="7" y="13" width="3" height="8" />
          <rect x="14" y="13" width="3" height="8" />
        </svg>
      );
    case "MAPUA":
      // Gear — engineering / tech school
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"
            strokeLinecap="round"
          />
        </svg>
      );
    case "FEU":
      // Tamaraw horn / abstract crest
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6l8 14 8-14" strokeLinejoin="round" />
          <path d="M8 6h8" strokeLinecap="round" />
        </svg>
      );
    case "UE":
      // Lightning / red warrior abstract
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" strokeLinejoin="round" />
        </svg>
      );
    case "PUP":
      // Open book — public university
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            d="M3 5a2 2 0 012-2h5a2 2 0 012 2v15a2 2 0 00-2-2H3V5z"
            strokeLinejoin="round"
          />
          <path
            d="M21 5a2 2 0 00-2-2h-5a2 2 0 00-2 2v15a2 2 0 012-2h7V5z"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" strokeLinejoin="round" />
        </svg>
      );
  }
}
