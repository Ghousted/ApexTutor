import { NextRequest } from "next/server";
import { createCheckoutSession, type Plan } from "@/lib/paymongo";

// Not edge — PayMongo SDK uses Node's `crypto` for signature verification
// (only relevant in the webhook route, but consistent runtime is simpler).
export const runtime = "nodejs";

interface CheckoutBody {
  plan: Plan;
  uid: string;
  email: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CheckoutBody;

    // Surface clean, user-friendly validation errors. Raw missing-field
    // messages confuse end users; we map to plain English.
    if (!body.uid) {
      return Response.json(
        { error: "Please sign in first to subscribe." },
        { status: 400 }
      );
    }
    if (!body.email) {
      return Response.json(
        { error: "Your account is missing an email — sign out and sign back in to refresh." },
        { status: 400 }
      );
    }
    if (!body.plan) {
      return Response.json({ error: "Please pick a plan." }, { status: 400 });
    }
    if (body.plan !== "starter" && body.plan !== "family") {
      return Response.json({ error: "That plan isn't available." }, { status: 400 });
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    try {
      const session = await createCheckoutSession({
        plan: body.plan,
        uid: body.uid,
        email: body.email,
        successUrl: `${origin}/billing/success?session={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/billing/cancelled`,
      });
      return Response.json({ url: session.checkoutUrl });
    } catch (e) {
      // Log the full PayMongo error server-side so we can debug, but return
      // a clean message to the client. The full reason often includes
      // internal details (API keys, raw HTTP, etc.) we don't want exposed.
      console.error("PayMongo checkout failed:", e);
      const raw = e instanceof Error ? e.message : "";
      const friendly = humanizeCheckoutError(raw);
      return Response.json({ error: friendly }, { status: 502 });
    }
  } catch (e) {
    console.error("Checkout route unexpected error:", e);
    return Response.json(
      { error: "Something went wrong starting checkout. Please try again." },
      { status: 500 }
    );
  }
}

function humanizeCheckoutError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("paymongo_secret_key")) {
    return "Payments aren't configured yet. Please contact support.";
  }
  if (lower.includes("401") || lower.includes("unauthor")) {
    return "Payment processor rejected our credentials. Please try again later.";
  }
  if (lower.includes("rate")) {
    return "Too many requests. Wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Couldn't reach the payment processor. Check your connection and try again.";
  }
  return "We couldn't start your checkout. Please try again — if it keeps happening, contact support.";
}
