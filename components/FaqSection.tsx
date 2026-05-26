"use client";

import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How is this different from ChatGPT or a regular AI chatbot?",
    a: "Apex Tutor is built for grade-school learning, not free-form chat. Every lesson is structured: a live AI tutor walks your child through interactive widgets — multiple choice, drag-and-drop, fraction bars — one step at a time. There's no blank text box; the tutor leads.",
  },
  {
    q: "What grades and subjects do you cover?",
    a: "Grades 4 through 12, focused on Math (Professor Maria) and Science (Professor Marco). Lessons use universal, everyday examples in clear English so concepts land for any student.",
  },
  {
    q: "What language are the lessons in?",
    a: "English by default. The AI is friendly and conversational — if your child writes back in their own way of speaking, it adapts and meets them there.",
  },
  {
    q: "Is it really 99% cheaper than a real-world tutor?",
    a: "Private tutors charge anywhere from $20 to $80 per hour. Our Starter plan is a single flat monthly fee for unlimited questions across both subjects. The math holds up — and your child gets a tutor available 24/7, not just on Saturday mornings.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. We don't lock you in. Each subscription is monthly; just stop renewing. Your child's progress stays saved so you can come back without losing the streak.",
  },
  {
    q: "What if my child gets stuck on a question?",
    a: "Wrong answers don't punish — the tutor switches to an encouraging tone, offers a hint, and lets your child try again. There's also a slide-out panel where they can ask a follow-up question without breaking the lesson flow.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. It runs in any modern browser on a laptop, phone, or tablet. No app store, no downloads.",
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className="relative py-28 px-4 bg-void-black overflow-hidden isolate scroll-mt-20">
      <div className="absolute inset-0 dot-grid dot-grid-mask opacity-25 pointer-events-none" />

      <div className="relative max-w-2xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coal/60 backdrop-blur-md border border-[var(--border-strong)] text-[11px] font-medium text-canvas-white uppercase tracking-wider mb-6">
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-canvas-white live-dot" />
            FAQ
          </div>
          <h2
            className="text-shimmer font-bold"
            style={{ fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-0.72px", lineHeight: 1.2 }}
          >
            Questions, answered
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-coal/60 backdrop-blur-sm border border-[var(--border-subtle)] rounded-[14px] px-5 py-1"
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="border-[var(--border-subtle)] last:border-b-0"
              >
                <AccordionTrigger className="text-left text-canvas-white text-sm font-medium hover:no-underline hover:text-canvas-white py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-ash-gray text-sm leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
