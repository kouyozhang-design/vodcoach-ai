import assert from "node:assert/strict";
import { test } from "node:test";
import { videoCoachProvider } from "./mock-provider.ts";
import type { CoachRequest } from "./types.ts";

const base: CoachRequest = {
  game: "apex-legends",
  rank: "Platinum",
  character: "Wraith",
  concern: "近距離で遮蔽を離れて先にダウンします",
};

test("mock notes and clip stay personalized and are not locked to four ids", async () => {
  const notes = await videoCoachProvider.analyze({ ...base, mode: "clip" });
  assert.equal(notes.kind, "notes");
  assert.match(notes.summary, /Platinum/);
  assert.match(notes.summary, /Wraith/);
  assert.match(notes.summary, /近距離で遮蔽を離れて先にダウンします/);
  assert.ok(notes.insights.length >= 1 && notes.insights.length <= 8);
  assert.ok(notes.insights.every((insight) => insight.tab));
  assert.equal(
    notes.insights.every((insight) => ["aim", "positioning", "abilities", "practice"].includes(insight.id)),
    false,
  );

  const clip = await videoCoachProvider.analyze({
    ...base,
    mode: "clip",
    videoUrl: "https://example.com/clip.mp4",
  });
  assert.equal(clip.kind, "clip");
  assert.match(clip.insights[0].finding, /Platinum/);
  assert.match(clip.insights[0].finding, /Wraith/);
  assert.ok(clip.insights.length < 4 || clip.insights.some((insight) => insight.tab !== "other"));
});

test("mock match-chunk can return zero tips on a quiet window", async () => {
  const quiet = await videoCoachProvider.analyze({
    ...base,
    mode: "match-chunk",
    chunkIndex: 1,
    chunkCount: 3,
    startOffsetSec: 40,
    endOffsetSec: 80,
  });
  assert.equal(quiet.insights.length, 0);
  assert.match(quiet.summary, /撃ち合いの指摘はありません/);
  assert.equal(quiet.rotation?.intent, "zone-cut");
  assert.match(quiet.rotation?.path ?? "", /尾根/);

  const loud = await videoCoachProvider.analyze({
    ...base,
    mode: "match-chunk",
    chunkIndex: 0,
    startOffsetSec: 0,
    endOffsetSec: 40,
  });
  assert.ok(loud.insights.length > 0);
  assert.match(loud.insights[0].finding, /Platinum/);
  assert.match(loud.insights[0].finding, /近距離で遮蔽/);
  assert.equal(loud.rotation?.intent, "zone-first");
  assert.ok(loud.insights.some((insight) => insight.tab === "endgame"));
});

test("mock match-merge does not invent filler when chunks are empty", async () => {
  const merged = await videoCoachProvider.analyze({
    ...base,
    mode: "match-merge",
    chunkReports: [{ startOffsetSec: 40, endOffsetSec: 80, insights: [] }],
  });
  assert.equal(merged.insights.length, 0);
  assert.match(merged.summary, /指摘すべき局面はありませんでした/);
  assert.equal(merged.rotationStory, undefined);
});

