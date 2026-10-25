import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fightChrome,
  insightTabLabel,
  languageInstruction,
  liveChrome,
  parseCoachLanguage,
  shareChrome,
  speechLocale,
  viralChrome,
} from "./coach-language.ts";

test("language defaults to Japanese", () => {
  assert.equal(parseCoachLanguage(undefined), "ja");
  assert.equal(parseCoachLanguage("日本語"), "ja");
  assert.equal(parseCoachLanguage("en"), "en");
  assert.equal(parseCoachLanguage("english"), "en");
  assert.equal(speechLocale("ja"), "ja-JP");
  assert.equal(speechLocale("en"), "en-US");
});

test("prompts and cheap chrome switch with language", () => {
  assert.match(languageInstruction("ja"), /日本語/);
  assert.match(languageInstruction("en"), /English/);
  assert.equal(insightTabLabel("rotation", "ja"), "立ち回り/回転");
  assert.equal(insightTabLabel("rotation", "en"), "Pathing / rotate");
  assert.equal(liveChrome("ja").speakingNow, "いま話しています");
  assert.equal(liveChrome("en").speakingNow, "Speaking now");
  assert.equal(shareChrome("ja").label, "X（旧Twitter）にシェアする");
  assert.equal(shareChrome("en").label, "Share on X (Twitter)");
  assert.equal(viralChrome("ja").heading, "バズる台本");
  assert.equal(viralChrome("en").heading, "Shorts script");
  assert.equal(fightChrome("ja").sightlines, "細かい斜線管理");
  assert.equal(fightChrome("ja").knowHow, "戦闘のノウハウ");
  assert.equal(fightChrome("en").sightlines, "Fine sightline work");
  assert.equal(fightChrome("en").knowHow, "In-fight know-how");
  assert.match(languageInstruction("ja"), /closeRangeFights/);
  assert.match(languageInstruction("en"), /closeRangeFights/);
  assert.match(languageInstruction("ja"), /段差/);
  assert.match(languageInstruction("ja"), /確殺/);
  assert.match(languageInstruction("en"), /knock is not a kill/i);
  assert.match(languageInstruction("ja"), /勝率が上がるときだけ/);
  assert.match(languageInstruction("en"), /raises win rate/i);
  assert.match(languageInstruction("ja"), /間取りを作るな/);
  assert.match(languageInstruction("en"), /do not invent a layout/i);
});
