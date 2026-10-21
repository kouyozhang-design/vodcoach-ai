import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_INTERVAL_MS } from "./live-timing.ts";

test("live samples often instead of waiting a full 5 seconds", () => {
  assert.ok(LIVE_INTERVAL_MS <= 3000);
  assert.ok(LIVE_INTERVAL_MS >= 1500);
});
