import assert from "node:assert/strict";
import { test } from "node:test";
import { decideLiveCue, isRepeatCue, rememberCues } from "./live-cues.ts";
import type { CoachInsight, CoachResponse } from "./types.ts";

const peek: CoachInsight = {
  id: "now-peek",
  title: "岩の左端へ戻して射線を1本にする",
  finding: "Wraithのレティクルがオープンを向いたまま、味方のトレード射程の外にいる。",
  action: "スライドを止めて岩に張り、見える敵が1人になってから腰撃ち。",
};

function live(partial: Partial<CoachResponse>): CoachResponse {
  return {
    analysisId: "t",
    game: "apex-legends",
    character: "Wraith",
    headline: "live",
    summary: "live",
    insights: [peek],
    kind: "live",
    ...partial,
  };
}

test("decideLiveCue skips when the model says not to speak", () => {
  const decision = decideLiveCue(live({ shouldSpeak: false, insights: [] }), []);
  assert.deepEqual(decision, { speak: false, reason: "model-skip" });
});

test("decideLiveCue skips empty insights even if shouldSpeak is missing", () => {
  assert.deepEqual(decideLiveCue(live({ insights: [] }), []), { speak: false, reason: "empty" });
});

test("decideLiveCue skips near-duplicate repeats", () => {
  const recent = rememberCues([], [peek]);
  assert.equal(isRepeatCue([peek], recent), true);
  const decision = decideLiveCue(live({ shouldSpeak: true }), recent);
  assert.deepEqual(decision, { speak: false, reason: "repeat" });
});

test("decideLiveCue speaks a new real cue", () => {
  const decision = decideLiveCue(live({ shouldSpeak: true }), []);
  assert.deepEqual(decision, { speak: true, reason: "speak" });
});
