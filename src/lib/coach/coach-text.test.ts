import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyBundle, bundleFromResult, parseTranslateRequest } from "./coach-text.ts";
import type { CoachResponse } from "./types.ts";

const result: CoachResponse = {
  analysisId: "abc",
  game: "apex-legends",
  character: "Wraith",
  headline: "岩を離した",
  summary: "近接で2射線。",
  insights: [{ id: "aim-1", tab: "aim", timestamp: "00:12", title: "正面", finding: "段差を捨てた", action: "左へ1歩" }],
  closeRangeFights: [{ id: "scrap-1", start: "00:10", end: "00:18", title: "正面ピーク", sightlines: "段差", knowHow: "確殺" }],
  viralScript: { video_title: "正面", ai_tsukkomi: "段差を捨てた", cta_text: "刺せ" },
};

test("translation keeps ids and timestamps and rejects video", () => {
  const applied = applyBundle(result, {
    headline: "Left the rock",
    summary: "Two lines up close.",
    insights: [{ id: "other", title: "Front", finding: "You left the lip", action: "One step left" }],
    closeRangeFights: [{ id: "scrap-1", title: "Front peek", sightlines: "Lip", knowHow: "Finish" }],
    viralScript: { video_title: "Front", ai_tsukkomi: "You left the lip", cta_text: "Roast it" },
  });
  assert.equal(applied.insights[0].id, "aim-1");
  assert.equal(applied.insights[0].timestamp, "00:12");
  assert.equal(applied.insights[0].tab, "aim");
  assert.equal(applied.insights[0].title, "Front");
  assert.equal(applied.closeRangeFights?.[0].start, "00:10");
  assert.equal(applied.closeRangeFights?.[0].title, "Front peek");
  assert.equal(applied.analysisId, "abc");

  const rejected = parseTranslateRequest({ language: "en", videoUrl: "https://example.com/a.mp4", bundle: bundleFromResult(result) });
  assert.ok("error" in rejected);
  const frames = parseTranslateRequest({ language: "pt", frames: [], bundle: bundleFromResult(result) });
  assert.ok("error" in frames);
  const ok = parseTranslateRequest({ language: "pt", sourceLanguage: "ja", bundle: bundleFromResult(result) });
  assert.ok(!("error" in ok));
  if (!("error" in ok)) {
    assert.equal(ok.language, "pt");
    assert.equal(ok.bundle.insights[0].id, "aim-1");
  }
});

test("translate route does not upload video and uses gemini-3.8-flash", () => {
  const source = readFileSync(new URL("./translate-server.ts", import.meta.url), "utf8");
  assert.match(source, /gemini-3\.8-flash/);
  assert.equal(source.includes("upload/v1beta/files"), false);
  assert.equal(source.includes("videoUrl"), false);
  const route = readFileSync(new URL("../../app/api/coach/translate/route.ts", import.meta.url), "utf8");
  assert.match(route, /translateCoachBundle/);
  assert.match(route, /動画は送りません/);
  assert.equal(route.includes("upload/v1beta/files"), false);
});