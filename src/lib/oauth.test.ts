import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createServerClient } from "@supabase/ssr";
import { oauthCallbackUrl, oauthProviderFromForm, supabaseAuthorizeUrl, supabaseProjectUrl } from "./oauth.ts";

const ORIGIN = "https://vodcoach-ai.vercel.app";
const CALLBACK = "https://vodcoach-ai.vercel.app/auth/callback";
const SUPABASE = "https://project.supabase.co";

test("oauth returns to the existing auth callback", () => {
  assert.equal(oauthCallbackUrl(ORIGIN), CALLBACK);
});

test("only google, apple, and discord can start", () => {
  assert.equal(oauthProviderFromForm("google"), "google");
  assert.equal(oauthProviderFromForm("apple"), "apple");
  assert.equal(oauthProviderFromForm("discord"), "discord");
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

  const discord = `${SUPABASE}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent(CALLBACK)}`;
  assert.equal(new URL(supabaseAuthorizeUrl(discord, SUPABASE, CALLBACK, "discord") ?? "").searchParams.get("provider"), "discord");
  assert.equal(supabaseAuthorizeUrl(discord, SUPABASE, CALLBACK, "google"), null);

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
      `${SUPABASE}/rest/v1/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(CALLBACK)}`,
      SUPABASE,
      CALLBACK,
      "google",
    ),
    null,
  );
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

test("a saved /rest/v1 url still authorizes only on the project origin", async () => {
  const configured = `${SUPABASE}/rest/v1/`;
  assert.equal(supabaseProjectUrl(configured), SUPABASE);
  assert.equal(supabaseProjectUrl(`${SUPABASE}/rest/v1`), SUPABASE);
  assert.equal(supabaseProjectUrl(`${SUPABASE}/auth/v1`), SUPABASE);
  assert.equal(supabaseProjectUrl(`${SUPABASE}/`), SUPABASE);
  assert.equal(supabaseProjectUrl(SUPABASE), SUPABASE);
  assert.equal(supabaseProjectUrl(`${SUPABASE}/evil`), null);
  assert.equal(supabaseProjectUrl(`${SUPABASE}/rest/v1/table`), null);
  assert.equal(supabaseProjectUrl("https://user:pass@project.supabase.co/rest/v1/"), null);
  assert.equal(supabaseProjectUrl("javascript:alert(1)"), null);

  const redirectTo = CALLBACK;
  const start = async (base: string, provider: "google" | "discord") => {
    const pending: { name: string }[] = [];
    const supabase = createServerClient(base, "sb_publishable_test_key_not_real", {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookies) {
          for (const cookie of cookies) {
            const at = pending.findIndex((item) => item.name === cookie.name);
            if (at >= 0) pending[at] = cookie;
            else pending.push(cookie);
          }
        },
      },
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    return { data, error, pending };
  };

  for (const provider of ["google", "discord"] as const) {
    const raw = await start(configured, provider);
    assert.equal(raw.error, null);
    assert.equal(supabaseAuthorizeUrl(raw.data.url ?? "", supabaseProjectUrl(configured) ?? "", redirectTo, provider), null);
    assert.equal(new URL(raw.data.url ?? "").pathname, "/rest/v1/auth/v1/authorize");

    const project = supabaseProjectUrl(configured);
    assert.ok(project);
    const fixed = await start(project, provider);
    const accepted = supabaseAuthorizeUrl(fixed.data.url ?? "", project, redirectTo, provider);
    assert.ok(accepted);
    const target = new URL(accepted);
    assert.equal(target.protocol, "https:");
    assert.equal(target.host, "project.supabase.co");
    assert.equal(target.pathname, "/auth/v1/authorize");
    assert.equal(target.searchParams.get("provider"), provider);
    assert.equal(target.searchParams.get("redirect_to"), CALLBACK);
    assert.equal(fixed.pending.some((cookie) => cookie.name.endsWith("-code-verifier")), true);
  }
});

test("oauth reuses the email callback and does not exchange a session", () => {
  const route = readFileSync("src/app/api/auth/oauth/route.ts", "utf8");
  const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
  const email = readFileSync("src/app/api/auth/email/route.ts", "utf8");
  const page = readFileSync("src/app/auth/page.tsx", "utf8");
  assert.equal(route.includes("exchangeCodeForSession"), false);
  assert.equal(route.includes("signInWithOAuth"), true);
  assert.equal(route.includes("supabaseProjectUrl"), true);
  assert.equal(route.includes("supabaseAuthorizeUrl"), true);
  assert.equal(route.includes('endsWith("-code-verifier")'), true);
  assert.equal(route.includes("if (!url || !verifier)"), true);
  const server = readFileSync("src/lib/supabase/server.ts", "utf8");
  const session = readFileSync("src/lib/supabase/update-session.ts", "utf8");
  assert.equal(server.includes("supabaseProjectUrl"), true);
  assert.equal(session.includes("supabaseProjectUrl"), true);
  assert.equal(server.includes("writeProfileStatus"), false);
  assert.equal(route.includes("writeProfileStatus"), false);
  assert.equal(route.includes("billingReturnOrigin"), true);
  assert.equal(callback.split("exchangeCodeForSession").length - 1, 1);
  assert.equal(email.includes("signInWithOtp"), true);
  assert.equal(email.includes("oauthCallbackUrl"), true);
  assert.equal(page.includes("signInWithOAuth"), false);
  assert.equal(page.includes('value="google"'), true);
  assert.equal(page.includes('value="apple"'), true);
  assert.equal(page.includes('value="discord"'), true);
  assert.equal(page.includes("/api/auth/email"), true);
  assert.equal(page.includes("authMissing"), true);
});
