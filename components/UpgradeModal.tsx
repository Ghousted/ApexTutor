"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Check, Sparkles } from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/paymongo";

/**
 * Shown when a free user hits a paid-feature paywall. Starts a PayMongo
 * checkout for the picked plan and redirects to the hosted payment page.
 */
export default function UpgradeModal({
  open,
  onClose,
  user,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  reason?: string;
}) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("starter");
  const [submitting, setSubmitting] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleCheckout = async (plan: Plan) => {
    if (!user) {
      onClose();
      router.push("/");
      return;
    }
    setError("");
    setSubmitting(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          uid: user.uid,
          email: user.email ?? "",
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
      setSubmitting(null);
    }
  };

  const plans: Array<{
    id: Plan;
    name: string;
    price: string;
    blurb: string;
    features: string[];
    highlight: boolean;
  }> = [
    {
      id: "starter",
      name: "Starter",
      price: "₱199",
      blurb: "For one student.",
      features: [
        "Unlimited questions",
        "All professors (Math + Science)",
        "Image uploads",
        "Voice replies",
      ],
      highlight: true,
    },
    {
      id: "family",
      name: "Family",
      price: "₱399",
      blurb: "Up to 5 students.",
      features: [
        "Everything in Starter",
        "Up to 5 children",
        "Parent dashboard (coming soon)",
        "Weekly progress reports",
      ],
      highlight: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-7 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3 h-3" />
            Upgrade
          </div>
          <h2 className="text-2xl font-bold text-ink mb-1.5">
            Unlock the full Apex Tutor experience
          </h2>
          <p className="text-sm text-slate-500">
            {reason ||
              "Get unlimited questions, every professor, and image uploads for less than the cost of a single tutoring hour."}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          {plans.map((p) => {
            const isSelected = selectedPlan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={cn(
                  "text-left rounded-2xl p-5 transition-all border-2",
                  isSelected
                    ? p.highlight
                      ? "border-indigo-500 bg-indigo-50/40"
                      : "border-ink bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {p.name}
                  </p>
                  {p.highlight && (
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5">
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold text-ink">{p.price}</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{p.blurb}</p>
                <ul className="flex flex-col gap-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-slate-700">
                      <Check
                        className="w-3 h-3 mt-0.5 shrink-0"
                        style={{ color: p.highlight ? "#6366F1" : "#1a1a1a" }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <button
          onClick={() => handleCheckout(selectedPlan)}
          disabled={!!submitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? "Redirecting to PayMongo..." : `Continue with ${plans.find((p) => p.id === selectedPlan)?.name}`}
        </button>

        <p className="text-[11px] text-center text-slate-400 mt-3 leading-relaxed">
          Pay with GCash, Maya, GrabPay, QR PH, or credit card. One-time
          monthly payment — you control renewals. Cancel anytime by simply
          not paying next month.
        </p>
      </div>
    </div>
  );
}
