import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatRotationLine,
  isEmptyRotation,
  parseRotation,
  summarizeRotationTimeline,
} from "./rotation.ts";

test("parseRotation keeps zone-first / zone-cut / 漁夫 and drops empty notes", () => {
  assert.equal(parseRotation(undefined), undefined);
  assert.equal(parseRotation({ intent: "unknown" }), undefined);
  const cut = parseRotation({
    intent: "zone-cut",
    ring: "第2リング残り35秒",
    path: "尾根を横断",
    note: "銃声は西",
  });
  assert.equal(cut?.intent, "zone-cut");
  assert.equal(isEmptyRotation(cut), false);
  assert.match(formatRotationLine(cut), /ゾーンカット/);
  assert.match(formatRotationLine(cut), /尾根を横断/);

  const third = parseRotation({ intent: "漁夫", thirdPartyTiming: "01:32" });
  assert.equal(third?.intent, "third-party");
  assert.match(formatRotationLine(third), /漁夫/);
});

test("summarizeRotationTimeline keeps a whole-match order", () => {
  const text = summarizeRotationTimeline([
    {
      startOffsetSec: 0,
      endOffsetSec: 40,
      rotation: { intent: "zone-first", path: "建物へ" },
    },
    {
      startOffsetSec: 40,
      endOffsetSec: 80,
      insights: [],
    },
    {
      startOffsetSec: 80,
      endOffsetSec: 120,
      rotation: { intent: "third-party", thirdPartyTiming: "01:32", path: "東へ" },
    },
  ]);
  assert.match(text, /00:00–00:40/);
  assert.match(text, /ゾーンファースト/);
  assert.match(text, /01:20–02:00/);
  assert.match(text, /漁夫/);
  assert.doesNotMatch(text, /00:40–01:20/);
});
