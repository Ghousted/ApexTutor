import Link from "next/link";
import { XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

export default function BillingCancelledPage() {
  return (
    <main className="min-h-screen bg-void-black inside-surface">
      <header className="px-6 md:px-10 py-5 border-b border-[var(--border-subtle)]">
        <Logo size="md" />
      </header>

      <section className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-iron border border-[var(--border-strong)] flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-7 h-7 text-canvas-white" />
        </div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
          Payment cancelled
        </p>
        <h1
          className="font-bold text-canvas-white mb-3 leading-tight"
          style={{ fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "-0.54px" }}
        >
          No charges — you&apos;re good.
        </h1>
        <p className="text-sm text-ash-gray mb-8 leading-relaxed max-w-prose mx-auto">
          You stepped away from the payment page. Your free courses still
          work the same. Come back anytime to unlock the full catalog.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/courses"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-canvas-white hover:opacity-90 text-void-black rounded-lg font-semibold text-sm shadow-md"
          >
            Continue with free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-iron border border-[var(--border-strong)] text-canvas-white rounded-lg font-medium text-sm hover:bg-[#2e2e2e] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
