// Subscription state — read from the client SDK, written by the webhook
// through the admin SDK. Same Firestore docs, different access paths.
//
// Free tier limits (current MVP):
//   - 10 chat messages per day
//   - Only the default instructor (Maria) unlocked
//   - No image uploads
// Paid tiers (starter / family) get unlimited messages, all instructors,
// and image uploads.

import { doc, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { Plan } from "./paymongo";

export type SubscriptionStatus = "active" | "expired" | "cancelled";

export interface Subscription {
  plan: Plan;
  status: SubscriptionStatus;
  /** Epoch milliseconds. Access is granted until now() < validUntil. */
  validUntil: number;
  lastPaymentId?: string;
  lastPaymentAt?: number;
}

export const FREE_DAILY_MESSAGE_LIMIT = 10;

/** True if the user currently has a paid plan that hasn't expired. */
export function hasActiveSubscription(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  return sub.validUntil > Date.now();
}

/** Convenience: which features the user can access right now. */
export interface Entitlements {
  isPaid: boolean;
  canUseAllInstructors: boolean;
  canUploadImages: boolean;
  unlimitedMessages: boolean;
  dailyMessageLimit: number;
}

export function entitlementsFor(sub: Subscription | null | undefined): Entitlements {
  const isPaid = hasActiveSubscription(sub);
  return {
    isPaid,
    canUseAllInstructors: isPaid,
    canUploadImages: isPaid,
    unlimitedMessages: isPaid,
    dailyMessageLimit: isPaid ? Infinity : FREE_DAILY_MESSAGE_LIMIT,
  };
}

/** One-shot read of a user's subscription. */
export async function fetchSubscription(uid: string): Promise<Subscription | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return readSubFromSnapshot(snap.data());
}

/** Subscribe to live updates. Returns the Firestore unsubscribe fn. */
export function watchSubscription(
  uid: string,
  cb: (sub: Subscription | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? readSubFromSnapshot(snap.data()) : null);
  });
}

function readSubFromSnapshot(data: Record<string, unknown> | undefined): Subscription | null {
  const raw = data?.subscription as
    | {
        plan?: Plan;
        status?: SubscriptionStatus;
        validUntil?: Timestamp | number;
        lastPaymentId?: string;
        lastPaymentAt?: Timestamp | number;
      }
    | undefined;
  if (!raw?.plan || !raw?.validUntil) return null;
  return {
    plan: raw.plan,
    status: raw.status ?? "active",
    validUntil: toMillis(raw.validUntil),
    lastPaymentId: raw.lastPaymentId,
    lastPaymentAt: raw.lastPaymentAt ? toMillis(raw.lastPaymentAt) : undefined,
  };
}

function toMillis(v: Timestamp | number): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as Timestamp).toMillis === "function") return (v as Timestamp).toMillis();
  return 0;
}

// --- Daily usage tracking (free tier message cap) -----------------------

/** "YYYY-MM-DD" in the user's local timezone. */
export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  count: number;
}
