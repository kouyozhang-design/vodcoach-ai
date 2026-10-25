const CHECKOUT_HOSTS = new Set(["checkout.stripe.com"]);
const PORTAL_HOSTS = new Set(["billing.stripe.com"]);

export function isStripeRedirect(url: string, kind: "checkout" | "portal"): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hosts = kind === "checkout" ? CHECKOUT_HOSTS : PORTAL_HOSTS;
    return hosts.has(parsed.hostname);
  } catch {
    return false;
  }
}
