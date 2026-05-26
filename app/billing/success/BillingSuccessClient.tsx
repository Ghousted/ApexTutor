"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clock, Sparkles, ArrowRight } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { motion } from "motion/react";
import { auth } from "@/lib/firebase";
import { watchSubscription, hasActiveSubscription } from "@/lib/subscription";
import type { Subscription } from "@/lib/subscription";
import Logo from "@/components/Logo";
import LoadingDots from "@/components/LoadingDots";

/**
 * Live-listening success page.
 *
 * State machine:
 *   - `waiting` (default)      → user just landed, webhook may still be in flight
 *   - `active`                 → subscription doc has been updated, features unlocked
 *   - `slow`                   → 30s passed and still no subscription — show a
 *                                helpful "your receipt is on its way" fallback
 *                                so the user isn't stuck looking at a spinner
 */
type UiState = "waiting" | "active" | "slow";

const SLOW_THRESHOLD_MS = 30_000;

export default function BillingSuccessClient() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [uiState, setUiState] = useState<UiState>("waiting");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = watchSubscription(user.uid, (s) => {
      setSub(s);
      if (hasActiveSubscription(s)) setUiState("active");
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (uiState !== "waiting") return;
    const t = setTimeout(() => {
      setUiState((s) => (s === "waiting" ? "slow" : s));
    }, SLOW_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, [uiState]);

  return (
    <main className="min-h-screen bg-void-black inside-surface">
      <header className="px-6 md:px-10 py-5 border-b border-[var(--border-subtle)]">
        <Logo size="md" />
      </header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-md mx-auto px-6 py-16 text-center"
      >
        {uiState === "waiting" && <WaitingUI />}
        {uiState === "slow" && <SlowUI />}
        {uiState === "active" && (
          <ActiveUI plan={sub?.plan} validUntil={sub?.validUntil} />
        )}
      </motion.section>
    </main>
  );
}

function WaitingUI() {
  return (
    <>
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-iron border border-[var(--border-strong)] flex items-center justify-center">
        <LoadingDots size="md" />
      </div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
        Processing payment
      </p>
      <h1
        className="font-bold text-canvas-white mb-3 leading-tight"
        style={{ fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "-0.54px" }}
      >
        Confirming your payment…
      </h1>
      <p className="text-sm text-ash-gray leading-relaxed max-w-prose mx-auto">
        This usually takes a few seconds. We&apos;re finishing setup with
        PayMongo and unlocking your account.
      </p>
    </>
  );
}

function SlowUI() {
  return (
    <>
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-iron border border-[var(--border-strong)] flex items-center justify-center">
        <Clock className="w-7 h-7 text-canvas-white" />
      </div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
        Taking longer than usual
      </p>
      <h1
        className="font-bold text-canvas-white mb-3 leading-tight"
        style={{ fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "-0.54px" }}
      >
        Still processing
      </h1>
      <p className="text-sm text-ash-gray mb-7 leading-relaxed max-w-prose mx-auto">
        Your payment is going through but we haven&apos;t received the
        confirmation yet. This sometimes takes up to a minute. If your email
        receipt has arrived, your account will unlock shortly.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold text-sm shadow-md"
      >
        Check again
      </button>
      <p className="text-xs text-ash-gray mt-8">
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
  const planName = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "";

  return (
    <>
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-canvas-white flex items-center justify-center shadow-md">
        <Check className="w-7 h-7 text-void-black" strokeWidth={3} />
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-canvas-white text-void-black text-[11px] font-semibold uppercase tracking-wider mb-3">
        <Sparkles className="w-3 h-3" />
        {planName} active
      </div>
      <h1
        className="font-bold text-canvas-white mb-3 leading-tight"
        style={{ fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "-0.54px" }}
      >
        Payment received — you&apos;re in.
      </h1>
      <p className="text-sm text-ash-gray mb-2 leading-relaxed max-w-prose mx-auto">
        All courses, image uploads, and unlimited questions are unlocked.
      </p>
      {renewsOn && (
        <p className="text-xs text-ash-gray mb-7">
          Access valid until{" "}
          <span className="font-medium text-canvas-white">{renewsOn}</span>.
        </p>
      )}
      <Link
        href="/courses"
        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold text-sm shadow-md"
      >
        Start a lesson
        <ArrowRight className="w-4 h-4" />
      </Link>
      <p className="text-xs text-ash-gray mt-8">
        A receipt has been sent to your email.
      </p>
    </>
  );
}
