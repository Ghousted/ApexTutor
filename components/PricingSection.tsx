"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    price: "₱0",
    cadence: "",
    blurb: "For trying it out with your kids.",
    cta: "Get started",
    highlighted: false,
    features: [
      "10 questions per day",
      "Math only",
      "Text responses only",
    ],
  },
  {
    name: "Starter",
    price: "₱199",
    cadence: "/ month",
    blurb: "Daily homework help for one student.",
    cta: "Get started",
    highlighted: true,
    features: [
      "Unlimited questions",
      "Math + Science",
      "Voice responses",
      "Tagalog & Taglish modes",
      "Progress tracking",
    ],
  },
  {
    name: "Family",
    price: "₱399",
    cadence: "/ month",
    blurb: "Up to 5 children, one account.",
    cta: "Get started",
    highlighted: false,
    features: [
      "Everything in Starter, plus",
      "Up to 5 children",
      "Parent dashboard",
      "Weekly progress report",
      "Downloadable worksheets",
    ],
  },
];

export default function PricingSection() {
  const router = useRouter();

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

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
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
                onClick={() => router.push("/chat")}
                className={cn(
                  "w-full py-2.5 rounded-full text-sm font-medium transition-all active:scale-95",
                  plan.highlighted
                    ? "bg-white text-indigo-600 hover:bg-indigo-50"
                    : "bg-ink text-white hover:bg-slate-800"
                )}
              >
                {plan.cta}
              </button>

              <div
                className={cn(
                  "border-t pt-5",
                  plan.highlighted ? "border-white/20" : "border-slate-100"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold mb-3",
                    plan.highlighted ? "text-white/80" : "text-slate-500"
                  )}
                >
                  {plan.name === "Family" ? "And in Family, plus" : "All in Starter, plus"}
                </p>
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
