// Layered overrides for instructor avatars.
//
//   1. Source defaults  — lib/instructors.ts (compiled into the bundle)
//   2. Firestore        — config/instructorAvatarOverrides — admin-published,
//                         applies globally to all users without a redeploy
//   3. localStorage     — admin's per-browser draft while experimenting
//
// Resolution order (highest priority first):
//   localStorage > Firestore > source default
//
// Students see #1 + #2 (no localStorage). Admins see all three so they can
// preview a pick before publishing it.

"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { getInstructor, type Instructor } from "./instructors";

const LOCAL_KEY = "admin:instructorAvatarOverrides";
const FIRESTORE_DOC = ["config", "instructorAvatarOverrides"] as const;

interface OverrideMap {
  [instructorId: string]: { style: string; seed: string } | null;
}

function readLocal(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as OverrideMap;
  } catch {
    return {};
  }
}

function writeLocal(map: OverrideMap): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("instructor-avatar-override-changed"));
  }
}

/**
 * Subscribes to both layers. Returns the resolved (style, seed) for an
 * instructor — localStorage takes precedence over Firestore which takes
 * precedence over the source default.
 */
export function useInstructorAvatar(
  instructorId: string | null | undefined
): { style: string; seed: string } | null {
  const [localOverrides, setLocalOverrides] = useState<OverrideMap>({});
  const [remoteOverrides, setRemoteOverrides] = useState<OverrideMap>({});

  // Local (admin draft) state
  useEffect(() => {
    setLocalOverrides(readLocal());
    const onChange = () => setLocalOverrides(readLocal());
    window.addEventListener("instructor-avatar-override-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("instructor-avatar-override-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Firestore (published, global) state
  useEffect(() => {
    const ref = doc(db, FIRESTORE_DOC[0], FIRESTORE_DOC[1]);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setRemoteOverrides((snap.data() ?? {}) as OverrideMap);
      },
      // Silent on errors — falls back to defaults if the user isn't signed
      // in or the doc doesn't exist yet.
      () => setRemoteOverrides({})
    );
    return () => unsub();
  }, []);

  if (!instructorId) return null;
  const inst = getInstructor(instructorId);
  if (!inst) return null;
  const local = localOverrides[instructorId];
  const remote = remoteOverrides[instructorId];
  // null entry explicitly clears the override at that layer.
  if (local) return local;
  if (remote) return remote;
  return { style: inst.avatarStyle, seed: inst.avatarSeed };
}

/** Update the per-browser draft (admin preview only). */
export function setInstructorOverride(
  instructorId: string,
  style: string,
  seed: string
): void {
  const cur = readLocal();
  cur[instructorId] = { style, seed };
  writeLocal(cur);
}

/** Drop the local draft so the published / source value shows again. */
export function clearInstructorOverride(instructorId: string): void {
  const cur = readLocal();
  delete cur[instructorId];
  writeLocal(cur);
}

/**
 * Publishes the current (style, seed) for an instructor to Firestore so
 * every user sees it on next render. Requires an admin Firebase session;
 * the API route re-verifies admin server-side.
 */
export async function publishInstructorAvatar(
  instructorId: string,
  style: string,
  seed: string,
  idToken: string
): Promise<void> {
  const res = await fetch("/api/admin/instructor-avatars", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ instructorId, style, seed }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Publish failed");
  }
}

/** Wipe the Firestore-level override for one instructor back to the
 *  source default (the localStorage draft is also cleared). */
export async function unpublishInstructorAvatar(
  instructorId: string,
  idToken: string
): Promise<void> {
  const res = await fetch("/api/admin/instructor-avatars", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ instructorId, clear: true }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Reset failed");
  }
  clearInstructorOverride(instructorId);
}

/** Convenience: apply the resolved avatar to an instructor record. Used by
 *  helpers that don't want to call the hook (e.g., a memoized list). */
export function applyOverride(
  inst: Instructor,
  overrides: OverrideMap
): { style: string; seed: string } {
  const ov = overrides[inst.id];
  if (ov) return ov;
  return { style: inst.avatarStyle, seed: inst.avatarSeed };
}
