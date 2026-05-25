"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, User as UserIcon, Cake, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { synthesizeStream, pcmToWavBlob } from "@/lib/tts";

const AGES = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

/**
 * Post-signup onboarding. The parent is the one creating the account; this
 * modal collects the student's first name + age so the AI tutor can
 * personalize its greeting, pick the right starting lesson, and calibrate
 * difficulty for the student's grade.
 *
 * Required, not skippable — the whole product depends on knowing who the
 * student is.
 */
export default function OnboardingModal({
  open,
  parentName,
  onSubmit,
}: {
  open: boolean;
  parentName?: string | null;
  onSubmit: (data: { studentName: string; studentAge: number }) => Promise<void> | void;
}) {
  const [studentName, setStudentName] = useState("");
  const [studentAge, setStudentAge] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Auto-played welcome voice. Fires once on first mount, satisfies browser
  // autoplay policy because the modal is opened right after the user clicked
  // "Sign up" / "Continue with Google".
  const [voicePlaying, setVoicePlaying] = useState(false);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const objectUrlsRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);
  const hasStartedRef = useRef(false);

  const stopVoice = () => {
    cancelledRef.current = true;
    audioElementsRef.current.forEach((a) => {
      try {
        a.pause();
        a.src = "";
      } catch {
        // ignore — element already torn down
      }
    });
    audioElementsRef.current = [];
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
    setVoicePlaying(false);
  };

  useEffect(() => {
    if (!open) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    cancelledRef.current = false;

    const firstName = parentName?.trim()?.split(" ")?.[0];
    const greeting = firstName
      ? `Welcome to Apex Tutor, ${firstName}! Let's set up your child's tutor. This will only take a moment.`
      : `Welcome to Apex Tutor! Let's set up your child's tutor. This will only take a moment.`;

    (async () => {
      try {
        setVoicePlaying(true);
        for await (const chunk of synthesizeStream(greeting, "English", "af_heart")) {
          if (cancelledRef.current) break;
          if (!chunk?.audio || chunk.audio.length === 0) continue;
          const wav = pcmToWavBlob(chunk.audio, chunk.samplingRate);
          const url = URL.createObjectURL(wav);
          objectUrlsRef.current.push(url);
          const el = new Audio(url);
          el.playbackRate = 1.05;
          audioElementsRef.current.push(el);
          // Play this chunk and wait for it to finish (or be cancelled) before
          // moving to the next — keeps sentences in order without overlap.
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            el.onended = done;
            el.onerror = done;
            el.play().catch(done);
            // Safety: in case onended doesn't fire (Safari quirk on short
            // clips), force-resolve after expected duration + buffer.
            const safety = ((el.duration || 6) * 1000) / 1.05 + 1000;
            setTimeout(done, safety);
          });
          if (cancelledRef.current) break;
        }
      } catch (e) {
        // Voice is non-essential — if browser blocks autoplay or Kokoro fails
        // to load, the modal still works visually. Log and move on.
        console.warn("[onboarding voice] failed silently:", e);
      } finally {
        if (!cancelledRef.current) setVoicePlaying(false);
      }
    })();

    return () => {
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = studentName.trim();
    if (!name) {
      setError("Please enter your child's first name.");
      return;
    }
    if (studentAge === null) {
      setError("Please pick your child's age.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ studentName: name, studentAge });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-7">
        {/* Voice indicator — pulses while the welcome message is being read
            aloud. Click to silence it. */}
        <button
          type="button"
          onClick={() => (voicePlaying ? stopVoice() : null)}
          disabled={!voicePlaying}
          className={cn(
            "absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
            voicePlaying
              ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200 cursor-pointer"
              : "text-slate-300 cursor-default"
          )}
          aria-label={voicePlaying ? "Stop voice" : "Voice idle"}
          title={voicePlaying ? "Stop voice" : ""}
        >
          {voicePlaying ? (
            <>
              <Volume2 className="w-4 h-4" />
              <span className="absolute inset-0 rounded-full ring-2 ring-indigo-400 animate-ping opacity-60" />
            </>
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-2xl bg-indigo-50 text-indigo-600">
          <Sparkles className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold text-ink text-center mb-1">
          {parentName ? `Welcome, ${parentName.split(" ")[0]}!` : "Welcome!"}
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
          Let&apos;s set up your child&apos;s tutor. This takes 30 seconds.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Student first name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Your child&apos;s first name
            </label>
            <div className="flex items-center gap-2.5 px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <UserIcon className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="e.g., Liam"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                disabled={submitting}
                autoFocus
                className="flex-1 bg-transparent text-sm text-ink placeholder-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Student age */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cake className="w-3.5 h-3.5" /> How old are they?
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {AGES.map((age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => setStudentAge(age)}
                  disabled={submitting}
                  className={cn(
                    "py-2.5 rounded-lg text-sm font-medium transition-all border",
                    studentAge === age
                      ? "bg-indigo-500 text-white border-indigo-500 shadow"
                      : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                  )}
                >
                  {age}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              We&apos;ll match the lessons to their grade level automatically.
            </p>
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all",
              "bg-ink hover:bg-slate-800 text-white",
              submitting && "opacity-70 cursor-wait"
            )}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Start learning
          </button>
        </form>
      </div>
    </div>
  );
}

/** Map student age to Filipino school grade (capped at 12). */
export function ageToGradeLevel(age: number): number {
  return Math.min(12, Math.max(4, age - 5));
}
