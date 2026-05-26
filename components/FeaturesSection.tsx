"use client";

import { motion } from "motion/react";
import {
  CircleCheck,
  Boxes,
  Shuffle,
  ListOrdered,
  Mic,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: CircleCheck,
    title: "Quick checks",
    blurb:
      "Tap-to-answer questions that adapt to how the student responds. Wrong answers become teaching moments, not red Xs.",
    tag: "Interactive",
  },
  {
    icon: Boxes,
    title: "Fraction bars",
    blurb:
      "Drag and fill cells to build fractions visually. Math concepts you can see, not just read.",
    tag: "Visual",
  },
  {
    icon: Shuffle,
    title: "Match pairs",
    blurb:
      "Drag-and-drop matching games for vocab, equations, formulas — anything that comes in pairs.",
    tag: "Hands-on",
  },
  {
    icon: ListOrdered,
    title: "Put in order",
    blurb:
      "Sort steps of a process — the scientific method, equation solving, story sequence — into the right order.",
    tag: "Hands-on",
  },
  {
    icon: Mic,
    title: "Answer with voice",
    blurb:
      "Speak your answer out loud. Whisper-powered speech recognition fills in the bubble for you.",
    tag: "Voice",
  },
  {
    icon: Sparkles,
    title: "Tutor-led lessons",
    blurb:
      "A live AI tutor walks the student through every step. No staring at a blank chat box wondering what to ask.",
    tag: "AI",
  },
];

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 240, damping: 24 },
  },
};

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-28 px-4 bg-void-black overflow-hidden isolate scroll-mt-20">
      {/* Faint dot grid */}
      <div className="absolute inset-0 dot-grid dot-grid-mask opacity-30 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coal/60 backdrop-blur-md border border-[var(--border-strong)] text-[11px] font-medium text-canvas-white uppercase tracking-wider mb-6">
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-canvas-white live-dot" />
            Built for grade-school learners
          </div>
          <h2
            className="text-shimmer font-bold mb-4"
            style={{ fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-0.72px", lineHeight: 1.2 }}
          >
            Hands-on lessons, not walls of text
          </h2>
          <p className="text-ash-gray text-sm md:text-base max-w-xl mx-auto">
            Every lesson is built from interactive widgets. Kids drag, click,
            sort, and speak their way to understanding.
          </p>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} variants={itemVariants} whileHover={{ y: -3 }}>
                <Card className="h-full bg-coal/70 backdrop-blur-sm border-[var(--border-subtle)] hover:border-canvas-white transition-colors text-canvas-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-iron border border-[var(--border-strong)] flex items-center justify-center">
                        <Icon className="w-5 h-5 text-canvas-white" />
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-transparent border-[var(--border-subtle)] text-ash-gray text-[10px] uppercase tracking-wider font-semibold"
                      >
                        {f.tag}
                      </Badge>
                    </div>
                    <CardTitle className="text-canvas-white text-base font-semibold">
                      {f.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-ash-gray text-sm leading-relaxed">
                      {f.blurb}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
