import { normalizeBillingClientState, type PublicBillingState } from "./events.ts";
import { isStripeRedirect } from "./redirect.ts";

export type CheckoutBody = { url?: unknown; error?: unknown } | null;

export type CheckoutClientResult =
  | { kind: "url"; url: string }
  | { kind: "auth" }
  | { kind: "not_configured" }
  | { kind: "no_account" }
  | { kind: "failed" };

/** Fail closed. A browser return or a missing env never looks like a paid session. */
export function interpretCheckoutResponse(status: number, body: CheckoutBody): CheckoutClientResult {
  if (status === 401) return { kind: "auth" };
  if (status === 503 || body?.error === "billing_not_configured") return { kind: "not_configured" };
  if (body?.error === "no_billing_account") return { kind: "no_account" };
  if (status < 200 || status >= 300 || typeof body?.url !== "string" || !isStripeRedirect(body.url, "checkout")) {
    return { kind: "failed" };
  }
  return { kind: "url", url: body.url };
}

export async function requestStripeCheckout(language: string): Promise<CheckoutClientResult> {
  try {
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language }),
    });
    const body = (await response.json().catch(() => null)) as CheckoutBody;
    return interpretCheckoutResponse(response.status, body);
  } catch {
    return { kind: "failed" };
  }
}

export async function readBillingStatus(): Promise<PublicBillingState> {
  const response = await fetch("/api/billing/status", { cache: "no-store" });
  const body = await response.json().catch(() => null);
  return normalizeBillingClientState(body);
}
