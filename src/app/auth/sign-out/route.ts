import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { billingReturnOrigin } from "@/lib/billing/config";
import { endServerSession, expiredSessionCookie, sessionCookieNames } from "@/lib/sign-out";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  const names = new Set(sessionCookieNames(jar.getAll()));
  await endServerSession(await createSupabaseServer());
  for (const name of sessionCookieNames(jar.getAll())) names.add(name);

  const origin = billingReturnOrigin(request) ?? new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/`, 303);
  for (const name of names) {
    const cookie = expiredSessionCookie(name);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
