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
});

test("match-chunk prompt allows zero timestamped tips", () => {
  const prompt = systemPrompt("match-chunk");
  assert.match(prompt, /0〜6/);
  assert.match(prompt, /空配列/);
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
            ? [{ startOffsetSec: 40, endOffsetSec: 80, insights: [] }]
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
  }
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
});
