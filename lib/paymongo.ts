// PayMongo REST API wrapper — server-side only (uses secret key).
//
// Docs: https://developers.paymongo.com/reference/checkout-session
// We use Checkout Sessions (PayMongo-hosted page) — the user is redirected
// to PayMongo, pays via GCash/Maya/card, then redirected back to our app.
// On successful payment, PayMongo sends a webhook to /api/webhooks/paymongo.
//
// Auth: HTTP Basic, username = secret key, password = "".

import crypto from "crypto";

const API_BASE = "https://api.paymongo.com/v1";

export type Plan = "starter" | "family";

export interface PlanInfo {
  /** Plan id used in URLs / Firestore. */
  id: Plan;
  /** Display name. */
  name: string;
  /** Price in PHP centavos (₱199.00 = 19900). */
  amountCentavos: number;
}

export const PLANS: Record<Plan, PlanInfo> = {
  starter: { id: "starter", name: "Apex Tutor Starter", amountCentavos: 19900 },
  family: { id: "family", name: "Apex Tutor Family", amountCentavos: 39900 },
};

function authHeader(): string {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set");
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

/** Create a PayMongo Checkout Session and return the URL to redirect the user to. */
export async function createCheckoutSession(opts: {
  plan: Plan;
  uid: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; checkoutUrl: string }> {
  const plan = PLANS[opts.plan];
  if (!plan) throw new Error(`Unknown plan: ${opts.plan}`);

  const body = {
    data: {
      attributes: {
        line_items: [
          {
            currency: "PHP",
            amount: plan.amountCentavos,
            name: plan.name,
            description: "30 days of access",
            quantity: 1,
          },
        ],
        payment_method_types: ["card", "gcash", "paymaya", "qrph"],
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        description: `${plan.name} subscription`,
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        // Metadata flows through to the webhook so we know which user paid.
        metadata: {
          uid: opts.uid,
          plan: opts.plan,
        },
        billing: {
          email: opts.email,
        },
      },
    },
  };

  const res = await fetch(`${API_BASE}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayMongo checkout creation failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    id: data.data.id,
    checkoutUrl: data.data.attributes.checkout_url,
  };
}

/**
 * Verify a PayMongo webhook signature.
 *
 * Header format: "t=<timestamp>,te=<test_sig>,li=<live_sig>"
 * Algorithm: HMAC-SHA256 of `<timestamp>.<raw_body>` using webhook secret,
 * compared against `te` (test) or `li` (live).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [k, v] = segment.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const timestamp = parts.t;
  const provided = parts.te || parts.li;
  if (!timestamp || !provided) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // Constant-time compare to avoid timing leaks.
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
