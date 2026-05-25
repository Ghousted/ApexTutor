// Auth helpers that wrap Firebase Auth + ensure a user profile doc exists in
// Firestore on every sign-in. Use these instead of calling firebase/auth
// methods directly so the profile creation stays in one place.

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

/** Create users/{uid} profile doc on first sign-in. Idempotent. */
export async function ensureUserProfile(user: FirebaseUser) {
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  // The user signing up IS the parent. Mirror the displayName into
  // profile.parentName so the rest of the app has a clean field for it
  // regardless of how the parent signed up (email/password vs Google).
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    createdAt: serverTimestamp(),
    profile: {
      parentName: user.displayName ?? null,
    },
  });
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/** Convert Firebase auth error codes to short, user-friendly messages. */
export function describeAuthError(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "That doesn't look like a valid email.";
    case "auth/missing-password":
      return "Please enter a password.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/email-already-in-use":
      return "An account already exists with that email. Try signing in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a minute.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return ""; // user cancelled — don't show an error
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
