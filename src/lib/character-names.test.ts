import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { characterName } from "./character-names.ts";
import { COACH_LANGUAGES } from "./coach-language.ts";
import { gameConfigs } from "./games.ts";

const roster = [...gameConfigs["apex-legends"].characters, ...gameConfigs.valorant.characters];

test("character labels follow the coach language and keep the English id", () => {
  assert.equal(characterName("ja", "Wraith"), "レイス");
  assert.equal(characterName("ja", "Jett"), "ジェット");
  assert.equal(characterName("ko", "Wraith"), "레이스");
  assert.equal(characterName("ko", "Chamber"), "체임버");
  assert.equal(characterName("zh-TW", "Wraith"), "惡靈");
  assert.equal(characterName("zh-TW", "Jett"), "婕提");
  assert.equal(characterName("zh-TW", "Deadlock"), "蒂羅");
  assert.equal(characterName("zh-TW", "Tejo"), "戴侯");
  for (const language of ["en", "pt", "de", "fr", "es", "pl", "tr", "it", "id"] as const) {
    assert.equal(characterName(language, "Wraith"), "Wraith");
    assert.equal(characterName(language, "KAY/O"), "KAY/O");
  }
  assert.equal(characterName("ja", "KAY/O"), "KAY/O");
  assert.equal(characterName("zh-TW", "KAY/O"), "KAY/O");
  assert.equal(characterName("ko", "KAY/O"), "케이/오");
  for (const id of roster) {
    for (const language of COACH_LANGUAGES) {
      const label = characterName(language, id);
      assert.equal(typeof label, "string");
      assert.ok(label.trim().length > 0, `${language} ${id}`);
    }
  }
  assert.equal(new Set(roster).size, roster.length);
});

test("the character menu shows the localized label and submits the English id", () => {
  const page = readFileSync(new URL("../components/home-screen.tsx", import.meta.url), "utf8");
  assert.match(page, /characterName\(language, id\)/);
  assert.match(page, /value: id, label: characterName\(language, id\)/);
  assert.doesNotMatch(page, /options=\{gameConfig\.characters\}/);
});
