/** Form target. The proxy must not refresh the session on this path. */
export const SIGN_OUT_PATH = "/auth/sign-out";

const SESSION_COOKIE_NAME = /^sb-.+-auth-token(?:\.\d+)?$/;

type SessionReader = {
  auth: {
    getUser: () => PromiseLike<{ data: { user: unknown } }>;
  };
};

type SessionEnder = {
  auth: {
    signOut: () => PromiseLike<unknown>;
  };
};

export function isSignOutPath(pathname: string): boolean {
  return pathname === SIGN_OUT_PATH;
}

/** True when this node is the logout form. Other submits stay cancelled. */
export function isSignOutForm(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const read = (target as { getAttribute?: unknown }).getAttribute;
  if (typeof read !== "function") return false;
  return read.call(target, "action") === SIGN_OUT_PATH;
}

/** Auth-token cookies only. Code verifiers and other cookies stay. */
export function sessionCookieNames(cookies: { name: string }[]): string[] {
  return cookies.map((cookie) => cookie.name).filter((name) => SESSION_COOKIE_NAME.test(name));
}

/** Empty value, Max-Age 0, and an Expires date in the past. Safari drops the cookie. */
export function expiredSessionCookie(name: string): {
  name: string;
  value: "";
  options: {
    path: "/";
    maxAge: 0;
    expires: Date;
    sameSite: "lax";
    httpOnly: false;
  };
} {
  return {
    name,
    value: "",
    options: {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: "lax",
      httpOnly: false,
    },
  };
}

export async function sessionIsPresent(supabase: SessionReader | null): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

/** Clears the Supabase server session only. Saved coaching stays in the browser. */
export async function endServerSession(supabase: SessionEnder | null): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
