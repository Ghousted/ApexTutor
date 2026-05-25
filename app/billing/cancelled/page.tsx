import Link from "next/link";
import Logo from "@/components/Logo";

export default function BillingCancelledPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white">
      <header className="px-6 md:px-10 py-5">
        <Logo size="md" />
      </header>

      <section className="max-w-md mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-ink mb-3">
          Payment cancelled
        </h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          No worries — your free chat still works. Come back anytime to
          unlock unlimited questions, all professors, and image uploads.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-ink hover:bg-slate-800 text-white rounded-full font-medium text-sm transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center justify-center px-6 py-3 border border-slate-300 hover:bg-white text-ink rounded-full font-medium text-sm transition-colors"
          >
            Continue with free
          </Link>
        </div>
      </section>
    </main>
  );
}
