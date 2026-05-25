"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Loader2, Clock } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { watchSubscription, hasActiveSubscription } from "@/lib/subscription";
import type { Subscription } from "@/lib/subscription";
import Logo from "@/components/Logo";

/**
 * Live-listening success page.
 *
 * State machine:
 *   - `waiting` (default)      → user just landed, webhook may still be in flight
 *   - `active`                 → subscription doc has been updated, features unlocked
 *   - `slow`                   → 30s passed and still no subscription — show a
 *                                helpful "your receipt is on its way" fallback
 *                                so the user isn't stuck looking at a spinner
 *
 * The webhook usually lands within 1–3 seconds in practice, but a delayed
 * webhook can leave a static "you're in!" page misleading. This component
 * shows real state and gracefully handles the slow path.
 */
type UiState = "waiting" | "active" | "slow";

const SLOW_THRESHOLD_MS = 30_000;

export default function BillingSuccessClient() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [uiState, setUiState] = useState<UiState>("waiting");

  // Track auth.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Live-listen for the subscription to flip active.
  useEffect(() => {
    if (!user) return;
    const unsub = watchSubscription(user.uid, (s) => {
      setSub(s);
      if (hasActiveSubscription(s)) setUiState("active");
    });
    return () => unsub();
  }, [user]);

  // After SLOW_THRESHOLD_MS, drop into the slow-path UI so the user isn't
  // stuck looking at a spinner forever if a webhook genuinely failed.
  useEffect(() => {
    if (uiState !== "waiting") return;
    const t = setTimeout(() => {
      setUiState((s) => (s === "waiting" ? "slow" : s));
    }, SLOW_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, [uiState]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white">
      <header className="px-6 md:px-10 py-5">
        <Logo size="md" />
      </header>

      <section className="max-w-md mx-auto px-6 py-12 text-center">
        {uiState === "waiting" && <WaitingUI />}
        {uiState === "slow" && <SlowUI />}
        {uiState === "active" && <ActiveUI plan={sub?.plan} validUntil={sub?.validUntil} />}
      </section>
    </main>
  );
}

function WaitingUI() {
  return (
    <>
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-indigo-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-ink mb-3">
        Confirming your payment...
      </h1>
      <p className="text-slate-600 leading-relaxed">
        This usually takes a few seconds. We&apos;re finishing setup with PayMongo
        and unlocking your account.
      </p>
    </>
  );
}

function SlowUI() {
  return (
    <>
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
        <Clock className="w-8 h-8 text-amber-600" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-ink mb-3">
        Still processing
      </h1>
      <p className="text-slate-600 mb-6 leading-relaxed">
        Your payment is going through but we haven&apos;t received the
        confirmation yet. This sometimes takes up to a minute. Check your email
        for the receipt — if it arrived, your account will unlock shortly.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full font-medium text-sm transition-colors"
      >
        Check again
      </button>
      <p className="text-xs text-slate-400 mt-6">
        Still stuck after a few minutes? Email support — we&apos;ll fix it
        manually and won&apos;t charge you twice.
      </p>
    </>
  );
}

function ActiveUI({
  plan,
  validUntil,
}: {
  plan?: string;
  validUntil?: number;
}) {
  const renewsOn = validUntil
    ? new Date(validUntil).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500 flex items-center justify-center">
        <Check className="w-8 h-8 text-white" strokeWidth={3} />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-ink mb-3">
        Payment received — you&apos;re in.
      </h1>
      <p className="text-slate-600 mb-2 leading-relaxed">
        Your {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ""}{" "}
        subscription is active.
      </p>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed">
        All courses, image uploads, and unlimited questions are unlocked.
        {renewsOn && (
          <>
            {" "}
            Access valid until <span className="font-medium">{renewsOn}</span>.
          </>
        )}
      </p>
      <Link
        href="/courses"
        className="inline-flex items-center justify-center px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full font-medium text-sm transition-colors"
      >
        Start a lesson
      </Link>
      <p className="text-xs text-slate-400 mt-6">
        A receipt has been sent to your email.
      </p>
    </>
  );
}
