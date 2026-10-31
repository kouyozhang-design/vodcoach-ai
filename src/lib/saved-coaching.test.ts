import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { coachingView, summaryOf, withTranslation, withoutId, type SavedCoachingRecord } from "./saved-coaching.ts";

const record: SavedCoachingRecord = {
  id: "one",
  savedAt: 2,
  updatedAt: 2,
  game: "apex-legends",
  character: "Wraith",
  rank: "Gold",
  concern: "近距離",
  sourceLanguage: "ja",
  result: {
    analysisId: "one",
    game: "apex-legends",
    character: "Wraith",
    headline: "岩",
    summary: "2射線",
    insights: [],
  },
  translations: {
    ja: { headline: "岩", summary: "2射線", insights: [] },
  },
};

test("a language cache lands on the same record and delete removes only that id", () => {
  const other: SavedCoachingRecord = { ...record, id: "two" };
  const next = withTranslation(record, "ko", { headline: "바위", summary: "두 시야", insights: [] });
  assert.equal(next.id, "one");
  assert.equal(next.translations.ja?.headline, "岩");
  assert.equal(next.translations.ko?.headline, "바위");
  assert.deepEqual(withoutId([record, other], "one").map((item) => item.id), ["two"]);
  const summary = summaryOf(next);
  assert.equal(summary.headlines.ko, "바위");
  assert.equal(summary.headlines.ja, "岩");
});

test("reopening a saved row is the stored coaching, not the title", () => {
  const stored: SavedCoachingRecord = {
    ...record,
    result: {
      ...record.result,
      insights: [{ id: "wide", title: "ワイド", finding: "2射線を同時に開いた", action: "片側を切ってからピーク" }],
    },
    translations: {
      ja: {
        headline: "岩",
        summary: "2射線",
        insights: [{ id: "wide", title: "ワイド", finding: "2射線を同時に開いた", action: "片側を切ってからピーク" }],
      },
    },
  };
  const view = coachingView(stored, "ja");
  assert.equal(view.headline, "岩");
  assert.equal(view.summary, "2射線");
  assert.equal(view.insights[0]?.finding, "2射線を同時に開いた");
  assert.equal(view.insights[0]?.action, "片側を切ってからピーク");
  assert.notEqual(view.insights[0]?.finding, view.headline);
});

test("local save does not import Supabase", () => {
  const source = readFileSync(new URL("./saved-coaching.ts", import.meta.url), "utf8");
  assert.equal(source.includes("supabase"), false);
  assert.equal(source.includes("stripe"), false);
  assert.match(source, /indexedDB/);
});

test("a media quota failure is isolated from the coaching JSON", () => {
  const source = readFileSync(new URL("./saved-coaching.ts", import.meta.url), "utf8");
  const resultWrite = source.indexOf("commitPut(db, RESULT_STORE, record)");
  const mediaWrite = source.indexOf("commitPut(db, MEDIA_STORE");
  assert.ok(resultWrite > 0);
  assert.ok(mediaWrite > resultWrite);
  assert.match(source, /quota failure on the video or frames must leave the coaching JSON/);
});