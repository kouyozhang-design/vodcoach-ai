export const OAUTH_PROVIDERS = ["google", "apple", "discord"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function oauthProviderFromForm(value: unknown): OAuthProvider | null {
  if (typeof value !== "string") return null;
  return OAUTH_PROVIDERS.find((provider) => provider === value) ?? null;
}

/** Same path the email magic link already uses. */
export function oauthCallbackUrl(origin: string): string {
  return `${origin}/auth/callback`;
}

/**
 * Project root the Auth client should use. A saved URL of
 * `https://<project>.supabase.co/rest/v1` makes the client build
 * `/rest/v1/auth/v1/authorize`, which is not the provider redirect.
 * Only the origin, or a known Supabase API prefix, is accepted.
 */
const SUPABASE_API_PREFIX = /^\/(?:rest|auth|storage|functions|realtime)\/v1\/?$/;

export function supabaseProjectUrl(supabaseUrl: string): string | null {
  let base: URL;
  try {
    base = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") return null;
  if (base.username || base.password) return null;
  if (base.pathname !== "/" && !SUPABASE_API_PREFIX.test(base.pathname)) return null;
  return base.origin;
}

/**
 * Accept only the Supabase authorize URL for the requested provider.
 * redirect_to must be the existing callback. Anything else is refused.
 */
export function supabaseAuthorizeUrl(
  url: string,
  supabaseUrl: string,
  redirectTo: string,
  provider: OAuthProvider,
): string | null {
  let target: URL;
  let base: URL;
  try {
    target = new URL(url);
    base = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (target.protocol !== "https:") return null;
  if (target.username || target.password) return null;
  if (target.host !== base.host) return null;
  if (target.pathname !== "/auth/v1/authorize") return null;
  if (target.searchParams.get("provider") !== provider) return null;
  if (target.searchParams.get("redirect_to") !== redirectTo) return null;
  return target.toString();
}
