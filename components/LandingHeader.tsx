"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { LogOut, MessageSquare, Menu, X, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Avatar from "boring-avatars";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { auth, db } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import AuthModal from "./AuthModal";
import DiceBearAvatar from "./DiceBearAvatar";

const AVATAR_PALETTE = ["#ffffff", "#a3a3a3", "#262626", "#171717", "#f5f5f5"];

const NAV_ITEMS = [
  { id: "features", label: "Features" },
  { id: "testimonials", label: "Reviews" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

export default function LandingHeader() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [redirectAfterSignIn, setRedirectAfterSignIn] = useState(false);
  // DiceBear avatar prefs loaded from the student's Firestore profile.
  // Null means "fall back to the geometric Boring Avatars marble" so the
  // header still shows something while the profile is loading.
  const [avatarStyle, setAvatarStyle] = useState<string | null>(null);
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  // Header morphs from fully transparent (over the hero) to coal/blurred
  // once the user scrolls past the first viewport — keeps the page text
  // readable when the header sits over the Features section.
  const [scrolled, setScrolled] = useState(false);
  // Currently-visible section, used to highlight the active nav link.
  const [activeId, setActiveId] = useState<string>("top");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setAvatarStyle(null);
        setAvatarSeed(null);
        return;
      }
      // Pull avatar prefs out of the user's profile so the header reflects
      // their /account choice. Silent on failure — we just render the
      // Boring Avatars fallback.
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const profile = snap.data()?.profile ?? {};
        if (profile.avatarStyle && profile.avatarSeed) {
          setAvatarStyle(profile.avatarStyle);
          setAvatarSeed(profile.avatarSeed);
        }
      } catch {
        // ignore
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user && redirectAfterSignIn) {
      setRedirectAfterSignIn(false);
      router.push("/courses");
    }
  }, [user, redirectAfterSignIn, router]);

  // Scroll listener — flips `scrolled` after ~80px so the morph timing
  // matches the user's expectation of "the hero ended".
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section tracking — IntersectionObserver gives us cheap
  // "which section is currently in view" without listening to every scroll
  // event. We pick the section whose centre is closest to the viewport
  // centre by using a margin that shrinks the active band to the middle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ids = ["top", ...NAV_ITEMS.map((n) => n.id)];
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Multiple sections may be intersecting at once — pick the one whose
        // top is closest to ~30% from the viewport top.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort(
          (a, b) =>
            Math.abs(a.boundingClientRect.top - window.innerHeight * 0.3) -
            Math.abs(b.boundingClientRect.top - window.innerHeight * 0.3)
        );
        setActiveId(visible[0].target.id);
      },
      {
        rootMargin: "-30% 0px -55% 0px",
        threshold: 0,
      }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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

  const handleNavClick = (id: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      // scrollIntoView with smooth honors prefers-reduced-motion via globals.css
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Fallback seed for the geometric Boring Avatar when the student hasn't
  // picked a DiceBear style yet.
  const fallbackSeed = user?.uid || user?.email || "anon";

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled
            ? "bg-void-black/70 backdrop-blur-xl border-b border-[var(--border-subtle)]"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <button
            onClick={() => handleNavClick("top")}
            className="text-canvas-white font-bold tracking-[0.18em] text-sm hover:opacity-80 transition-opacity shrink-0"
          >
            APEX TUTOR
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-canvas-white"
                      : "text-ash-gray hover:text-canvas-white"
                  )}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute left-2 right-2 bottom-1 h-px bg-canvas-white"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <button
                  onClick={() => router.push("/courses")}
                  className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-canvas-white hover:text-ash-gray transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Start a lesson
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="w-9 h-9 rounded-full border border-[var(--border-strong)] hover:opacity-90 transition-opacity overflow-hidden"
                    aria-label="Account menu"
                  >
                    {user.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.photoURL}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : avatarStyle && avatarSeed ? (
                      <DiceBearAvatar
                        style={avatarStyle}
                        seed={avatarSeed}
                        size={36}
                      />
                    ) : (
                      <Avatar
                        size={36}
                        name={fallbackSeed}
                        variant="marble"
                        colors={AVATAR_PALETTE}
                      />
                    )}
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-12 z-50 w-60 bg-coal border border-[var(--border-subtle)] rounded-lg shadow-lg p-2">
                        <div className="px-3 py-2 border-b border-[var(--border-subtle)] mb-1">
                          <p className="text-sm font-medium text-canvas-white truncate">
                            {user.displayName || "Apex Tutor user"}
                          </p>
                          <p className="text-xs text-ash-gray truncate">
                            {user.email}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/courses");
                          }}
                          className="sm:hidden w-full flex items-center gap-2 px-3 py-2 text-sm text-ash-gray hover:bg-iron hover:text-canvas-white rounded-md"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Start a lesson
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/account");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ash-gray hover:bg-iron hover:text-canvas-white rounded-md"
                        >
                          <UserIcon className="w-4 h-4" />
                          Account
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ash-gray hover:bg-iron hover:text-canvas-white rounded-md"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => openAuth("signin")}
                  className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-canvas-white hover:text-ash-gray transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => openAuth("signup")}
                  className="px-5 py-2.5 bg-canvas-white hover:opacity-90 text-void-black rounded-lg text-sm font-medium transition-opacity shadow-md"
                >
                  Sign up
                </button>
              </>
            )}

            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden p-2 text-canvas-white hover:bg-iron rounded-md"
              aria-label="Open menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="md:hidden bg-void-black/95 backdrop-blur-xl border-t border-[var(--border-subtle)]"
            >
              <ul className="flex flex-col px-6 py-4 gap-1">
                {NAV_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                        activeId === item.id
                          ? "bg-iron text-canvas-white"
                          : "text-ash-gray hover:bg-coal hover:text-canvas-white"
                      )}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />
    </>
  );
}
