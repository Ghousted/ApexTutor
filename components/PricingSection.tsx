"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
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
      "Tagalog & Taglish modes",
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
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-ink mb-3">
            Simple, affordable pricing
          </h2>
          <p className="text-slate-500 text-sm md:text-base">
            Less than the cost of one tutoring hour, for a whole month of learning.
          </p>
        </div>

        {error && (
          <p className="max-w-md mx-auto mb-6 text-sm text-center text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "rounded-2xl p-7 flex flex-col gap-5 transition-shadow",
                plan.highlighted
                  ? "bg-indigo-500 text-white shadow-xl shadow-indigo-200 md:scale-[1.03]"
                  : "bg-white border border-slate-200 text-ink hover:shadow-md"
              )}
            >
              <div>
                <h3
                  className={cn(
                    "text-sm font-semibold mb-3",
                    plan.highlighted ? "text-white/90" : "text-slate-600"
                  )}
                >
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.cadence && (
                    <span
                      className={cn(
                        "text-sm",
                        plan.highlighted ? "text-white/70" : "text-slate-400"
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
                  "w-full py-2.5 rounded-full text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-wait",
                  plan.highlighted
                    ? "bg-white text-indigo-600 hover:bg-indigo-50"
                    : "bg-ink text-white hover:bg-slate-800"
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
                  plan.highlighted ? "border-white/20" : "border-slate-100"
                )}
              >
                <ul className="flex flex-col gap-2.5 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check
                        className={cn(
                          "w-4 h-4 shrink-0 mt-0.5",
                          plan.highlighted ? "text-white" : "text-indigo-500"
                        )}
                      />
                      <span
                        className={cn(
                          plan.highlighted ? "text-white/95" : "text-slate-700"
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
                  plan.highlighted ? "text-white/70" : "text-slate-500"
                )}
              >
                {plan.blurb}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
