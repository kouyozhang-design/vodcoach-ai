import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampSpokenLine,
  composeSpokenLine,
  isMidFightLecture,
  looksLikeSurveyBeacon,
  parseNextMove,
  parseSpeakMoment,
  pickJapaneseVoice,
  spokenLineForCue,
  spokenLineUsesScan,
} from "./live-speech.ts";

test("pickJapaneseVoice prefers a ja voice", () => {
  const picked = pickJapaneseVoice([
    { lang: "en-US", name: "Samantha" },
    { lang: "ja-JP", name: "Kyoko" },
  ]);
  assert.equal(picked?.name, "Kyoko");
});

test("mid-fight lecture is rejected, short spray call is kept", () => {
  assert.equal(isMidFightLecture("mid-fight", "岩へ戻れ。"), false);
  assert.equal(
    isMidFightLecture(
      "mid-fight",
      "今のスライドは観光だ。2射線開いている。第3が右にいる。ここで講義を始めるな。",
    ),
    true,
  );
  assert.equal(spokenLineForCue({ speakMoment: "mid-fight", spokenLine: "岩へ戻れ。" }), "岩へ戻れ。");
  assert.equal(
    spokenLineForCue({
      speakMoment: "mid-fight",
      spokenLine: "今のスライドは観光だ。2射線開いている。第3が右にいる。ここで講義を始めるな。",
    }),
    "",
  );
});

test("composeSpokenLine prefers spokenLine and clamps", () => {
  assert.equal(composeSpokenLine({ spokenLine: "岩へ切れ。" }), "岩へ切れ。");
  assert.equal(
    composeSpokenLine({
      insights: [{ title: "岩の左端へ戻す", action: "1射線だけ見て腰撃ち" }],
    }),
    "岩の左端へ戻す。1射線だけ見て腰撃ち",
  );
  const long = "あ".repeat(200);
  assert.ok(clampSpokenLine(long).length <= 96);
});

test("survey beacon spoken line must use scan, zone, time, and a next move", () => {
  assert.equal(looksLikeSurveyBeacon("調査ビーコンを踏んでから詰める"), true);
  assert.equal(looksLikeSurveyBeacon("エイムが安定しない"), false);
  assert.equal(parseSpeakMoment("mid-range"), "mid-range");
  assert.equal(parseNextMove("third-party"), "third-party");
  assert.equal(
    spokenLineUsesScan("スキャンで西に2隊。第4リング残り40秒。今は漁夫。正面に飛び込むな。"),
    true,
  );
  assert.equal(spokenLineUsesScan("エイムを意識して落ち着いて"), false);
});
