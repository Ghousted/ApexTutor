"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Logo from "./Logo";
import AuthModal from "./AuthModal";

const OUTLINED_QUESTIONS = [
  "How to study addition and subtraction?",
  "Outline all the topics for my science subject.",
  "Explain physics to me like a 5 year old.",
];

export default function HeroSection() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // After successful sign-in, if there's a pending query, carry it to the
  // instructor selector (user picks a professor → chat starts with the query).
  useEffect(() => {
    if (user && pendingQuery && !navigatedRef.current) {
      navigatedRef.current = true;
      router.push(`/courses?q=${encodeURIComponent(pendingQuery)}`);
    }
  }, [user, pendingQuery, router]);

  const handleSubmit = (message?: string) => {
    const query = (message ?? inputValue).trim();
    if (!query) return;
    if (!user) {
      setPendingQuery(query);
      setAuthOpen(true);
      return;
    }
    router.push(`/courses?q=${encodeURIComponent(query)}`);
  };

  const handleAuthClose = () => {
    setAuthOpen(false);
    // If user closed without signing in, clear the pending query so a future
    // submit doesn't accidentally trigger navigation.
    if (!user) setPendingQuery(null);
  };

  return (
    <section className="relative pt-16 pb-32 px-4 bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-white">
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <div className="flex justify-center mb-10">
          <Logo size="md" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-ink mb-12 tracking-tight leading-tight">
          99% cheaper than getting
          <br />
          a real-world tutor.
        </h1>

        <div className="relative max-w-2xl mx-auto mb-5">
          <div className="flex items-center bg-white border-2 border-indigo-400/70 rounded-full overflow-hidden shadow-sm focus-within:border-indigo-500 focus-within:shadow-md transition-all">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="What topic or subject do you need help with?"
              className="flex-1 bg-transparent px-6 py-4 text-ink placeholder-slate-400 outline-none text-sm"
            />
            <button
              onClick={() => handleSubmit()}
              className="m-1.5 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full font-medium text-sm flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
            >
              Send <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
          {OUTLINED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
              className="text-left px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <AuthModal
        open={authOpen}
        onClose={handleAuthClose}
        defaultMode="signup"
        reason="Create a free account to start chatting with Apex Tutor. Your conversation will pick up right where you left off."
      />
    </section>
  );
}