test("mock match-merge judges rotation across the match and keeps a higher-EV close", async () => {
  const merged = await videoCoachProvider.analyze({
    ...base,
    mode: "match-merge",
    durationSec: 120,
    chunkReports: [
      {
        startOffsetSec: 0,
        endOffsetSec: 40,
        rotation: {
          intent: "zone-first",
          ring: "第2リング内側",
          path: "建物へ",
          note: "先にスペース",
        },
        insights: [
          {
            id: "fight-open",
            tab: "aim",
            timestamp: "00:04",
            title: "射線を2本開いている",
            finding: "PlatinumのWraithが岩から離れた",
            action: "左端に張る",
          },
          {
            id: "close",
            tab: "endgame",
            timestamp: "00:38",
            title: "詰めが甘い",
            finding: "勝ったあとも同じ角度",
            action: "角度を変えて追い込む",
          },
        ],
      },
      {
        startOffsetSec: 40,
        endOffsetSec: 80,
        rotation: {
          intent: "zone-cut",
          ring: "第2リング残り35秒、ゾーン外",
          path: "尾根を横断",
          note: "銃声は西",
        },
        insights: [],
      },
      {
        startOffsetSec: 80,
        endOffsetSec: 120,
        rotation: {
          intent: "third-party",
          path: "東の撃ち合いへ",
          thirdPartyTiming: "01:32",
          note: "漁夫",
        },
        insights: [
          {
            id: "fight-open",
            tab: "aim",
            timestamp: "01:24",
            title: "射線を2本開いている",
            finding: "PlatinumのWraithが岩から離れた",
            action: "左端に張る",
          },
        ],
      },
    ],
  });
  assert.ok(merged.rotationStory);
  assert.match(merged.rotationStory ?? "", /ゾーンカット/);
  assert.match(merged.rotationStory ?? "", /試合全体/);
  assert.ok(merged.insights.some((insight) => insight.tab === "rotation"));
  assert.ok(merged.insights.some((insight) => insight.tab === "endgame"));
  assert.ok(merged.insights.length <= 36);
  const aimCards = merged.insights.filter((insight) => insight.tab === "aim");
  assert.ok(aimCards.length <= 2);
});

test("mock live speaks once then skips repeats via recentCues", async () => {
  const first = await videoCoachProvider.analyze({
    ...base,
    mode: "live",
    frames: [{ timestamp: 1, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" }],
  });
  assert.equal(first.shouldSpeak, true);
  assert.ok(first.insights.length > 0);
  assert.equal(first.speakMoment, "mid-range");
  assert.equal(first.nextMove, "disengage");
  assert.match(first.spokenLine ?? "", /中距離/);
  assert.match(first.summary, /Platinum/);
  assert.match(first.summary, /Wraith/);
  assert.match(first.summary, /近距離で遮蔽/);

  const second = await videoCoachProvider.analyze({
    ...base,
    mode: "live",
    frames: [{ timestamp: 2, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" }],
    recentCues: [`${first.insights[0].title}: ${first.insights[0].finding}`],
  });
  assert.equal(second.shouldSpeak, false);
  assert.equal(second.insights.length, 0);
  assert.match(second.headline, /注視中/);
});

test("mock live English uses an English spoken line", async () => {
  const spoken = await videoCoachProvider.analyze({
    ...base,
    language: "en",
    mode: "live",
    frames: [{ timestamp: 1, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" }],
  });
  assert.equal(spoken.shouldSpeak, true);
  assert.match(spoken.spokenLine ?? "", /mid-range|sightlines/i);
  assert.doesNotMatch(spoken.spokenLine ?? "", /中距離/);
});

test("mock notes English writes English insights", async () => {
  const notes = await videoCoachProvider.analyze({ ...base, language: "en", mode: "clip" });
  assert.match(notes.headline, /notes/);
  assert.match(notes.insights[0].title, /shot|Crosshair|sightlines/i);
});

test("mock live uses survey beacon scan for the next move", async () => {
  const { spokenLineUsesScan } = await import("../live-speech.ts");
  const scanned = await videoCoachProvider.analyze({
    ...base,
    concern: "調査ビーコンを踏んでから中距離で詰める",
    mode: "live",
    frames: [{ timestamp: 1, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" }],
  });
  assert.equal(scanned.shouldSpeak, true);
  assert.equal(scanned.usedScan, true);
  assert.equal(scanned.speakMoment, "post-fight");
  assert.equal(scanned.nextMove, "third-party");
  assert.equal(spokenLineUsesScan(scanned.spokenLine ?? ""), true);
  assert.match(scanned.spokenLine ?? "", /第4リング残り40秒/);
});

test("mock live English survey beacon uses scan, zone, and time", async () => {
  const { spokenLineUsesScan } = await import("../live-speech.ts");
  const scanned = await videoCoachProvider.analyze({
    ...base,
    language: "en",
    concern: "survey beacon then mid-range close",
    mode: "live",
    frames: [{ timestamp: 1, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" }],
  });
  assert.equal(scanned.usedScan, true);
  assert.equal(spokenLineUsesScan(scanned.spokenLine ?? ""), true);
  assert.match(scanned.spokenLine ?? "", /40 seconds/i);
});
