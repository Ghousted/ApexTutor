"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LogOut, User as UserIcon } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { motion } from "motion/react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import { watchSubscription, type Subscription } from "@/lib/subscription";
import Logo from "@/components/Logo";
import LoadingDots from "@/components/LoadingDots";
import DiceBearAvatar, { STUDENT_STYLES } from "@/components/DiceBearAvatar";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /account — central settings surface that used to live nowhere.
 * Three sections:
 *   - Profile: studentName (only thing currently configurable)
 *   - Preferences: voice-on default, reduced-motion override (localStorage)
 *   - Subscription: plan + renewal status (read from Firestore via watch)
 */
export default function AccountClient() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Profile state
  const [studentName, setStudentName] = useState("");
  const [studentNameDraft, setStudentNameDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  // Avatar — student picks a DiceBear style + seed. Defaults to lorelei +
  // their uid as seed so the avatar is stable across sessions even before
  // they ever visit this page.
  const [avatarStyle, setAvatarStyle] = useState<string>(STUDENT_STYLES[0].id);
  const [avatarSeed, setAvatarSeed] = useState<string>("");

  // Subscription
  const [sub, setSub] = useState<Subscription | null>(null);

  // Preferences (localStorage-backed so they survive across devices the
  // student signs in on, even without writing to Firestore).
  const [voiceDefault, setVoiceDefault] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setHydrated(true);
        router.push("/");
        return;
      }
      setUser(u);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const profile = snap.data()?.profile ?? {};
        setStudentName(profile.studentName ?? "");
        setStudentNameDraft(profile.studentName ?? "");
        setAvatarStyle(profile.avatarStyle ?? STUDENT_STYLES[0].id);
        setAvatarSeed(profile.avatarSeed ?? u.uid);
      } catch (e) {
        console.warn("[Account] profile load failed:", e);
      }
      setHydrated(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchSubscription(user.uid, (s) => setSub(s));
    return () => unsub();
  }, [user]);

  // Hydrate preferences from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setVoiceDefault(localStorage.getItem("pref:voiceDefault") !== "off");
    setReducedMotion(localStorage.getItem("pref:reducedMotion") === "on");
  }, []);

  const saveProfile = async () => {
    if (!user || studentNameDraft.trim() === studentName) return;
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { profile: { studentName: studentNameDraft.trim() } },
        { merge: true }
      );
      setStudentName(studentNameDraft.trim());
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      console.warn("[Account] profile save failed:", e);
    } finally {
      setSavingProfile(false);
    }
  };

  /** Persist avatar pick to Firestore. Called immediately on each change so
   *  there's no separate "Save" — the avatar feels like a live choice. */
  const saveAvatar = async (style: string, seed: string) => {
    if (!user) return;
    setAvatarStyle(style);
    setAvatarSeed(seed);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { profile: { avatarStyle: style, avatarSeed: seed } },
        { merge: true }
      );
    } catch (e) {
      console.warn("[Account] avatar save failed:", e);
    }
  };

  const randomizeAvatarSeed = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    saveAvatar(avatarStyle, seed);
  };

  const togglePref = (key: "voiceDefault" | "reducedMotion") => {
    if (key === "voiceDefault") {
      const next = !voiceDefault;
      setVoiceDefault(next);
      localStorage.setItem("pref:voiceDefault", next ? "on" : "off");
    } else {
      const next = !reducedMotion;
      setReducedMotion(next);
      localStorage.setItem("pref:reducedMotion", next ? "on" : "off");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-void-black flex items-center justify-center">
        <LoadingDots size="md" label="Loading your account…" />
      </main>
    );
  }

  const planLabel = sub?.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : "Free";
  const planActive = Boolean(
    sub && sub.validUntil && sub.validUntil > Date.now() && sub.plan
  );
  const renewsOn = sub?.validUntil
    ? new Date(sub.validUntil).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-void-black inside-surface">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)]">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
        <Link
          href="/courses"
          className="inline-flex items-center gap-1 text-xs text-ash-gray hover:text-canvas-white"
        >
          <ArrowLeft className="w-3 h-3" /> Back to courses
        </Link>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto px-6 py-10 md:py-14"
      >
        <h1
          className="font-bold text-canvas-white mb-2"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.54px", lineHeight: 1.2 }}
        >
          Account
        </h1>
        <p className="text-ash-gray text-sm mb-10">
          Manage your profile, preferences, and subscription.
        </p>

        {/* ─── Profile ─────────────────────────────────────────────── */}
        <Section
          title="Profile"
          subtitle="The name your tutor uses in lessons."
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-iron border border-[var(--border-strong)] flex items-center justify-center text-canvas-white shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <input
              value={studentNameDraft}
              onChange={(e) => setStudentNameDraft(e.target.value)}
              placeholder="Your first name"
              className="flex-1 bg-iron border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-canvas-white placeholder-ash-gray text-sm focus:border-[var(--border-strong)] outline-none"
            />
            <button
              onClick={saveProfile}
              disabled={
                savingProfile ||
                studentNameDraft.trim() === studentName ||
                studentNameDraft.trim() === ""
              }
              className="px-4 py-2.5 bg-canvas-white text-void-black rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-opacity flex items-center gap-1.5"
            >
              {profileSaved ? (
                <>
                  <Check className="w-4 h-4" /> Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </Section>

        {/* ─── Avatar ───────────────────────────────────────────────── */}
        <Section
          title="Your avatar"
          subtitle="How you appear in the header. Click a style or roll the dice to remix."
        >
          <div className="flex items-center gap-4 mb-5">
            <DiceBearAvatar
              style={avatarStyle}
              seed={avatarSeed}
              size={72}
              className="border border-[var(--border-strong)]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-canvas-white font-medium mb-1">
                Looking good.
              </p>
              <button
                onClick={randomizeAvatarSeed}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-iron text-canvas-white rounded-md text-xs font-medium hover:bg-[#2e2e2e] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Roll the dice
              </button>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
            Style
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STUDENT_STYLES.map((s) => {
              const active = s.id === avatarStyle;
              return (
                <button
                  key={s.id}
                  onClick={() => saveAvatar(s.id, avatarSeed)}
                  className={cn(
                    "rounded-lg p-2 border transition-colors flex flex-col items-center gap-1",
                    active
                      ? "bg-iron border-canvas-white"
                      : "bg-iron/40 border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                  )}
                  title={s.label}
                >
                  <DiceBearAvatar
                    style={s.id}
                    seed={avatarSeed}
                    size={40}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-medium truncate w-full text-center",
                      active ? "text-canvas-white" : "text-ash-gray"
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ─── Preferences ─────────────────────────────────────────── */}
        <Section
          title="Preferences"
          subtitle="Defaults that apply across lessons."
        >
          <ToggleRow
            label="Voice on by default"
            description="Your tutor speaks each step's script aloud."
            checked={voiceDefault}
            onToggle={() => togglePref("voiceDefault")}
          />
          <ToggleRow
            label="Reduce motion"
            description="Skip non-essential animations. Also honours your system setting."
            checked={reducedMotion}
            onToggle={() => togglePref("reducedMotion")}
          />
        </Section>

        {/* ─── Subscription ────────────────────────────────────────── */}
        <Section
          title="Subscription"
          subtitle="Your current plan and renewal."
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-semibold text-canvas-white">
                {planLabel}
              </p>
              {planActive ? (
                <p className="text-xs text-ash-gray">
                  Renews {renewsOn ?? "soon"}
                </p>
              ) : (
                <p className="text-xs text-ash-gray">
                  No active subscription
                </p>
              )}
            </div>
            <Link
              href="/#pricing"
              className="px-4 py-2 bg-iron text-canvas-white rounded-lg text-sm font-medium hover:bg-[#2e2e2e] transition-colors shrink-0"
            >
              {planActive ? "Change plan" : "Upgrade"}
            </Link>
          </div>
          <p className="text-[11px] text-ash-gray leading-relaxed">
            Subscriptions are monthly and renew automatically through PayMongo.
            You can cancel anytime by not renewing on the next billing cycle.
          </p>
        </Section>

        {/* ─── Account actions ─────────────────────────────────────── */}
        <Section title="Account" subtitle={user?.email ?? ""}>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-ash-gray hover:text-canvas-white hover:bg-iron rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </Section>
      </motion.section>
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="mb-4">
        <h2 className="text-[11px] uppercase tracking-wider font-semibold text-ash-gray mb-1">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-ash-gray/80">{subtitle}</p>
        )}
      </div>
      <div className="bg-coal border border-[var(--border-subtle)] rounded-[14px] p-5 card-accent-top">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 border-b border-[var(--border-subtle)] last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-canvas-white">{label}</p>
        <p className="text-xs text-ash-gray mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={checked}
        className={cn(
          "relative w-10 h-6 rounded-full transition-colors shrink-0",
          checked ? "bg-canvas-white" : "bg-iron border border-[var(--border-strong)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full transition-transform",
            checked ? "translate-x-[18px] bg-void-black" : "translate-x-0.5 bg-canvas-white"
          )}
        />
      </button>
    </div>
  );
}
