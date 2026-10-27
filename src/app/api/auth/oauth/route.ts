import { createServerClient, parseCookieHeader, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { authReady, billingReturnOrigin, readBillingEnv } from "@/lib/billing/config";
import { oauthCallbackUrl, oauthProviderFromForm, supabaseAuthorizeUrl } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authPage(request: Request, origin: string | null, error: "missing" | "callback") {
  const path = `/auth?error=${error}`;
  const target = origin ? `${origin}${path}` : new URL(path, request.url).toString();
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request) {
  const origin = billingReturnOrigin(request);
  const form = await request.formData().catch(() => null);
  const provider = oauthProviderFromForm(form?.get("provider"));
  if (!provider) return authPage(request, origin, "callback");
  if (!authReady()) return authPage(request, origin, "missing");
  if (!origin) return authPage(request, origin, "callback");

  const billing = readBillingEnv();

  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  let cacheHeaders: Record<string, string> = {};
  const supabase = createServerClient(billing.supabaseUrl, billing.supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie") ?? "").filter((cookie) => cookie.name);
      },
      setAll(cookiesToSet, headers) {
        pending.splice(0, pending.length, ...cookiesToSet);
        cacheHeaders = headers;
      },
    },
  });

  const redirectTo = oauthCallbackUrl(origin);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  const url = !error && data.url ? supabaseAuthorizeUrl(data.url, billing.supabaseUrl, redirectTo, provider) : null;
  const verifier = pending.some((cookie) => cookie.name.endsWith("-code-verifier"));
  if (!url || !verifier) {
    console.error("supabase oauth sign-in failed");
    return authPage(request, origin, "callback");
  }

  const response = NextResponse.redirect(url, 303);
  for (const cookie of pending) response.cookies.set(cookie.name, cookie.value, cookie.options);
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  return response;
}
