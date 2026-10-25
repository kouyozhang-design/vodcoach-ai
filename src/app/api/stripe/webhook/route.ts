import { NextResponse } from "next/server";
import { readBillingEnv, webhookReady } from "@/lib/billing/config";
import { profileWriteFor, statusChangeForEvent } from "@/lib/billing/events";
import { writeProfileStatus } from "@/lib/billing/profile";
import { verifyStripeWebhook } from "@/lib/billing/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  const billing = readBillingEnv();
  if (!webhookReady() || !billing.stripeWebhookSecret) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  let event: ReturnType<typeof verifyStripeWebhook>;
  try {
    event = verifyStripeWebhook(payload, request.headers.get("stripe-signature"), billing.stripeWebhookSecret);
  } catch {
    console.error("stripe webhook signature rejected");
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const change = statusChangeForEvent(event);
  if (!change) return NextResponse.json({ received: true });
  const plan = profileWriteFor(change);
  if (!plan) {
    console.error("stripe webhook event had no user");
    return NextResponse.json({ error: "unattributed" }, { status: 500 });
  }

  try {
    const result = await writeProfileStatus(plan);
    if (result === "missing") {
      console.error("stripe webhook profile missing");
      return NextResponse.json({ error: "profile_missing" }, { status: 500 });
    }
  } catch {
    console.error("stripe webhook profile write failed");
    return NextResponse.json({ error: "profile_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
