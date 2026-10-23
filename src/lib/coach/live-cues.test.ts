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
    spokenLine: "プラチナのレイス、岩から顔出して2射線。今は切れ。",
    speakMoment: "standoff",
    ...partial,
  };
}

test("decideLiveCue skips when the model says not to speak", () => {
  const decision = decideLiveCue(live({ shouldSpeak: false, insights: [], spokenLine: "" }), []);
  assert.deepEqual(decision, { speak: false, reason: "model-skip" });
});

test("decideLiveCue skips empty insights even if shouldSpeak is missing", () => {
  assert.deepEqual(decideLiveCue(live({ insights: [], spokenLine: "" }), []), { speak: false, reason: "empty" });
});

test("decideLiveCue skips near-duplicate repeats", () => {
  const line = "プラチナのレイス、岩から顔出して2射線。今は切れ。";
  const recent = rememberCues([], [peek], line);
  assert.equal(isRepeatCue([peek], recent, line), true);
  const decision = decideLiveCue(live({ shouldSpeak: true }), recent);
  assert.deepEqual(decision, { speak: false, reason: "repeat" });
});

test("decideLiveCue speaks a new real cue", () => {
  const decision = decideLiveCue(live({ shouldSpeak: true }), []);
  assert.equal(decision.speak, true);
  assert.equal(decision.reason, "speak");
  assert.match(decision.spokenLine ?? "", /切れ/);
});

test("decideLiveCue drops a mid-fight lecture", () => {
  const decision = decideLiveCue(
    live({
      shouldSpeak: true,
      speakMoment: "mid-fight",
      spokenLine: "今のスライドは観光だ。2射線開いている。第3が右にいる。ここで講義を始めるな。ゾーンも見ろ。",
    }),
    [],
  );
  assert.deepEqual(decision, { speak: false, reason: "lecture" });
});
