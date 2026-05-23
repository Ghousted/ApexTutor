import { NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/paymongo";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

/**
 * PayMongo webhook handler.
 *
 * We listen for `payment.paid` events. The original checkout session was
 * created with metadata { uid, plan }, which PayMongo echoes back in the
 * event payload so we know which user just paid and what they bought.
 *
 * On success we set users/{uid}.subscription with a 30-day validUntil.
 * The chat UI subscribes to this doc and unlocks features automatically.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("paymongo-signature");
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error("PAYMONGO_WEBHOOK_SECRET not set");
    return new Response("Server not configured", { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, sig, secret)) {
    console.warn("PayMongo webhook signature mismatch");
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { data?: { attributes?: { type?: string; data?: unknown } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event.data?.attributes?.type;

  // We only act on successful payments. Ignore everything else (refunds,
  // failed attempts, source events, etc. — log if you want to surface them).
  if (eventType !== "payment.paid") {
    return Response.json({ received: true, ignored: eventType });
  }

  // Drill into the nested attributes — PayMongo wraps event.data.attributes.data
  // around the actual payment object.
  type PaymentAttrs = {
    id?: string;
    attributes?: {
      metadata?: { uid?: string; plan?: string };
      amount?: number;
      status?: string;
    };
  };
  const payment = event.data?.attributes?.data as PaymentAttrs | undefined;
  const uid = payment?.attributes?.metadata?.uid;
  const plan = payment?.attributes?.metadata?.plan;
  const paymentId = payment?.id;

  if (!uid || (plan !== "starter" && plan !== "family")) {
    console.warn("Webhook missing uid/plan metadata", { uid, plan });
    return Response.json({ received: true, skipped: "missing metadata" });
  }

  // Grant 30 days of access from now. If they're already paid and renewing,
  // extend from whichever is later — current expiry or now.
  const db = adminDb();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const existingValidUntil =
    (snap.data()?.subscription?.validUntil as { toMillis?: () => number })?.toMillis?.() ?? 0;
  const baseline = Math.max(Date.now(), existingValidUntil);
  const newValidUntil = baseline + 30 * 24 * 60 * 60 * 1000; // +30 days

  await userRef.set(
    {
      subscription: {
        plan,
        status: "active",
        validUntil: new Date(newValidUntil),
        lastPaymentId: paymentId ?? null,
        lastPaymentAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );

  console.log(`Subscription activated: uid=${uid} plan=${plan} validUntil=${new Date(newValidUntil).toISOString()}`);
  return Response.json({ received: true });
}
