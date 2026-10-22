import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOB_PART_BYTES,
  planBlobParts,
  uploadLoadedBytes,
  uploadPercentage,
} from "./blob-parts.ts";

test("planBlobParts uses 5MB slices and a smaller last part", () => {
  assert.equal(BLOB_PART_BYTES, 5 * 1024 * 1024);
  assert.deepEqual(planBlobParts(0), []);
  assert.deepEqual(planBlobParts(1), [{ partNumber: 1, start: 0, end: 1 }]);

  const exact = planBlobParts(BLOB_PART_BYTES);
  assert.equal(exact.length, 1);
  assert.equal(exact[0]?.end, BLOB_PART_BYTES);

  const over = planBlobParts(BLOB_PART_BYTES + 1);
  assert.equal(over.length, 2);
  assert.deepEqual(over[0], { partNumber: 1, start: 0, end: BLOB_PART_BYTES });
  assert.deepEqual(over[1], { partNumber: 2, start: BLOB_PART_BYTES, end: BLOB_PART_BYTES + 1 });

  const large = planBlobParts(80 * 1024 * 1024);
  assert.equal(large.length, 16);
  assert.equal(large[15]?.end, 80 * 1024 * 1024);
});

test("upload progress sums completed parts plus in-flight loaded", () => {
  const completed = new Map<number, number>([[1, 5_000_000]]);
  const inflight = new Map<number, number>([[2, 1_250_000]]);
  const loaded = uploadLoadedBytes(completed, inflight);
  assert.equal(loaded, 6_250_000);
  assert.equal(uploadPercentage(loaded, 10_000_000), 62.5);
  assert.equal(uploadPercentage(0, 10_000_000), 0);
  assert.equal(uploadPercentage(10_000_000, 10_000_000), 100);
});
