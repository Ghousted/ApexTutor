"use client";

import { useState } from "react";
import { Check, Copy, Loader2, RefreshCw, RotateCcw, Upload } from "lucide-react";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { INSTRUCTORS } from "@/lib/instructors";
import {
  useInstructorAvatar,
  setInstructorOverride,
  clearInstructorOverride,
  publishInstructorAvatar,
  unpublishInstructorAvatar,
} from "@/lib/instructorAvatar";
import DiceBearAvatar, { PROFESSOR_STYLES } from "@/components/DiceBearAvatar";
import { cn } from "@/lib/utils";

/**
 * Admin roster + DiceBear avatar picker. The instructor catalog itself is
 * still hard-coded in lib/instructors.ts — but admins can preview different
 * (style, seed) combinations locally via localStorage overrides. When they
 * settle on a final pick they like, the "Copy as code" button outputs the
 * snippet to paste back into the source file as the new default.
 */
export default function AdminInstructorsClient() {
  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-canvas-white">Instructors</h1>
        <p className="text-sm text-ash-gray mt-1">
          Roster is defined in code at{" "}
          <code className="text-xs bg-iron px-1.5 py-0.5 rounded">lib/instructors.ts</code>.
          Pick an avatar — your draft is kept in this browser. Hit{" "}
          <span className="text-canvas-white">Publish</span> to apply it for
          every student immediately (saved to Firestore — no redeploy needed).
          Or use <span className="text-canvas-white">Copy as code</span> to
          bake the pick into the source file later.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {INSTRUCTORS.map((i) => (
          <InstructorCard key={i.id} id={i.id} />
        ))}
      </div>
    </div>
  );
}

function InstructorCard({ id }: { id: string }) {
  const instructor = INSTRUCTORS.find((i) => i.id === id)!;
  const effective = useInstructorAvatar(id);
  const [seedDraft, setSeedDraft] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!effective) return null;

  const isOverridden =
    effective.style !== instructor.avatarStyle ||
    effective.seed !== instructor.avatarSeed;

  const randomSeed = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    setInstructorOverride(id, effective.style, seed);
    setSeedDraft(seed);
  };

  const applySeed = () => {
    const s = seedDraft.trim();
    if (!s) return;
    setInstructorOverride(id, effective.style, s);
  };

  const publish = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("Sign in first.");
      return;
    }
    setError(null);
    setPublishing(true);
    setPublished(false);
    try {
      const token = await getIdToken(user);
      await publishInstructorAvatar(id, effective.style, effective.seed, token);
      // Clear the local draft so the live (published) value shows directly.
      clearInstructorOverride(id);
      setSeedDraft("");
      setPublished(true);
      setTimeout(() => setPublished(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setError(null);
    try {
      const token = await getIdToken(user);
      await unpublishInstructorAvatar(id, token);
      setSeedDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  };

  const copyAsCode = async () => {
    const snippet = `avatarStyle: "${effective.style}",\n    avatarSeed: "${effective.seed}",`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-5 bg-coal border border-[var(--border-subtle)] rounded-[14px]">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <DiceBearAvatar
          style={effective.style}
          seed={effective.seed}
          size={72}
          rounded="lg"
          className="border border-[var(--border-strong)]"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray">
            {instructor.subject}
          </p>
          <h2 className="font-semibold text-canvas-white">{instructor.name}</h2>
          <p className="text-xs text-ash-gray mt-0.5">{instructor.tagline}</p>
        </div>
      </div>

      {/* Style picker */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
          Style
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PROFESSOR_STYLES.map((s) => {
            const active = effective.style === s.id;
            return (
              <button
                key={s.id}
                onClick={() =>
                  setInstructorOverride(id, s.id, effective.seed)
                }
                className={cn(
                  "text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors",
                  active
                    ? "bg-canvas-white text-void-black border-canvas-white"
                    : "bg-iron text-ash-gray border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-canvas-white"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seed editor */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ash-gray mb-2">
          Seed
        </p>
        <div className="flex items-center gap-1.5">
          <input
            value={seedDraft || effective.seed}
            onChange={(e) => setSeedDraft(e.target.value)}
            placeholder={instructor.avatarSeed}
            className="flex-1 bg-iron border border-[var(--border-subtle)] rounded-md px-3 py-2 text-canvas-white placeholder-ash-gray text-sm font-mono outline-none focus:border-[var(--border-strong)]"
          />
          <button
            onClick={applySeed}
            disabled={!seedDraft.trim() || seedDraft.trim() === effective.seed}
            className="px-3 py-2 bg-iron border border-[var(--border-subtle)] text-canvas-white rounded-md text-xs font-medium hover:bg-[#2e2e2e] disabled:opacity-50 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={randomSeed}
            className="px-3 py-2 bg-iron border border-[var(--border-subtle)] text-canvas-white rounded-md text-xs font-medium hover:bg-[#2e2e2e] transition-colors inline-flex items-center gap-1"
            title="Randomize"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)] flex-wrap">
        <button
          onClick={publish}
          disabled={publishing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-canvas-white text-void-black rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {publishing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : published ? (
            <Check className="w-3 h-3" />
          ) : (
            <Upload className="w-3 h-3" />
          )}
          {published ? "Live" : publishing ? "Publishing…" : "Publish"}
        </button>
        <button
          onClick={copyAsCode}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-iron border border-[var(--border-subtle)] text-canvas-white rounded-md text-xs font-medium hover:bg-[#2e2e2e] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy as code
            </>
          )}
        </button>
        {isOverridden && (
          <button
            onClick={() => {
              clearInstructorOverride(id);
              setSeedDraft("");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-ash-gray hover:text-canvas-white text-xs font-medium"
            title="Discard local draft"
          >
            <RotateCcw className="w-3 h-3" />
            Discard draft
          </button>
        )}
        <button
          onClick={unpublish}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-ash-gray hover:text-canvas-white text-xs font-medium ml-auto"
          title="Remove the published override — students will see the source default again"
        >
          Reset to default
        </button>
      </div>
      {error && (
        <p className="text-xs text-canvas-white bg-iron border border-[var(--border-strong)] rounded-md px-2 py-1 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
