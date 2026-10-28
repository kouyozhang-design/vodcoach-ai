import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampSpokenLine,
  composeSpokenLine,
  isMidFightLecture,
  looksLikeSurveyBeacon,
  parseNextMove,
  parseSpeakMoment,
  pickEnglishVoice,
  pickJapaneseVoice,
  pickVoiceForLanguage,
  planKeepAlive,
  planSpeech,
  runSpeechPlan,
  SPEAK_AFTER_CANCEL_MS,
  speechErrorDropped,
  speechErrorIgnored,
  speechErrorRetriesWithoutVoice,
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

test("voice lookup accepts underscore locales from the speech engine", () => {
  assert.equal(
    pickJapaneseVoice([
      { lang: "en_US", name: "Samantha" },
      { lang: "ja_JP", name: "Kyoko" },
    ])?.name,
    "Kyoko",
  );
  assert.equal(pickEnglishVoice([{ lang: "en_US", name: "Samantha" }])?.name, "Samantha");
  assert.equal(pickVoiceForLanguage([{ lang: "pl_PL", name: "Zosia" }], "pl")?.name, "Zosia");
});

test("English TTS picks an English voice", () => {
  const voices = [
    { lang: "ja-JP", name: "Kyoko" },
    { lang: "en-US", name: "Samantha" },
  ];
  assert.equal(pickEnglishVoice(voices)?.name, "Samantha");
  assert.equal(pickVoiceForLanguage(voices, "en")?.name, "Samantha");
  assert.equal(pickVoiceForLanguage(voices, "ja")?.name, "Kyoko");
});

test("other languages prefer an exact voice and fall back to the same language", () => {
  const voices = [
    { lang: "en-US", name: "Samantha" },
    { lang: "zh-CN", name: "Ting" },
    { lang: "zh-TW", name: "Meijia" },
    { lang: "ko-KR", name: "Yuna" },
  ];
  assert.equal(pickVoiceForLanguage(voices, "zh-TW")?.name, "Meijia");
  assert.equal(pickVoiceForLanguage(voices, "ko")?.name, "Yuna");
  assert.equal(pickVoiceForLanguage([{ lang: "zh-CN", name: "Ting" }], "zh-TW")?.name, "Ting");
  assert.equal(pickVoiceForLanguage([{ lang: "en-US", name: "Samantha" }], "pl"), null);
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
  assert.equal(
    spokenLineUsesScan("Scan shows two squads west. Ring 4, 40 seconds left. Third-party now."),
    true,
  );
});

const idle = { speaking: false, pending: false, paused: false };

test("screen-share unlock speaks in the gesture and does not cancel", () => {
  assert.deepEqual(planSpeech(idle, "unlock"), [{ op: "speak", when: "now" }]);
  assert.deepEqual(planSpeech({ ...idle, paused: true }, "unlock"), [
    { op: "resume" },
    { op: "speak", when: "now" },
  ]);
  const ops: string[] = [];
  runSpeechPlan(
    {
      cancel() {
        ops.push("cancel");
      },
      resume() {
        ops.push("resume");
      },
    },
    planSpeech(idle, "unlock"),
    () => ops.push("speak"),
    (speak) => {
      ops.push("later");
      speak();
    },
  );
  assert.deepEqual(ops, ["speak"]);
});

test("an idle engine speaks the cue immediately, a busy one waits until after cancel", () => {
  assert.ok(SPEAK_AFTER_CANCEL_MS >= 50);
  assert.deepEqual(planSpeech(idle, "line"), [{ op: "speak", when: "now" }]);
  assert.deepEqual(planSpeech({ ...idle, paused: true }, "line"), [
    { op: "resume" },
    { op: "speak", when: "now" },
  ]);
  assert.deepEqual(planSpeech({ speaking: true, pending: false, paused: false }, "line"), [
    { op: "cancel" },
    { op: "speak", when: "later" },
  ]);
  const ops: string[] = [];
  let deferred: (() => void) | undefined;
  runSpeechPlan(
    {
      cancel() {
        ops.push("cancel");
      },
    },
    planSpeech({ speaking: false, pending: true, paused: false }, "line"),
    () => ops.push("speak"),
    (speak) => {
      deferred = speak;
    },
  );
  assert.deepEqual(ops, ["cancel"]);
  deferred?.();
  assert.deepEqual(ops, ["cancel", "speak"]);
});

test("Chrome keep-alive resumes a paused engine and nudges only while a line is queued", () => {
  assert.deepEqual(planKeepAlive({ speaking: false, pending: false, paused: false }), []);
  assert.deepEqual(planKeepAlive({ speaking: false, pending: false, paused: true }), ["resume"]);
  assert.deepEqual(planKeepAlive({ speaking: true, paused: false }), ["pause", "resume"]);
  assert.deepEqual(planKeepAlive({ speaking: false, pending: true, paused: false }), ["pause", "resume"]);
});

test("interrupted after start is ignored, a dropped line is retried, a bad voice falls back", () => {
  assert.equal(speechErrorIgnored("interrupted", true), true);
  assert.equal(speechErrorIgnored("canceled", true), true);
  assert.equal(speechErrorIgnored("interrupted", false), false);
  assert.equal(speechErrorIgnored("not-allowed", true), false);
  assert.equal(speechErrorDropped("canceled"), true);
  assert.equal(speechErrorDropped("not-allowed"), false);
  assert.equal(speechErrorRetriesWithoutVoice("voice-unavailable"), true);
  assert.equal(speechErrorRetriesWithoutVoice("network"), true);
  assert.equal(speechErrorRetriesWithoutVoice("not-allowed"), false);
});
