"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { LogOut, MessageSquare } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import AuthModal from "./AuthModal";

export default function LandingHeader() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [redirectAfterSignIn, setRedirectAfterSignIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // When the user signs in from this header, take them to the instructor
  // picker (the natural next step in the onboarding flow).
  useEffect(() => {
    if (user && redirectAfterSignIn) {
      setRedirectAfterSignIn(false);
      router.push("/courses");
    }
  }, [user, redirectAfterSignIn, router]);

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setRedirectAfterSignIn(true);
    setAuthModalOpen(true);
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
    <>
      <header className="absolute top-0 left-0 right-0 z-20 px-6 md:px-10 py-5 flex items-center justify-end">
        {user ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/courses")}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-ink hover:text-indigo-600 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Start a lesson
            </button>
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
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/courses");
                      }}
                      className="sm:hidden w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Start a lesson
                    </button>
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
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuth("signin")}
              className="px-4 py-2 text-sm font-medium text-ink hover:text-indigo-600 transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => openAuth("signup")}
              className="px-4 py-2 bg-ink hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-colors"
            >
              Sign up
            </button>
          </div>
        )}
      </header>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />
    </>
  );
}
