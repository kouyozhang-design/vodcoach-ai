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

test("mock notes and clip stay personalized to rank character concern", async () => {
  const notes = await videoCoachProvider.analyze({ ...base, mode: "clip" });
  assert.equal(notes.kind, "notes");
  assert.match(notes.summary, /Platinum/);
  assert.match(notes.summary, /Wraith/);
  assert.match(notes.summary, /近距離で遮蔽を離れて先にダウンします/);
  assert.equal(notes.insights.length, 4);

  const clip = await videoCoachProvider.analyze({
    ...base,
    mode: "clip",
    videoUrl: "https://example.com/clip.mp4",
  });
  assert.equal(clip.kind, "clip");
  assert.match(clip.insights[0].finding, /Platinum/);
  assert.match(clip.insights[0].finding, /Wraith/);
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
  assert.match(quiet.summary, /指摘すべき局面はありません/);

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
});

test("mock match-merge does not invent filler when chunks are empty", async () => {
  const merged = await videoCoachProvider.analyze({
    ...base,
    mode: "match-merge",
    chunkReports: [{ startOffsetSec: 40, endOffsetSec: 80, insights: [] }],
  });
  assert.equal(merged.insights.length, 0);
  assert.match(merged.summary, /指摘すべき局面はありませんでした/);
});

test("mock live speaks once then skips repeats via recentCues", async () => {
  const first = await videoCoachProvider.analyze({
    ...base,
    mode: "live",
    frames: [{ timestamp: 1, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" }],
  });
  assert.equal(first.shouldSpeak, true);
  assert.ok(first.insights.length > 0);
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
