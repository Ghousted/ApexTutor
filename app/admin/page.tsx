import Link from "next/link";
import { GraduationCap, BarChart3, ArrowRight, Library } from "lucide-react";

const SHORTCUTS = [
  {
    href: "/admin/courses",
    icon: Library,
    title: "Courses",
    description: "Author + publish courses and their lessons.",
  },
  {
    href: "/admin/instructors",
    icon: GraduationCap,
    title: "Instructors",
    description:
      "Review the current roster and pick a DiceBear avatar per professor.",
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
        <h1 className="text-2xl md:text-3xl font-bold text-canvas-white">
          Admin dashboard
        </h1>
        <p className="text-sm text-ash-gray mt-1">
          Manage courses, instructors, and review usage.
        </p>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group p-5 bg-coal border border-[var(--border-subtle)] rounded-[14px] hover:shadow-md hover:border-[var(--border-subtle)] transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-iron text-canvas-white flex items-center justify-center mb-3">
              <s.icon className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-canvas-white mb-1">{s.title}</h2>
            <p className="text-sm text-ash-gray leading-relaxed mb-4">
              {s.description}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-canvas-white">
              Open
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
