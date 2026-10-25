import assert from "node:assert/strict";
import { test } from "node:test";
import { charLength } from "./viral-script.ts";
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
  assert.ok((clip.closeRangeFights ?? []).length >= 1);
  assert.match(clip.closeRangeFights?.[0].sightlines ?? "", /オフアングル|ピーク/);
  assert.match(clip.closeRangeFights?.[0].sightlines ?? "", /段差/);
  assert.match(clip.closeRangeFights?.[0].knowHow ?? "", /確殺/);
  assert.doesNotMatch(clip.closeRangeFights?.[0].sightlines ?? "", /R-301|ヴァンダル/);
  assert.equal((notes.closeRangeFights ?? []).length, 0);
  assert.match(notes.viralScript?.video_title ?? "", /遮蔽/);
  assert.match(notes.viralScript?.ai_tsukkomi ?? "", /遮蔽/);
  assert.doesNotMatch(notes.viralScript?.ai_tsukkomi ?? "", /\d{2}:\d{2}/);
  assert.ok(charLength(notes.viralScript?.ai_tsukkomi ?? "") <= 100);
  assert.match(notes.viralScript?.cta_text ?? "", /vodcoach-ai\.vercel\.app/);
  assert.match(clip.viralScript?.ai_tsukkomi ?? "", /00:12/);
  assert.match(clip.viralScript?.ai_tsukkomi ?? "", /オフアングル|正面/);
  assert.ok(charLength(clip.viralScript?.ai_tsukkomi ?? "") <= 100);
  assert.equal(clip.viralScript?.video_title, "オフアングル捨てて正面");

  const valorant = await videoCoachProvider.analyze({
    ...base,
    game: "valorant",
    rank: "Diamond",
    character: "Jett",
    mode: "clip",
    videoUrl: "https://example.com/clip.mp4",
  });
  assert.equal(valorant.viralScript, undefined);
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
  assert.ok((loud.closeRangeFights ?? []).length >= 1);
  assert.equal((quiet.closeRangeFights ?? []).length, 0);
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
  assert.equal(merged.viralScript, undefined);
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
        closeRangeFights: [
          {
            id: "scrap-1",
            start: "00:04",
            end: "00:12",
            title: "岩右のオフアングルを捨てて正面ピーク",
            sightlines: "ピークの権利はドア側。カバーは左1歩。",
            knowHow: "スイング前にタクティカル。撃つ順はドアから。",
          },
        ],
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
  assert.equal((merged.closeRangeFights ?? []).length, 1);
  assert.match(merged.closeRangeFights?.[0].sightlines ?? "", /ピーク/);
  assert.match(merged.viralScript?.ai_tsukkomi ?? "", /00:04/);
  assert.match(merged.viralScript?.ai_tsukkomi ?? "", /射線/);
  assert.ok(charLength(merged.viralScript?.ai_tsukkomi ?? "") <= 100);
  assert.match(merged.viralScript?.cta_text ?? "", /vodcoach-ai\.vercel\.app/);

  const valorantMerge = await videoCoachProvider.analyze({
    ...base,
    game: "valorant",
    rank: "Diamond",
    character: "Jett",
    mode: "match-merge",
    chunkReports: [
      {
        startOffsetSec: 0,
        endOffsetSec: 40,
        insights: [
          {
            id: "swing",
            tab: "aim",
            timestamp: "00:08",
            title: "heavenを残してスイング",
            finding: "2アングル",
            action: "壁へ戻る",
          },
        ],
      },
    ],
  });
  assert.equal(valorantMerge.viralScript, undefined);
});

test("mock live speaks once then skips repeats via recentCues", async () => {
  const first = await videoCoachProvider.analyze({
    ...base,
    mode: "live",
    frames: [{ timestamp: 1, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" }],
  });
  assert.equal(first.shouldSpeak, true);
  assert.ok(first.insights.length > 0);
  assert.equal((first.closeRangeFights ?? []).length, 0);
  assert.equal(first.viralScript, undefined);
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
  assert.match(notes.viralScript?.video_title ?? "", /cover/i);
  assert.match(notes.viralScript?.ai_tsukkomi ?? "", /cover|sightline|lines/i);
  assert.doesNotMatch(notes.viralScript?.ai_tsukkomi ?? "", /遮蔽|射線/);
  assert.ok(charLength(notes.viralScript?.ai_tsukkomi ?? "") <= 100);
});

test("mock clip English writes English fight expanders", async () => {
  const clip = await videoCoachProvider.analyze({
    ...base,
    language: "en",
    mode: "clip",
    videoUrl: "https://example.com/clip.mp4",
  });
  assert.ok((clip.closeRangeFights ?? []).length >= 1);
  assert.match(clip.closeRangeFights?.[0].sightlines ?? "", /off-angle|peek/i);
  assert.doesNotMatch(clip.closeRangeFights?.[0].sightlines ?? "", /オフアングル/);
  assert.match(clip.viralScript?.ai_tsukkomi ?? "", /00:12/);
  assert.match(clip.viralScript?.ai_tsukkomi ?? "", /off-angle|front peek/i);
  assert.doesNotMatch(clip.viralScript?.video_title ?? "", /[ぁ-んァ-ン一-龯]/);
  assert.ok(charLength(clip.viralScript?.ai_tsukkomi ?? "") <= 100);
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
