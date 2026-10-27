import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { oauthCallbackUrl, oauthProviderFromForm, supabaseAuthorizeUrl } from "./oauth.ts";

const ORIGIN = "https://vodcoach-ai.vercel.app";
const CALLBACK = "https://vodcoach-ai.vercel.app/auth/callback";
const SUPABASE = "https://project.supabase.co";

test("oauth returns to the existing auth callback", () => {
  assert.equal(oauthCallbackUrl(ORIGIN), CALLBACK);
});

test("only google and apple can start", () => {
  assert.equal(oauthProviderFromForm("google"), "google");
  assert.equal(oauthProviderFromForm("apple"), "apple");
  assert.equal(oauthProviderFromForm("github"), null);
  assert.equal(oauthProviderFromForm("email"), null);
  assert.equal(oauthProviderFromForm(""), null);
  assert.equal(oauthProviderFromForm(null), null);
  assert.equal(oauthProviderFromForm(["google"]), null);
});

test("authorize url stays on the supabase host and the existing callback", () => {
  const google = `${SUPABASE}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(CALLBACK)}&code_challenge=abc&code_challenge_method=s256`;
  const accepted = supabaseAuthorizeUrl(google, SUPABASE, CALLBACK, "google");
  assert.ok(accepted);
  assert.equal(new URL(accepted).searchParams.get("redirect_to"), CALLBACK);
  assert.equal(new URL(accepted).searchParams.get("provider"), "google");
  assert.equal(supabaseAuthorizeUrl(google, SUPABASE, CALLBACK, "apple"), null);

  const apple = `${SUPABASE}/auth/v1/authorize?provider=apple&redirect_to=${encodeURIComponent(CALLBACK)}`;
  assert.equal(new URL(supabaseAuthorizeUrl(apple, SUPABASE, CALLBACK, "apple") ?? "").searchParams.get("provider"), "apple");

  assert.equal(
    supabaseAuthorizeUrl(
      `https://evil.example/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(CALLBACK)}`,
      SUPABASE,
      CALLBACK,
      "google",
    ),
    null,
  );
  assert.equal(
    supabaseAuthorizeUrl(`${SUPABASE}/auth/v1/token?provider=google&redirect_to=${encodeURIComponent(CALLBACK)}`, SUPABASE, CALLBACK, "google"),
    null,
  );
  assert.equal(
    supabaseAuthorizeUrl(
      `http://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(CALLBACK)}`,
      SUPABASE,
      CALLBACK,
      "google",
    ),
    null,
  );
  assert.equal(
    supabaseAuthorizeUrl(
      `${SUPABASE}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent("https://evil.example/auth/callback")}`,
      SUPABASE,
      CALLBACK,
      "google",
    ),
    null,
  );
  assert.equal(supabaseAuthorizeUrl("javascript:alert(1)", SUPABASE, CALLBACK, "google"), null);
  assert.equal(
    supabaseAuthorizeUrl(
      `https://user:pass@project.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(CALLBACK)}`,
      SUPABASE,
      CALLBACK,
      "google",
    ),
    null,
  );
});

test("oauth reuses the email callback and does not exchange a session", () => {
  const route = readFileSync("src/app/api/auth/oauth/route.ts", "utf8");
  const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
  const email = readFileSync("src/app/api/auth/email/route.ts", "utf8");
  const page = readFileSync("src/app/auth/page.tsx", "utf8");
  assert.equal(route.includes("exchangeCodeForSession"), false);
  assert.equal(route.includes("signInWithOAuth"), true);
  assert.equal(route.includes("writeProfileStatus"), false);
  assert.equal(route.includes("billingReturnOrigin"), true);
  assert.equal(callback.split("exchangeCodeForSession").length - 1, 1);
  assert.equal(email.includes("signInWithOtp"), true);
  assert.equal(email.includes("oauthCallbackUrl"), true);
  assert.equal(page.includes("signInWithOAuth"), false);
  assert.equal(page.includes('value="google"'), true);
  assert.equal(page.includes('value="apple"'), true);
  assert.equal(page.includes("/api/auth/email"), true);
  assert.equal(page.includes("authMissing"), true);
});
