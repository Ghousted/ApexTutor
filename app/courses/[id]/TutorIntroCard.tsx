"use client";

import { useRef, useState } from "react";
import { Volume2, Loader2, Square } from "lucide-react";
import TutorAvatar from "@/components/TutorAvatar";
import { getInstructor } from "@/lib/instructors";
import { synthesize, pcmToWavBlob, prefetchVoice } from "@/lib/tts";
import { cn } from "@/lib/utils";

/**
 * "Meet your tutor" block — bigger version of the avatar with persona +
 * subject + a one-tap voice preview. Lives at the top of the course detail
 * page so the trust-build happens before the student scrolls to "Start".
 */
export default function TutorIntroCard({
  instructorId,
  studentNameSample,
}: {
  instructorId: string | null;
  /** Optional name to weave into the sample line for personalization. */
  studentNameSample?: string | null;
}) {
  const instructor = instructorId ? getInstructor(instructorId) : null;
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  if (!instructor) return null;

  const sampleLine = composeSample(
    instructor.shortName,
    instructor.subject,
    studentNameSample ?? null
  );

  const stop = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlaying(false);
  };

  const handlePreview = async () => {
    if (playing) {
      stop();
      return;
    }
    setLoading(true);
    try {
      // Prefetch first — covers the cold-cache case where the voice model
      // hasn't loaded yet. The synthesize call below would do this too, but
      // showing a loader during prefetch is the honest UX.
      await prefetchVoice();
      const { audio, samplingRate } = await synthesize(
        sampleLine,
        "English",
        instructor.voiceId
      );
      const wav = pcmToWavBlob(audio, samplingRate);
      const url = URL.createObjectURL(wav);
      objectUrlRef.current = url;
      const el = new Audio(url);
      el.playbackRate = 1.05;
      audioRef.current = el;
      el.onended = () => stop();
      el.onerror = () => stop();
      setPlaying(true);
      await el.play().catch(() => stop());
    } catch (e) {
      console.warn("[TutorIntroCard] voice preview failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative bg-coal rounded-[14px] border border-[var(--border-subtle)] p-5 md:p-6 mb-6 overflow-hidden card-accent-top">
      {/* Aurora behind the avatar — gives the "meet your tutor" moment a
          subtle stage instead of a flat card. */}
      <div
        aria-hidden
        className="absolute -top-12 -left-6 w-48 h-48 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(circle at center, rgba(255,255,255,0.18), transparent 60%)",
          filter: "blur(40px)",
        }}
      />
      <div className="relative flex items-start gap-4 mb-4">
        <TutorAvatar
          instructorId={instructor.id}
          state={playing ? "talking" : "idle"}
          size={96}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-1">
            Your tutor · {instructor.subject}
          </p>
          <h3 className="text-lg md:text-xl font-bold text-canvas-white">
            {instructor.name}
          </h3>
          <p className="text-sm text-ash-gray mt-1 leading-relaxed">
            {instructor.tagline}
          </p>
        </div>
      </div>
      <button
        onClick={handlePreview}
        disabled={loading}
        className={cn(
          "relative inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
          playing
            ? "bg-canvas-white text-void-black"
            : "bg-iron text-canvas-white border border-[var(--border-strong)] hover:bg-[#2e2e2e]",
          loading && "opacity-60 cursor-wait"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading voice…
          </>
        ) : playing ? (
          <>
            <Square className="w-3 h-3" fill="currentColor" />
            Stop
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5" />
            Hear {instructor.shortName}&apos;s voice
          </>
        )}
      </button>
    </div>
  );
}

/** Tiny per-instructor sample line. We can't author a Kokoro voice clip
 *  ahead of time (the model is loaded client-side), so generate something
 *  short and friendly on demand. */
function composeSample(
  shortName: string,
  subject: string,
  studentName: string | null
): string {
  const who = studentName ? studentName : "friend";
  if (subject.toLowerCase().includes("math")) {
    return `Hi ${who}, I'm ${shortName}. Math feels easier when you can see it. Let's find a pattern together.`;
  }
  if (subject.toLowerCase().includes("science")) {
    return `Hi ${who}, I'm ${shortName}. The world is full of surprises — let's figure out one together.`;
  }
  return `Hi ${who}, I'm ${shortName}. Excited to learn with you today.`;
}
