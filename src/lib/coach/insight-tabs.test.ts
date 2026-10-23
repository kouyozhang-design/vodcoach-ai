import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_INSIGHTS_BY_MODE,
  UI_INSIGHT_CAP,
  groupInsightsByTab,
  insightsFromParsed,
  mergeSimilarInsights,
  resolveInsightTab,
  shouldShowInsightTabs,
  usedInsightTabs,
} from "./insight-tabs.ts";
import type { CoachInsight, CoachRequest } from "./types.ts";

const sample: CoachRequest = {
  game: "apex-legends",
  rank: "Platinum",
  character: "Wraith",
  concern: "近距離で遮蔽を離れて先にダウンします",
};

function insight(partial: Partial<CoachInsight> & Pick<CoachInsight, "id" | "title">): CoachInsight {
  return {
    finding: partial.finding ?? `${partial.title} の根拠`,
    action: partial.action ?? "次の選択を1つ直す",
    ...partial,
  };
}

test("legacy ids and titles map onto the five tabs", () => {
  assert.equal(resolveInsightTab({ id: "positioning", title: "x" }), "rotation");
  assert.equal(resolveInsightTab({ id: "aim", title: "x" }), "aim");
  assert.equal(resolveInsightTab({ id: "abilities", title: "x" }), "abilities");
  assert.equal(resolveInsightTab({ id: "practice", title: "x" }), "other");
  assert.equal(resolveInsightTab({ id: "scene-1", title: "ゾーンカットが早い" }), "rotation");
  assert.equal(resolveInsightTab({ id: "scene-2", title: "詰めが甘い" }), "endgame");
  assert.equal(resolveInsightTab({ id: "free", tab: "endgame", title: "x" }), "endgame");
});

test("short lists stay flat and long mixed lists get tabs", () => {
  const short = [insight({ id: "a", tab: "aim", title: "エイム" }), insight({ id: "b", tab: "rotation", title: "回転" })];
  assert.equal(shouldShowInsightTabs(short), false);

  const long: CoachInsight[] = [];
  for (let i = 0; i < 6; i += 1) {
    long.push(insight({ id: `aim-${i}`, tab: "aim", title: `エイム ${i}`, finding: `根拠 ${i}` }));
  }
  long.push(insight({ id: "rot", tab: "rotation", title: "回転" }));
  assert.equal(shouldShowInsightTabs(long), true);
  assert.deepEqual(usedInsightTabs(long), ["rotation", "aim"]);
  assert.equal(groupInsightsByTab(long).aim.length, 6);
});

test("similar notes merge and cap only at the UI ceiling", () => {
  const merged = mergeSimilarInsights([
    insight({
      id: "fight-open",
      tab: "aim",
      timestamp: "00:04",
      title: "射線を2本開いている",
      finding: "岩から離れて左右が見えている",
    }),
    insight({
      id: "fight-open",
      tab: "aim",
      timestamp: "00:12",
      title: "射線を2本開いている",
      finding: "岩から離れて左右が見えている。左端に張る方が高い。",
    }),
    insight({
      id: "close",
      tab: "endgame",
      timestamp: "08:10",
      title: "詰めが甘い",
      finding: "勝ったあとも同じ角度",
    }),
  ]);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((row) => row.tab === "endgame"));
  assert.ok(merged.find((row) => row.tab === "aim")?.finding.includes("左端"));

  const many: CoachInsight[] = [];
  for (let i = 0; i < 50; i += 1) {
    many.push(
      insight({
        id: `scene-${i}`,
        tab: i % 2 === 0 ? "aim" : "abilities",
        title: `局面 ${i}`,
        finding: `固有の根拠 ${i} ${"あ".repeat(i % 5)}`,
      }),
    );
  }
  const capped = mergeSimilarInsights(many);
  assert.equal(capped.length, UI_INSIGHT_CAP);
  assert.equal(MAX_INSIGHTS_BY_MODE.clip, 8);
  assert.equal(MAX_INSIGHTS_BY_MODE["match-merge"], 36);
});

test("clip parse does not pad to four locked ids", () => {
  const insights = insightsFromParsed(
    {
      insights: [
        {
          id: "crosshair-drop",
          tab: "aim",
          title: "クロスヘアが落ちる",
          finding: "PlatinumのWraithがスライド後に足元を向く",
          action: "胸の高さで固定する",
        },
      ],
    },
    sample,
    "clip",
  );
  assert.equal(insights.length, 1);
  assert.equal(insights[0].tab, "aim");
});
