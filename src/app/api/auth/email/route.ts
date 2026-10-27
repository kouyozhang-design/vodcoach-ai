import { NextResponse } from "next/server";
import { authReady, billingReturnOrigin, cleanEmail } from "@/lib/billing/config";
import { oauthCallbackUrl } from "@/lib/oauth";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authReady()) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }
  const supabase = await createSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const email = body && typeof body === "object" ? cleanEmail((body as { email?: unknown }).email) : null;
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const origin = billingReturnOrigin(request);
  if (!origin) return NextResponse.json({ error: "sign_in_failed" }, { status: 400 });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: oauthCallbackUrl(origin) },
  });
  if (error) {
    console.error("supabase email sign-in failed");
    return NextResponse.json({ error: "sign_in_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
