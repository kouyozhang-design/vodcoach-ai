import { NextResponse } from "next/server";
import { authReady, checkoutReady } from "@/lib/billing/config";
import { publicBillingState } from "@/lib/billing/events";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const signedOut = { configured: false, signedIn: false, status: null, canManage: false, email: null };

export async function GET() {
  if (!authReady()) return NextResponse.json(signedOut);
  const supabase = await createSupabaseServer();
  if (!supabase) return NextResponse.json(signedOut);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ...signedOut, configured: checkoutReady() });
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("status, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  return NextResponse.json(
    publicBillingState({
      configured: checkoutReady(),
      user: { id: user.id, email: user.email },
      profile: data,
      readFailed: Boolean(error),
    }),
  );
}
