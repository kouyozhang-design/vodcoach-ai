import assert from "node:assert/strict";
import { test } from "node:test";
import { COACH_LANGUAGES } from "./coach-language.ts";
import { uiCopy, uiCopyKeys } from "./ui-copy.ts";

test("every visible string exists in all 12 languages", () => {
  const keys = uiCopyKeys();
  const heroes = new Set<string>();
  const buttons = new Set<string>();
  for (const language of COACH_LANGUAGES) {
    const copy = uiCopy(language);
    heroes.add(copy.heroLead);
    buttons.add(copy.analyze);
    for (const key of keys) {
      assert.equal(typeof copy[key], "string", `${language}.${key}`);
      assert.ok(copy[key].trim().length > 0, `${language}.${key}`);
    }
  }
  assert.equal(heroes.size, COACH_LANGUAGES.length);
  assert.equal(buttons.size, COACH_LANGUAGES.length);
  assert.equal(uiCopy("ja").becomePro, "Pro になる");
  assert.equal(uiCopy("en").becomePro, "Become Pro");
  assert.equal(uiCopy("ja").authTitle, "ログイン");
  assert.equal(uiCopy("en").authTitle, "Sign in");
  assert.equal(uiCopy("ja").authGoogle, "Googleで続ける");
  assert.equal(uiCopy("ja").authDiscord, "Discordで続ける");
  assert.equal(uiCopy("en").authApple, "Continue with Apple");
  assert.equal(uiCopy("en").authDiscord, "Continue with Discord");
  const google = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).authGoogle));
  const apple = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).authApple));
  const discord = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).authDiscord));
  assert.equal(google.size, COACH_LANGUAGES.length);
  assert.equal(apple.size, COACH_LANGUAGES.length);
  assert.equal(discord.size, COACH_LANGUAGES.length);
});