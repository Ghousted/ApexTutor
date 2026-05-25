// Firebase Admin SDK — used ONLY in server-side code (API routes, webhooks)
// that need to read/write Firestore as a privileged service, bypassing the
// per-user security rules.
//
// Setup: paste the entire service-account JSON into FIREBASE_ADMIN_KEY as a
// single-line string. Get it from Firebase Console → Project Settings →
// Service Accounts → Generate new private key.

import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }

  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_ADMIN_KEY env var is not set. Paste the service-account JSON from Firebase Console > Project Settings > Service Accounts."
    );
  }

  let serviceAccount: { project_id: string; client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_ADMIN_KEY is not valid JSON.");
  }

  // Replace escaped newlines (some platforms escape \n in env vars).
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  cachedApp = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
  return cachedApp;
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

/** Public-named alias of getAdminApp for use by other server helpers
 *  (e.g., adminAuth.ts needs the App to access firebase-admin/auth). */
export function adminApp() {
  return getAdminApp();
}
