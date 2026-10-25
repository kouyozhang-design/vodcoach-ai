import Stripe from "stripe";

export function verifyStripeWebhook(payload: string, signature: string | null, secret: string): Stripe.Event {
  if (!signature || !secret) {
    throw new Error("missing_signature");
  }
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}

export function createStripe(secretKey: string): Stripe {
  return new Stripe(secretKey);
}
