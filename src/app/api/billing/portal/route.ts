import { NextResponse } from "next/server";
import {
  billingReturnOrigin,
  checkoutReady,
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  const customerId = stripeCustomerId(profile?.stripe_customer_id);
  if (!customerId) {
    return NextResponse.json({ error: "no_billing_account" }, { status: 409 });
  }
  const origin = billingReturnOrigin(request);
  const billing = readBillingEnv();
  if (!origin || !billing.stripeSecretKey) {
    return NextResponse.json({ error: "portal_failed" }, { status: 400 });
  }

  try {
    const stripe = createStripe(billing.stripeSecretKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });
    if (!session.url || !isStripeRedirect(session.url, "portal")) {
      return NextResponse.json({ error: "portal_failed" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch {
    console.error("stripe portal create failed");
    return NextResponse.json({ error: "portal_failed" }, { status: 502 });
  }
}
