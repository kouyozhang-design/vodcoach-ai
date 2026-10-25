const PRICE_ID = /^price_[A-Za-z0-9]+$/;

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export { cleanEmail, stripeCustomerId, supabaseUserId } from "./ids.ts";

export function priceIdFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const price = clean(env.STRIPE_PRICE_ID);
  if (!PRICE_ID.test(price)) return null;
  return price;
}

export type BillingEnv = {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePriceId: string | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
};

export function readBillingEnv(env: NodeJS.ProcessEnv = process.env): BillingEnv {
  return {
    stripeSecretKey: clean(env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: clean(env.STRIPE_WEBHOOK_SECRET),
    stripePriceId: priceIdFromEnv(env),
    supabaseUrl: clean(env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: clean(env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function authReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const billing = readBillingEnv(env);
  return Boolean(billing.supabaseUrl && billing.supabaseAnonKey);
}

/** Checkout is refused unless Stripe and Supabase can both finish the loop. */
export function checkoutReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const billing = readBillingEnv(env);
  return Boolean(
    billing.stripeSecretKey &&
      billing.stripeWebhookSecret &&
      billing.stripePriceId &&
      billing.supabaseUrl &&
      billing.supabaseAnonKey &&
      billing.supabaseServiceRoleKey,
  );
}

export function webhookReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const billing = readBillingEnv(env);
  return Boolean(billing.stripeWebhookSecret && billing.supabaseUrl && billing.supabaseServiceRoleKey);
}

export function checkoutLocale(body: unknown): "ja" | "en" {
  if (!body || typeof body !== "object" || !("language" in body)) return "ja";
  const language = (body as { language?: unknown }).language;
  if (language === "en") return "en";
  return "ja";
}

export function checkoutSessionParams(input: {
  priceId: string;
  userId: string;
  email: string | null;
  customerId: string | null;
  origin: string;
  locale: "ja" | "en";
}) {
  const params: {
    mode: "subscription";
    line_items: [{ price: string; quantity: 1 }];
    success_url: string;
    cancel_url: string;
    client_reference_id: string;
    locale: "ja" | "en";
    metadata: { supabase_user_id: string };
    subscription_data: { metadata: { supabase_user_id: string } };
    customer?: string;
    customer_email?: string;
  } = {
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${input.origin}/?checkout=success`,
    cancel_url: `${input.origin}/?checkout=cancel`,
    client_reference_id: input.userId,
    locale: input.locale,
    metadata: { supabase_user_id: input.userId },
    subscription_data: { metadata: { supabase_user_id: input.userId } },
  };
  if (input.customerId) params.customer = input.customerId;
  else if (input.email) params.customer_email = input.email;
  return params;
}

export function billingReturnOrigin(request: Request, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.VERCEL_ENV === "production") {
    const production = clean(env.VERCEL_PROJECT_PRODUCTION_URL);
    if (production && !production.includes("/") && !production.includes("@")) {
      return `https://${production}`;
    }
  }
  const requestUrl = new URL(request.url);
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  const host = hostHeader.split(",")[0]?.trim() ?? "";
  if (!host || !/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host)) return null;
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwarded || requestUrl.protocol.replace(":", "");
  if (proto !== "https" && proto !== "http") return null;
  const hostname = host.split(":")[0] ?? "";
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (proto === "http" && !local) return null;
  return `${proto}://${host}`;
}
