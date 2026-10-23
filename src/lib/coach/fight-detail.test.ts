import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fightWindowSec,
  framesInFightWindow,
  mergeCloseRangeFights,
  parseCloseRangeFights,
  resolveCloseRangeFights,
} from "./fight-detail.ts";
import type { CoachRequest } from "./types.ts";

const sample: CoachRequest = {
  game: "apex-legends",
  rank: "Platinum",
  character: "Wraith",
  concern: "近距離で遮蔽を離れて先にダウンします",
};

test("live never keeps close-range expanders", () => {
  const fights = parseCloseRangeFights(
    {
      closeRangeFights: [
        {
          id: "x",
          start: "00:10",
          end: "00:16",
          title: "正面ピーク",
          sightlines: "オフアングルを捨てている",
          knowHow: "左端へ戻れ",
        },
      ],
    },
    sample,
    "live",
  );
  assert.deepEqual(fights, []);
});

test("parse drops slogans and shifts match-chunk times", () => {
  const fights = parseCloseRangeFights(
    {
      closeRangeFights: [
        {
          start: "00:04",
          end: "00:12",
          title: "岩右のオフアングルを捨てて正面ピーク",
          sightlines: "ピークの権利はドア側。カバーは左1歩。",
          knowHow: "スイング前にタクティカル。撃つ順はドアから。",
        },
        {
          start: "00:20",
          title: "エイムを意識",
          sightlines: "エイムを意識",
          knowHow: "エイムを意識",
        },
      ],
    },
    { ...sample, startOffsetSec: 40, endOffsetSec: 80 },
    "match-chunk",
  );
  assert.equal(fights.length, 1);
  assert.equal(fights[0].start, "00:44");
  assert.equal(fights[0].end, "00:52");
  assert.match(fights[0].sightlines, /オフアングル|ピーク/);
});

test("fight window stays between 2 and 14 seconds", () => {
  assert.deepEqual(fightWindowSec({ start: "00:10", end: "00:11" }), { startSec: 10, endSec: 12 });
  assert.deepEqual(fightWindowSec({ start: "00:10", end: "00:40" }), { startSec: 10, endSec: 24 });
});

test("merge keeps unique scraps and merge fallback uses chunk fights", () => {
  const merged = mergeCloseRangeFights(
    [
      {
        id: "a",
        start: "00:10",
        end: "00:16",
        title: "岩右のオフアングル",
        sightlines: "左端",
        knowHow: "ドアから撃つ",
      },
      {
        id: "b",
        start: "00:10",
        end: "00:16",
        title: "岩右のオフアングルを再掲",
        sightlines: "同じ",
        knowHow: "同じ",
      },
      {
        id: "c",
        start: "01:20",
        end: "01:28",
        title: "漁夫の入口",
        sightlines: "尾根",
        knowHow: "人数を見てから",
      },
    ],
    8,
  );
  assert.equal(merged.length, 2);

  const resolved = resolveCloseRangeFights(
    { closeRangeFights: [] },
    {
      ...sample,
      chunkReports: [
        {
          startOffsetSec: 0,
          endOffsetSec: 40,
          closeRangeFights: [
            {
              id: "kept",
              start: "00:08",
              end: "00:16",
              title: "カバーを離れた",
              sightlines: "2本開いている",
              knowHow: "左端へ張る",
            },
          ],
        },
      ],
    },
    "match-merge",
  );
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, "kept");
});

test("framesInFightWindow keeps stills near the scrap", () => {
  const stills = framesInFightWindow(
    [
      { timestamp: 3, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aa" },
      { timestamp: 12, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,bb" },
      { timestamp: 40, mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,cc" },
    ],
    { start: "00:10", end: "00:16" },
  );
  assert.equal(stills.length, 1);
  assert.equal(stills[0].timestamp, 12);
});
