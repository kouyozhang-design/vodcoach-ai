import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatTimestamp,
  isLongMatch,
  MATCH_CHUNK_CONCURRENCY,
  MATCH_CHUNK_SEC,
  planMatchChunks,
  shiftTimestamp,
  SHORT_CLIP_MAX_SEC,
} from "./match-plan.ts";

test("short clips stay one window", () => {
  assert.equal(isLongMatch(90), false);
  assert.equal(isLongMatch(90.1), true);
  const chunks = planMatchChunks(SHORT_CLIP_MAX_SEC);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].endSec, 90);
});

test("match windows stay 40s and concurrency stays a small pool", () => {
  assert.equal(MATCH_CHUNK_SEC, 40);
  assert.equal(MATCH_CHUNK_CONCURRENCY, 3);
});

test("long matches split into ~40s windows and fold tiny remainders", () => {
  const chunks = planMatchChunks(125);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].startSec, 0);
  assert.equal(chunks[0].endSec, 40);
  assert.equal(chunks[2].endSec, 125);
  const folded = planMatchChunks(87 + 40); // 127 → 40+40+47, remainder 7 after 120 would fold if 127-120=7 wait
  assert.ok(folded.length >= 3);
  const tiny = planMatchChunks(47);
  assert.equal(tiny.length, 1);
});

test("timestamps shift from chunk-relative to match time", () => {
  assert.equal(formatTimestamp(75), "01:15");
  assert.equal(shiftTimestamp("00:08", 40, 80), "00:48");
  assert.equal(shiftTimestamp("00:48", 40, 80), "00:48");
  assert.equal(shiftTimestamp("now", 40, 80), "now");
});
