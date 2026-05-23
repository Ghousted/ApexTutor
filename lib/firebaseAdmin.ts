// Firebase Admin SDK — used ONLY in server-side code (API routes, webhooks)
// that need to read/write Firestore as a privileged service, bypassing the
// per-user security rules.
//
// Setup: paste the entire service-account JSON into FIREBASE_ADMIN_KEY as a
// single-line string. Get it from Firebase Console → Project Settings →
// Service Accounts → Generate new private key.

import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    return adminApp;
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

  adminApp = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
  return adminApp;
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
