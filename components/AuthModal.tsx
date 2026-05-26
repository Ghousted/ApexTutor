"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Mail, Lock, User as UserIcon, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  describeAuthError,
} from "@/lib/auth";

type Mode = "signin" | "signup";

export default function AuthModal({
  open,
  onClose,
  defaultMode = "signin",
  reason,
}: {
  open: boolean;
  onClose: () => void;
  defaultMode?: Mode;
  reason?: string;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset everything when the modal opens. Without this, switching between
  // Sign in / Sign up buttons would show stale state from the last open.
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError("");
      setEmail("");
      setPassword("");
      setName("");
      setSubmitting(false);
    }
  }, [open, defaultMode]);

  const isSignUp = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name);
      }
      onClose();
    } catch (err) {
      setError(describeAuthError(err) || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      const msg = describeAuthError(err);
      if (msg) setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="relative bg-coal rounded-[14px] shadow-2xl w-full max-w-md p-7"
          >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-iron text-ash-gray hover:text-canvas-white/90"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {isSignUp ? (
          <div className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-iron text-canvas-white text-[11px] font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3 h-3" />
              Free forever
            </div>
            <h2 className="text-2xl font-bold text-canvas-white mb-1.5">
              Create your child&apos;s account
            </h2>
            <p className="text-sm text-ash-gray">
              {reason ||
                "Parents sign up here. After this, we'll ask a few quick things about your child to set up their tutor."}
            </p>
          </div>
        ) : (
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-canvas-white mb-1.5">Welcome back</h2>
            <p className="text-sm text-ash-gray">
              {reason ||
                "Sign in to pick up your conversations right where you left off."}
            </p>
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 mb-4 border border-[var(--border-subtle)] rounded-lg text-canvas-white/90 font-medium text-sm hover:bg-coal transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-iron" />
          <span className="text-xs text-ash-gray uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-iron" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <Field
              icon={<UserIcon className="w-4 h-4" />}
              type="text"
              placeholder="Parent's name (you)"
              value={name}
              onChange={setName}
              disabled={submitting}
            />
          )}
          <Field
            icon={<Mail className="w-4 h-4" />}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={setEmail}
            disabled={submitting}
            required
            autoComplete="email"
          />
          <Field
            icon={<Lock className="w-4 h-4" />}
            type="password"
            placeholder={mode === "signup" ? "Create a password (6+ characters)" : "Password"}
            value={password}
            onChange={setPassword}
            disabled={submitting}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          {error && (
            <p className="text-sm text-canvas-white bg-coal border border-[var(--border-subtle)] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-canvas-white hover:opacity-90 disabled:opacity-50 text-void-black rounded-lg font-medium text-sm transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUp ? "Create my account" : "Sign in"}
          </button>

          {isSignUp && (
            <p className="text-[11px] text-center text-ash-gray leading-relaxed">
              By creating an account you agree to our Terms of Service and
              Privacy Policy.
            </p>
          )}
        </form>

        <p className="text-center text-sm text-ash-gray mt-5">
          {isSignUp ? "Already have an account? " : "New to Apex Tutor? "}
          <button
            onClick={() => {
              setMode(isSignUp ? "signin" : "signup");
              setError("");
            }}
            className="text-canvas-white hover:text-canvas-white font-medium"
          >
            {isSignUp ? "Sign in" : "Create a free account"}
          </button>
        </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field(props: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 border border-[var(--border-subtle)] rounded-lg bg-coal focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-canvas-white transition-all",
        props.disabled && "opacity-60"
      )}
    >
      <span className="text-ash-gray">{props.icon}</span>
      <input
        type={props.type}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        required={props.required}
        autoComplete={props.autoComplete}
        className="flex-1 bg-transparent text-sm text-canvas-white placeholder-ash-gray outline-none"
      />
    </div>
  );
}
