"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { ArrowRight, Loader2, LogOut, Lock, Sparkles } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import { INSTRUCTORS } from "@/lib/instructors";
import { watchSubscription, hasActiveSubscription } from "@/lib/subscription";
import Logo from "@/components/Logo";
import AuthModal from "@/components/AuthModal";
import UpgradeModal from "@/components/UpgradeModal";

export default function InstructorsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingInstructorId, setPendingInstructorId] = useState<string | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const chatUrlFor = (instructorId: string) => {
    const params = new URLSearchParams({ instructor: instructorId });
    if (initialQuery) params.set("q", initialQuery);
    return `/chat?${params.toString()}`;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  // Live subscription state — flips lock overlays the moment a payment lands.
  useEffect(() => {
    if (!user) {
      setIsPaid(false);
      return;
    }
    const unsub = watchSubscription(user.uid, (sub) => {
      setIsPaid(hasActiveSubscription(sub));
    });
    return () => unsub();
  }, [user]);

  // After sign-in, if user was trying to enter an instructor, send them.
  useEffect(() => {
    if (user && pendingInstructorId) {
      router.push(chatUrlFor(pendingInstructorId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingInstructorId, router]);

  const handleStart = (instructorId: string) => {
    if (!user) {
      setPendingInstructorId(instructorId);
      setAuthModalOpen(true);
      return;
    }
    const instructor = INSTRUCTORS.find((i) => i.id === instructorId);
    if (instructor && !instructor.freeTier && !isPaid) {
      setUpgradeOpen(true);
      return;
    }
    router.push(chatUrlFor(instructorId));
  };

  const handleAuthClose = () => {
    setAuthModalOpen(false);
    if (!user) setPendingInstructorId(null);
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    try {
      await signOut();
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  const userInitial = (
    user?.displayName?.trim()?.[0] ||
    user?.email?.trim()?.[0] ||
    "?"
  ).toUpperCase();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-3">
        <button
          onClick={() => router.push("/")}
          className="hover:opacity-80 transition-opacity"
          aria-label="Apex Tutor home"
        >
          <Logo size="md" />
        </button>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden"
              aria-label="Account menu"
            >
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                userInitial
              )}
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 z-50 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {user.displayName || "Apex Tutor user"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setPendingInstructorId(null);
              setAuthModalOpen(true);
            }}
            className="px-4 py-2 bg-ink hover:bg-slate-800 text-white rounded-full text-xs font-medium transition-colors"
          >
            Sign in
          </button>
        )}
      </header>

      <section className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-ink mb-3">
            Choose your professor
          </h1>
          <p className="text-slate-500 text-sm md:text-base max-w-xl mx-auto">
            Each tutor specializes in a subject and teaches with their own
            style and voice. Pick one to start a lesson.
          </p>
          {initialQuery && (
            <p className="text-xs text-indigo-600 mt-3 italic">
              Your question &ldquo;{initialQuery}&rdquo; will be sent once you pick a
              professor.
            </p>
          )}
        </div>

        {!authResolved ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {INSTRUCTORS.map((i) => {
              const locked = !i.freeTier && !isPaid;
              return (
                <button
                  key={i.id}
                  onClick={() => handleStart(i.id)}
                  className="group relative text-left rounded-3xl p-7 transition-all bg-white border border-slate-200 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ ["--accent" as string]: i.accentColor }}
                >
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm shrink-0"
                      style={{ background: i.accentColor }}
                    >
                      {i.avatarInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p
                          className="text-xs uppercase tracking-wider font-semibold"
                          style={{ color: i.accentColor }}
                        >
                          {i.subject}
                        </p>
                        {locked && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-100 rounded-full px-1.5 py-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> PAID
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-bold text-ink">{i.name}</h2>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                    {i.tagline}
                  </p>

                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                    style={{ color: locked ? "#64748b" : i.accentColor }}
                  >
                    {locked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Upgrade to unlock
                      </>
                    ) : (
                      <>
                        Start lesson
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-10">
          More subjects coming soon — English, Filipino, History, and more.
        </p>
      </section>

      <AuthModal
        open={authModalOpen}
        onClose={handleAuthClose}
        defaultMode="signup"
        reason="Create a free account to start a lesson with your chosen professor."
      />
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        user={user}
        reason="This professor is part of the Starter and Family plans. Upgrade to unlock all subjects."
      />
    </main>
  );
}
