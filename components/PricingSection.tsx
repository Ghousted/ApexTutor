"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import type { Plan } from "@/lib/paymongo";

type PlanCard = {
  id: "free" | Plan;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  cta: string;
  highlighted: boolean;
  paid: boolean;
  features: string[];
};

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    price: "₱0",
    cadence: "",
    blurb: "For trying it out with your kids.",
    cta: "Get started",
    highlighted: false,
    paid: false,
    features: [
      "10 questions per day",
      "Math only (Professor Maria)",
      "Text responses only",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "₱199",
    cadence: "/ month",
    blurb: "Daily homework help for one student.",
    cta: "Subscribe",
    highlighted: true,
    paid: true,
    features: [
      "Unlimited questions",
      "All courses (Math + Science)",
      "Image uploads",
      "Voice replies",
      "Press-to-speak answers",
    ],
  },
  {
    id: "family",
    name: "Family",
    price: "₱399",
    cadence: "/ month",
    blurb: "Up to 5 children, one account.",
    cta: "Subscribe",
    highlighted: false,
    paid: true,
    features: [
      "Everything in Starter",
      "Up to 5 children",
      "Parent dashboard (coming soon)",
      "Weekly progress reports",
      "Downloadable worksheets",
    ],
  },
];

export default function PricingSection() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const handleClick = async (plan: PlanCard) => {
    setError("");
    if (!plan.paid) {
      router.push("/courses");
      return;
    }
    if (!user) {
      // Send signed-out users through the auth flow on the instructors page.
      // They can come back and pick a plan after signing in.
      router.push("/courses");
      return;
    }
    setSubmittingPlan(plan.id);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.id,
          uid: user.uid,
          email: user.email ?? "",
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout");
      setSubmittingPlan(null);
    }
  };

  return (
    <section id="pricing" className="relative py-28 px-4 bg-void-black overflow-hidden isolate scroll-mt-20">
      {/* Animated divider — thin shimmering line at the top of the section */}
      <div className="absolute top-0 inset-x-0 h-px overflow-hidden">
        <motion.div
          initial={{ x: "-100%" }}
          whileInView={{ x: "100%" }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
          className="absolute inset-y-0 w-1/2"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)",
          }}
        />
        <div className="absolute inset-0 bg-[var(--border-subtle)]" style={{ zIndex: -1 }} />
      </div>

      {/* Faint dot grid background */}
      <div className="absolute inset-0 dot-grid dot-grid-mask opacity-40 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coal/60 border border-[var(--border-strong)] text-[11px] font-medium text-canvas-white uppercase tracking-wider mb-5">
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-canvas-white live-dot" />
            Pricing
          </div>
          <h2
            className="text-shimmer font-bold mb-4"
            style={{ fontSize: "clamp(28px, 4vw, 48px)", letterSpacing: "-0.72px", lineHeight: 1.2 }}
          >
            Simple, affordable pricing
          </h2>
          <p className="text-ash-gray text-sm md:text-base">
            Less than the cost of one tutoring hour, for a whole month of learning.
          </p>
        </motion.div>

        {error && (
          <p className="max-w-md mx-auto mb-6 text-sm text-center text-canvas-white bg-iron border border-[var(--border-strong)] rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <motion.div
          className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {PLANS.map((plan) => (
            <motion.div
              key={plan.id}
              variants={{
                hidden: { opacity: 0, y: 22 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 240, damping: 24 },
                },
              }}
              whileHover={{ y: -4 }}
              className={cn(
                "relative rounded-[14px] p-7 flex flex-col gap-5 transition-colors border",
                plan.highlighted
                  ? "bg-canvas-white text-void-black border-canvas-white md:scale-[1.03]"
                  : "bg-coal/80 backdrop-blur-md text-canvas-white border-[var(--border-subtle)] hover:border-canvas-white"
              )}
              style={
                plan.highlighted
                  ? { boxShadow: "0 0 60px 0 rgba(255,255,255,0.18)" }
                  : undefined
              }
            >
              <div>
                <h3
                  className={cn(
                    "text-xs uppercase tracking-wider font-semibold mb-3",
                    plan.highlighted ? "text-void-black/70" : "text-ash-gray"
                  )}
                >
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  {plan.cadence && (
                    <span
                      className={cn(
                        "text-sm",
                        plan.highlighted ? "text-void-black/60" : "text-ash-gray"
                      )}
                    >
                      {plan.cadence}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleClick(plan)}
                disabled={submittingPlan === plan.id}
                className={cn(
                  "w-full py-3 rounded-lg text-sm font-medium transition-opacity active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait",
                  plan.highlighted
                    ? "bg-void-black text-canvas-white hover:opacity-90"
                    : "bg-canvas-white text-void-black hover:opacity-90 shadow-md"
                )}
              >
                {submittingPlan === plan.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {plan.cta}
              </button>

              <div
                className={cn(
                  "border-t pt-5",
                  plan.highlighted ? "border-void-black/10" : "border-[var(--border-subtle)]"
                )}
              >
                <ul className="flex flex-col gap-2.5 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check
                        className={cn(
                          "w-4 h-4 shrink-0 mt-0.5",
                          plan.highlighted ? "text-void-black" : "text-canvas-white"
                        )}
                      />
                      <span
                        className={cn(
                          plan.highlighted ? "text-void-black/85" : "text-canvas-white/85"
                        )}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p
                className={cn(
                  "text-xs leading-relaxed",
                  plan.highlighted ? "text-void-black/60" : "text-ash-gray"
                )}
              >
                {plan.blurb}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
