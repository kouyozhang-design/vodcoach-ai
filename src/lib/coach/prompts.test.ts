import assert from "node:assert/strict";
import { test } from "node:test";
import { COACHING_BAR } from "./bar.ts";
import { buildUserText, profileLines, systemPrompt } from "./prompts.ts";
import type { CoachMode, CoachRequest } from "./types.ts";

const sample: CoachRequest = {
  game: "valorant",
  rank: "Diamond",
  character: "Jett",
  concern: "サイト進入で2アングルを同時に開いて先に倒されます",
};

const modes: CoachMode[] = ["clip", "match-chunk", "match-merge", "live"];

test("every mode prompt uses the shared coaching bar", () => {
  for (const mode of modes) {
    const prompt = systemPrompt(mode);
    assert.ok(prompt.startsWith(COACHING_BAR), mode);
    assert.match(prompt, /期待値/);
  }
});

test("live prompt speaks only on real cues", () => {
  const prompt = systemPrompt("live");
  assert.match(prompt, /shouldSpeak/);
  assert.match(prompt, /recentCues/);
  assert.match(prompt, /空配列/);
  assert.match(prompt, /spokenLine/);
  assert.match(prompt, /post-fight/);
  assert.match(prompt, /standoff/);
  assert.match(prompt, /mid-range/);
  assert.match(prompt, /調査ビーコン/);
  assert.match(prompt, /辛口/);
  assert.match(prompt, /種類タブ/);
});

test("match-chunk prompt allows zero timestamped tips and always records rotation", () => {
  const prompt = systemPrompt("match-chunk");
  assert.match(prompt, /0〜8/);
  assert.match(prompt, /空配列/);
  assert.match(prompt, /rotation/);
  assert.match(prompt, /zone-first/);
  assert.match(prompt, /third-party/);
  assert.match(prompt, /漁夫/);
});

test("clip prompt is not locked to four insight ids", () => {
  const prompt = systemPrompt("clip");
  assert.match(prompt, /件数は固定しない/);
  assert.doesNotMatch(prompt, /必ず4件/);
  assert.match(prompt, /tab は rotation/);
  assert.match(prompt, /closeRangeFights/);
  assert.match(prompt, /オフアングル/);
  assert.match(prompt, /段差/);
  assert.match(prompt, /確殺/);
  assert.match(prompt, /解説ができた/);
});

test("vod prompts put close-range micro in expanders, live does not", () => {
  assert.match(systemPrompt("match-chunk"), /closeRangeFights/);
  assert.match(systemPrompt("match-chunk"), /斜線/);
  assert.match(systemPrompt("match-chunk"), /段差/);
  assert.match(systemPrompt("match-merge"), /closeRangeFights/);
  assert.match(systemPrompt("live"), /確殺/);
  assert.match(systemPrompt("live"), /武器名/);
  assert.doesNotMatch(systemPrompt("live"), /"closeRangeFights"/);
  assert.doesNotMatch(systemPrompt("live"), /解説ができた/);
  const mergeText = buildUserText(
    {
      ...sample,
      mode: "match-merge",
      chunkReports: [
        {
          startOffsetSec: 0,
          endOffsetSec: 40,
          insights: [],
          closeRangeFights: [
            {
              id: "s",
              start: "00:08",
              end: "00:16",
              title: "正面ピーク",
              sightlines: "オフアングルを捨てている",
              knowHow: "ドアから撃て",
            },
          ],
        },
      ],
    },
    "match-merge",
    false,
    false,
  );
  assert.match(mergeText, /オフアングルを捨てている/);
  assert.match(mergeText, /insights に再掲しない/);
});

test("match-merge prompt judges rotation across the whole match", () => {
  const prompt = systemPrompt("match-merge");
  assert.match(prompt, /試合全体で判定/);
  assert.match(prompt, /rotationStory/);
  assert.match(prompt, /詰め/);
  assert.match(prompt, /36/);
  assert.doesNotMatch(prompt, /8件に満たなくても/);
});

test("profile and user text wire game rank character concern on every mode", () => {
  const lines = profileLines(sample);
  assert.deepEqual(lines, [
    "ゲーム: valorant",
    "ランク: Diamond",
    "キャラクター: Jett",
    "悩み・目的: サイト進入で2アングルを同時に開いて先に倒されます",
  ]);

  for (const mode of modes) {
    const text = buildUserText(
      {
        ...sample,
        mode,
        recentCues: mode === "live" ? ["壁へ戻して1アングルだけ切る: heavenが残っている"] : undefined,
        startOffsetSec: 40,
        endOffsetSec: 80,
        chunkReports:
          mode === "match-merge"
            ? [
                {
                  startOffsetSec: 40,
                  endOffsetSec: 80,
                  insights: [],
                  rotation: {
                    intent: "zone-cut",
                    ring: "第2リング残り35秒",
                    path: "尾根を横断",
                    note: "銃声は西",
                  },
                },
              ]
            : undefined,
      },
      mode,
      mode !== "live" && mode !== "match-merge",
      mode === "live",
    );
    assert.match(text, /ゲーム: valorant/, mode);
    assert.match(text, /ランク: Diamond/, mode);
    assert.match(text, /キャラクター: Jett/, mode);
    assert.match(text, /サイト進入で2アングル/, mode);
    assert.match(text, /過程と期待値/, mode);
    if (mode === "match-merge") {
      assert.match(text, /ゾーンカット/);
      assert.match(text, /尾根を横断/);
      assert.match(text, /試合全体で/);
    }
    if (mode === "match-chunk") {
      assert.match(text, /rotation は空にしない/);
    }
  }
});

test("english system prompt asks for English user-facing strings", () => {
  const prompt = systemPrompt("live", "en");
  assert.match(prompt, /English/);
  assert.match(prompt, /spokenLine/);
  assert.match(prompt, /調査ビーコン/);
  const clip = systemPrompt("clip", "en");
  assert.match(clip, /English/);
});

test("live user text includes recent cues for dedupe", () => {
  const text = buildUserText(
    { ...sample, mode: "live", recentCues: ["岩の左端へ戻す: 2射線が開いている"] },
    "live",
    false,
    true,
  );
  assert.match(text, /直近に出した指摘/);
  assert.match(text, /岩の左端へ戻す/);
  assert.match(text, /調査ビーコン/);
  assert.match(text, /アンチ/);
  assert.match(text, /ノックはキルではない/);
});
