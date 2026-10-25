import { NextResponse } from "next/server";
import {
  billingReturnOrigin,
  checkoutLocale,
  checkoutReady,
  checkoutSessionParams,
  cleanEmail,
  priceIdFromEnv,
  readBillingEnv,
  stripeCustomerId,
  supabaseUserId,
} from "@/lib/billing/config";
import { isStripeRedirect } from "@/lib/billing/redirect";
import { createStripe } from "@/lib/billing/stripe-server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!checkoutReady()) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }
  const supabase = await createSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = supabaseUserId(user?.id);
  if (!user || !userId) {
    return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const priceId = priceIdFromEnv();
  const billing = readBillingEnv();
  if (!priceId || !billing.stripeSecretKey) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }
  const origin = billingReturnOrigin(request);
  if (!origin) {
    return NextResponse.json({ error: "checkout_failed" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  const customerId = stripeCustomerId(profile?.stripe_customer_id);

  try {
    const stripe = createStripe(billing.stripeSecretKey);
    const session = await stripe.checkout.sessions.create(
      checkoutSessionParams({
        priceId,
        userId,
        email: cleanEmail(user.email),
        customerId,
        origin,
        locale: checkoutLocale(body),
      }),
    );
    if (!session.url || !isStripeRedirect(session.url, "checkout")) {
      return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch {
    console.error("stripe checkout create failed");
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
