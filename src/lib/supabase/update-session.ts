import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseProjectUrl } from "@/lib/oauth";
import { isSignOutPath } from "@/lib/sign-out";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (request.nextUrl.pathname.startsWith("/api/stripe/webhook")) return response;
  // A refresh here writes a new session cookie onto the logout response.
  if (isSignOutPath(request.nextUrl.pathname)) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const projectUrl = url ? supabaseProjectUrl(url) : null;
  if (!projectUrl || !anon) return response;

  const supabase = createServerClient(projectUrl, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    return response;
  }
  return response;
}
