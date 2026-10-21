import assert from "node:assert/strict";
import { test } from "node:test";
import { isAnalysisStalled, MATCH_STALL_ERROR, MATCH_STALL_MS } from "./analysis-stall.ts";

test("stall window is 70–90s and the error is Japanese", () => {
  assert.ok(MATCH_STALL_MS >= 70_000 && MATCH_STALL_MS <= 90_000);
  assert.equal(MATCH_STALL_ERROR.includes("5分"), false);
  assert.match(MATCH_STALL_ERROR, /解析が進まなくなりました/);
});

test("increasing N / a completed step resets the stall clock", () => {
  const started = 1_000_000;
  assert.equal(isAnalysisStalled(started, started + 79_999), false);
  assert.equal(isAnalysisStalled(started, started + MATCH_STALL_MS), true);

  // Wall clock can pass 5 minutes if chunks keep finishing.
  const afterFiveMinutes = started + 5 * 60 * 1000;
  const lastChunkAt = afterFiveMinutes - 20_000;
  assert.equal(isAnalysisStalled(lastChunkAt, afterFiveMinutes), false);
  assert.equal(isAnalysisStalled(started, afterFiveMinutes), true);
});
