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
  assert.equal(uiCopy("ja").savedHeading, "マイAIコーチ");
  assert.equal(uiCopy("en").savedHeading, "My AI Coach");
  assert.match(uiCopy("ja").savedDeviceNote, /別の端末には出ません/);
  assert.match(uiCopy("en").savedDeviceNote, /another phone/);
  assert.equal(uiCopy("ja").chatTitle, "この試合に聞く");
  assert.equal(uiCopy("en").chatTitle, "Ask about this fight");
  const chatTitles = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).chatTitle));
  const deviceNotes = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).savedDeviceNote));
  assert.equal(chatTitles.size, COACH_LANGUAGES.length);
  assert.equal(deviceNotes.size, COACH_LANGUAGES.length);
  assert.equal(uiCopy("ja").planFreeDetail, "基本機能（週1本の解析、パーソナル履歴の保持）");
  assert.equal(uiCopy("ja").planFreeCurrent, "現在のプラン");
  assert.equal(uiCopy("ja").planProPrice, "月額 980円");
  assert.equal(uiCopy("ja").planProDetail, "プロフェッショナル機能（制限なしの高速解析、部隊共有リンクの永続化、詳細な癖の傾向分析）");
  assert.equal(uiCopy("ja").planProUpgrade, "Proにアップグレード（Stripe決済へ）");
  assert.equal(uiCopy("ja").squadShare, "部隊へ共有");
  assert.match(uiCopy("ja").squadShareTip, /Discord/);
  assert.match(uiCopy("ja").squadShareTip, /LINE/);
  const copySource = readFileSync(new URL("./ui-copy.ts", import.meta.url), "utf8");
  assert.equal(copySource.includes("リロード癖"), false);
  assert.equal(copySource.includes("孤立癖"), false);
  const freeDetails = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).planFreeDetail));
  const proDetails = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).planProDetail));
  const squad = new Set(COACH_LANGUAGES.map((language) => uiCopy(language).squadShare));
  assert.equal(freeDetails.size, COACH_LANGUAGES.length);
  assert.equal(proDetails.size, COACH_LANGUAGES.length);
  assert.equal(squad.size, COACH_LANGUAGES.length);
  for (const language of COACH_LANGUAGES) {
    const copy = uiCopy(language);
    assert.equal(copy.planProDetail.includes("Shorts"), false, language);
    assert.equal(copy.planProDetail.includes("バズ"), false, language);
    assert.equal(copy.coachHabitEmpty.includes("リロード癖"), false, language);
    assert.equal(copy.coachHabitEmpty.includes("孤立癖"), false, language);
    assert.match(copy.squadShareTip, /Discord/);
    assert.match(copy.squadShareTip, /LINE/);
    assert.notEqual(copy.savedDeviceNote, copy.savedAccountNote);
    assert.notEqual(copy.chatTitle, copy.chatSend);
  }
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
  assert.match(page, /readBillingStatus/);
  assert.match(page, /showUploadPromo\(state\.status\)/);
  assert.match(page, /data-testid="upload-promo"/);
  assert.match(page, /\{t\.dropTitle\}/);
  const fileAt = page.indexOf('type="file"');
  const promoAt = page.indexOf("uploadPromo ?");
  assert.ok(fileAt >= 0 && promoAt > fileAt);
  assert.equal(page.slice(fileAt, promoAt).includes("dropTitle"), false);
});