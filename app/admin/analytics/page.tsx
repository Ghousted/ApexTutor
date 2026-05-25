import { BarChart3 } from "lucide-react";

export const metadata = { title: "Analytics · Admin" };

export default function AdminAnalyticsPage() {
  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Usage metrics across instructors, sessions, and subscriptions.
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h2 className="font-semibold text-ink mb-1">Coming soon</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          Phase 4 wires up real metrics — DAU, paid subscriptions, sessions and
          messages per instructor, popular topics.
        </p>
      </div>
    </div>
  );
}
