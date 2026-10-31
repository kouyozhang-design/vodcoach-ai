import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { habitLineFromRecords, habitLineFromText, type HabitSource } from "./coach-habits.ts";

const reload: HabitSource = {
  sourceLanguage: "ja",
  result: { summary: "ピーク前にリロードする癖がある。" },
};

test("a habit line is copied from the coaching text", () => {
  const line = habitLineFromText("ピーク前にリロードする癖がある。");
  assert.equal(line, "ピーク前にリロードする癖がある");
  assert.equal("ピーク前にリロードする癖がある。".includes(line ?? ""), true);
});

test("reload and isolation are not turned into habits", () => {
  const line = habitLineFromRecords(
    [{ sourceLanguage: "ja", result: { summary: "リロードが遅い。孤立してファイトを取る。" } }],
    "ja",
  );
  assert.equal(line, null);
  const named = habitLineFromRecords(
    [{ sourceLanguage: "ja", result: { summary: "孤立癖で先に入っている。" } }],
    "ja",
  );
  assert.equal(named, "孤立癖で先に入っている");
});

test("the player's concern is not a habit, and the implementation does not name those habits", () => {
  const line = habitLineFromRecords(
    [{ sourceLanguage: "ja", result: { summary: "射線は2本。" }, concern: "リロード癖と孤立癖" } as HabitSource],
    "ja",
  );
  assert.equal(line, null);
  const source = readFileSync(new URL("./coach-habits.ts", import.meta.url), "utf8");
  assert.equal(source.includes("リロード癖"), false);
  assert.equal(source.includes("孤立癖"), false);
});

test("the phrase that shows up more often is the one line", () => {
  const other: HabitSource = { sourceLanguage: "ja", result: { summary: "高台を捨てる癖がある。" } };
  assert.equal(habitLineFromRecords([reload, other, reload], "ja"), "ピーク前にリロードする癖がある");
});

test("an English habit word has to be its own word", () => {
  assert.equal(
    habitLineFromRecords([{ sourceLanguage: "en", result: { summary: "They inhabit the building and wait." } }], "en"),
    null,
  );
  const line = habitLineFromRecords(
    [{ sourceLanguage: "en", result: { summary: "There is a habit of wide swinging the close angle." } }],
    "en",
  );
  assert.match(line ?? "", /habit of wide swinging/);
});

test("the selected language is preferred, then the source sentence", () => {
  const record: HabitSource = {
    sourceLanguage: "ja",
    result: { summary: "ピーク前にリロードする癖がある。" },
    translations: {
      en: { summary: "There is a habit of reloading before the peek." },
    },
  };
  assert.match(habitLineFromRecords([record], "en") ?? "", /habit of reloading/);
  const plain: HabitSource = {
    ...record,
    translations: { en: { summary: "The peek was early." } },
  };
  assert.match(habitLineFromRecords([plain], "en") ?? "", /癖/);
});
