import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseProjectUrl } from "@/lib/oauth";

export async function createSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const projectUrl = url ? supabaseProjectUrl(url) : null;
  if (!projectUrl || !anon) return null;
  const cookieStore = await cookies();
  return createServerClient(projectUrl, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. src/proxy.ts refreshes the session.
        }
      },
    },
  });
}
