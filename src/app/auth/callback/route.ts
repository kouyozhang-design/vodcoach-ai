import { NextResponse } from "next/server";
import { authReady, billingReturnOrigin } from "@/lib/billing/config";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = billingReturnOrigin(request) ?? url.origin;
  const code = url.searchParams.get("code");
  if (!authReady() || !code) {
    return NextResponse.redirect(`${origin}/auth?error=callback`);
  }
  const supabase = await createSupabaseServer();
  if (!supabase) return NextResponse.redirect(`${origin}/auth?error=callback`);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/auth?error=callback`);
  return NextResponse.redirect(`${origin}/`);
}
