import Link from "next/link";
import { GraduationCap, BookOpen, BarChart3, ArrowRight } from "lucide-react";

const SHORTCUTS = [
  {
    href: "/admin/instructors",
    icon: GraduationCap,
    title: "Instructors",
    description: "Review the current roster — Math, Science. Manage personas and voice settings.",
  },
  {
    href: "/admin/textbooks",
    icon: BookOpen,
    title: "Textbooks",
    description: "Upload PDFs per instructor. Powers retrieval-grounded answers in chat.",
  },
  {
    href: "/admin/analytics",
    icon: BarChart3,
    title: "Analytics",
    description: "Users, sessions, messages, and subscriptions over time.",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-ink">
          Admin dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage instructors, ingest textbooks, and review usage.
        </p>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group p-5 bg-white border border-slate-200 rounded-2xl hover:shadow-md hover:border-indigo-200 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <s.icon className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-ink mb-1">{s.title}</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              {s.description}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
              Open
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
