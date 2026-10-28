import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COACH_LANGUAGES } from "./coach-language.ts";
import { endServerSession, sessionIsPresent } from "./sign-out.ts";
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

test("logout stays on the existing server session, returns home, and keeps saved coaching", () => {
  const action = readFileSync("src/app/auth/sign-out-action.ts", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");
  const home = readFileSync("src/components/home-screen.tsx", "utf8");
  const oauth = readFileSync("src/app/api/auth/oauth/route.ts", "utf8");
  const profiles = readFileSync("src/lib/billing/profile.ts", "utf8");

  assert.equal(action.includes("createSupabaseServer"), true);
  assert.equal(action.includes("endServerSession"), true);
  assert.equal(action.includes('redirect("/")'), true);
  assert.equal(action.includes("saved-coaching"), false);
  assert.equal(action.includes("deleteSavedCoaching"), false);
  assert.equal(action.includes("indexedDB"), false);
  assert.equal(action.includes("localStorage"), false);
  assert.equal(action.includes("profiles"), false);
  assert.equal(action.includes("stripe"), false);
  assert.equal(action.includes("signInWithOAuth"), false);

  assert.equal(page.includes("createSupabaseServer"), true);
  assert.equal(page.includes("sessionIsPresent"), true);
  assert.equal(page.includes("signedIn={signedIn}"), true);
  assert.equal(page.includes("signInWithOAuth"), false);

  assert.equal(home.includes("signedIn ? ("), true);
  assert.equal(home.includes("signOutToHome"), true);
  assert.equal(home.includes("{t.signOut}"), true);
  assert.equal(home.includes('type="button"'), true);
  const button = home.slice(home.indexOf("signedIn ? ("), home.indexOf(") : null}"));
  assert.equal(button.includes("deleteSavedCoaching"), false);
  assert.equal(button.includes("saved-coaching"), false);

  assert.equal(oauth.includes("signOut"), false);
  assert.equal(profiles.includes("signOut"), false);

  assert.equal(uiCopy("ja").signOut, "ログアウト");
  const labels = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).signOut));
  assert.equal(labels.size, COACH_LANGUAGES.length);
});
