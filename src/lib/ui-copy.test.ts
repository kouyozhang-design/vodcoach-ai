import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.equal(uiCopy("ja").signOut, "ログアウト");
  assert.equal(uiCopy("en").signOut, "Log out");
  const signOut = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).signOut));
  assert.equal(signOut.size, COACH_LANGUAGES.length);
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
  assert.equal(
    `${uiCopy("ja").heroLead}${uiCopy("ja").heroAccent}`,
    "AIで自分のプレイを論破しろ。1秒で変わる、Apex/VALORANTコーチング",
  );
  assert.equal(uiCopy("ja").heroLead.includes("試合一本"), false);
  assert.equal(uiCopy("ja").heroAccent.includes("映像から改善"), false);
  assert.equal(uiCopy("ja").dropTitle, "【今だけ無料】15秒のクリップ動画から解析OK！まずは手元の動画をドロップ");
  assert.equal(uiCopy("ja").planFreeDetail, "週1本までの動画解析、テキストアドバイスのみ");
  assert.equal(uiCopy("ja").planFreeCurrent, "現在のプラン");
  assert.equal(uiCopy("ja").planProPrice, "月額 980円");
  assert.equal(uiCopy("ja").planProDetail, "動画解析無制限、SNS用バズ台本自動生成、優先スピード処理");
  assert.equal(uiCopy("ja").planProUpgrade, "Proにアップグレード（Stripe決済へ）");
  const drops = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).dropTitle));
  const upgrades = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).planProUpgrade));
  const freePlans = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).planFreeCurrent));
  assert.equal(drops.size, COACH_LANGUAGES.length);
  assert.equal(upgrades.size, COACH_LANGUAGES.length);
  assert.equal(freePlans.size, COACH_LANGUAGES.length);

  const page = readFileSync(new URL("../components/home-screen.tsx", import.meta.url), "utf8");
  const insightAt = page.indexOf("<InsightBoard");
  const scriptAt = page.indexOf("<ViralScriptBlock");
  const fightAt = page.indexOf("<FightExpanders");
  assert.equal(page.match(/<ViralScriptBlock/g)?.length, 1);
  assert.ok(insightAt >= 0 && scriptAt > insightAt && fightAt > scriptAt);
  assert.match(page, /<PricingCards/);
  assert.match(page, /onBecomePro=\{focusPricing\}/);
  assert.match(page, /type="file"/);
});