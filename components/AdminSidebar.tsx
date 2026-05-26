"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  BarChart3,
  ArrowLeft,
  LogOut,
  Library,
} from "lucide-react";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";
import Logo from "./Logo";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/courses", label: "Courses", icon: Library },
  { href: "/admin/instructors", label: "Instructors", icon: GraduationCap },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-void-black border-r border-[var(--border-subtle)] flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-[var(--border-subtle)]">
        <Logo size="md" />
        <p className="text-[10px] uppercase tracking-wider text-ash-gray mt-2 font-semibold">
          Admin
        </p>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-iron text-canvas-white border border-[var(--border-strong)]"
                  : "text-ash-gray hover:bg-coal hover:text-canvas-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[var(--border-subtle)] flex flex-col gap-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ash-gray hover:bg-coal hover:text-canvas-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to app
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ash-gray hover:bg-coal hover:text-canvas-white text-left"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
