import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPool } from "./async-pool.ts";

test("mapPool preserves order and respects concurrency", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = [10, 20, 30, 40, 50];
  const out = await mapPool(items, 2, async (item, index) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 20));
    inFlight -= 1;
    return item + index;
  });
  assert.deepEqual(out, [10, 21, 32, 43, 54]);
  assert.ok(maxInFlight <= 2);
  assert.ok(maxInFlight >= 1);
});

test("mapPool handles empty input and caps workers to length", async () => {
  assert.deepEqual(await mapPool([], 8, async (item) => item), []);
  const seen: number[] = [];
  await mapPool([7], 9, async (item) => {
    seen.push(item);
    return item;
  });
  assert.deepEqual(seen, [7]);
});

test("mapPool stops claiming new items when aborted", async () => {
  const controller = new AbortController();
  const started: number[] = [];
  const pending: Array<() => void> = [];
  const run = mapPool(
    [1, 2, 3, 4, 5],
    2,
    async (item) => {
      started.push(item);
      await new Promise<void>((resolve) => pending.push(resolve));
      return item;
    },
    { signal: controller.signal },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  pending.forEach((resolve) => resolve());
  await assert.rejects(run, (error: unknown) => error instanceof Error && error.name === "AbortError");
  assert.ok(started.length <= 3);
});
