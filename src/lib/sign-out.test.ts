import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COACH_LANGUAGES } from "./coach-language.ts";
import {
  endServerSession,
  expiredSessionCookie,
  isSignOutForm,
  isSignOutPath,
  sessionCookieNames,
  sessionIsPresent,
  SIGN_OUT_PATH,
} from "./sign-out.ts";
import { uiCopy } from "./ui-copy.ts";

test("a server session is present only when getUser returns a user", async () => {
  assert.equal(await sessionIsPresent(null), false);
  assert.equal(
    await sessionIsPresent({
      auth: { getUser: async () => ({ data: { user: null } }) },
    }),
    false,
  );
  assert.equal(
    await sessionIsPresent({
      auth: {
        getUser: async () => {
          throw new Error("auth down");
        },
      },
    }),
    false,
  );
  assert.equal(
    await sessionIsPresent({
      auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    }),
    true,
  );
});

test("ending the session calls signOut and does not touch anything else", async () => {
  let calls = 0;
  await endServerSession(null);
  assert.equal(calls, 0);
  await endServerSession({
    auth: {
      signOut: async () => {
        calls += 1;
      },
    },
  });
  assert.equal(calls, 1);
});

test("only auth-token cookies expire, with Max-Age 0 and a past Expires", () => {
  const names = sessionCookieNames([
    { name: "sb-project-auth-token" },
    { name: "sb-project-auth-token.0" },
    { name: "sb-project-auth-token.1" },
    { name: "sb-project-auth-token-code-verifier" },
    { name: "vodcoach.language" },
    { name: "other" },
  ]);
  assert.deepEqual(names, [
    "sb-project-auth-token",
    "sb-project-auth-token.0",
    "sb-project-auth-token.1",
  ]);
  const expired = expiredSessionCookie("sb-project-auth-token.0");
  assert.equal(expired.value, "");
  assert.equal(expired.options.path, "/");
  assert.equal(expired.options.maxAge, 0);
  assert.equal(expired.options.expires.getTime(), 0);
  assert.equal(expired.options.httpOnly, false);
  assert.equal(expired.options.sameSite, "lax");
  assert.equal(isSignOutPath(SIGN_OUT_PATH), true);
  assert.equal(isSignOutPath("/"), false);
  assert.equal(isSignOutPath("/api/auth/oauth"), false);
  assert.equal(isSignOutPath("/api/stripe/webhook"), false);
  assert.equal(isSignOutForm(null), false);
  assert.equal(isSignOutForm({ type: "submit" }), false);
  assert.equal(
    isSignOutForm({ getAttribute: (name: string) => (name === "action" ? "/auth/sign-out" : null) }),
    true,
  );
  assert.equal(
    isSignOutForm({ getAttribute: () => "/api/analyze" }),
    false,
  );
});

test("logout signs out, expires the session cookie, returns home, and keeps saved coaching", () => {
  const route = readFileSync("src/app/auth/sign-out/route.ts", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");
  const home = readFileSync("src/components/home-screen.tsx", "utf8");
  const proxy = readFileSync("src/lib/supabase/update-session.ts", "utf8");
  const oauth = readFileSync("src/app/api/auth/oauth/route.ts", "utf8");
  const profiles = readFileSync("src/lib/billing/profile.ts", "utf8");
  const speech = readFileSync("src/lib/live-speech.ts", "utf8");
  const caption = readFileSync("src/components/live-session.tsx", "utf8");

  assert.equal(route.includes("createSupabaseServer"), true);
  assert.equal(route.includes("endServerSession"), true);
  assert.equal(route.includes("expiredSessionCookie"), true);
  assert.equal(route.includes("sessionCookieNames"), true);
  assert.equal(route.includes("NextResponse.redirect"), true);
  assert.equal(route.includes(", 303)"), true);
  assert.equal(route.includes("saved-coaching"), false);
  assert.equal(route.includes("deleteSavedCoaching"), false);
  assert.equal(route.includes("indexedDB"), false);
  assert.equal(route.includes("localStorage"), false);
  assert.equal(route.includes("profiles"), false);
  assert.equal(route.includes("stripe"), false);
  assert.equal(route.includes("signInWithOAuth"), false);

  assert.equal(proxy.includes("isSignOutPath"), true);
  assert.equal(proxy.includes("supabase.auth.getUser"), true);
  const skip = proxy.indexOf("isSignOutPath");
  const refresh = proxy.indexOf("supabase.auth.getUser");
  assert.equal(skip >= 0 && skip < refresh, true);

  assert.equal(page.includes("createSupabaseServer"), true);
  assert.equal(page.includes("sessionIsPresent"), true);
  assert.equal(page.includes("signedIn={signedIn}"), true);
  assert.equal(page.includes("signInWithOAuth"), false);

  assert.equal(home.includes("signedIn ? ("), true);
  assert.equal(home.includes('action="/auth/sign-out"'), true);
  assert.equal(home.includes('method="post"'), true);
  assert.equal(home.includes("{t.signOut}"), true);
  assert.equal(home.includes('type="submit"'), true);
  assert.equal(home.includes("signOutToHome"), false);
  assert.equal(home.includes("isSignOutForm(event.target)"), true);
  assert.equal(home.includes("silenceNativeValidation(event)"), true);
  const button = home.slice(home.indexOf("signedIn ? ("), home.indexOf(") : null}"));
  assert.equal(button.includes("deleteSavedCoaching"), false);
  assert.equal(button.includes("saved-coaching"), false);
  assert.equal(button.includes("indexedDB"), false);

  assert.equal(oauth.includes("signOut"), false);
  assert.equal(profiles.includes("signOut"), false);
  assert.equal(speech.includes("signOut"), false);
  assert.equal(caption.includes("sign-out"), false);

  assert.equal(uiCopy("ja").signOut, "ログアウト");
  const labels = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).signOut));
  assert.equal(labels.size, COACH_LANGUAGES.length);
});
