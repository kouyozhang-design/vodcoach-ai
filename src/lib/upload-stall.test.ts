import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOB_UPLOAD_INFLIGHT_STALL_MS,
  BLOB_UPLOAD_NETWORK_ERROR,
  BLOB_UPLOAD_STALL_ERROR,
  BLOB_UPLOAD_STALL_MS,
  BLOB_UPLOAD_TOKEN_ATTEMPTS,
  isBlobTokenError,
  isUploadStalled,
  mapUploadFailure,
  shouldRetryBlobToken,
  shouldStallUpload,
} from "./upload-stall.ts";

test("upload stall window is 70–90s and the error is Japanese", () => {
  assert.ok(BLOB_UPLOAD_STALL_MS >= 70_000 && BLOB_UPLOAD_STALL_MS <= 90_000);
  assert.equal(BLOB_UPLOAD_STALL_ERROR.includes("時間内"), false);
  assert.equal(BLOB_UPLOAD_STALL_ERROR.includes("5分"), false);
  assert.match(BLOB_UPLOAD_STALL_ERROR, /アップロードが進まなくなりました/);
});

test("increasing loaded bytes resets the stall clock past a 90s wall", () => {
  const started = 1_000_000;
  assert.equal(isUploadStalled(started, started + 79_999), false);
  assert.equal(isUploadStalled(started, started + BLOB_UPLOAD_STALL_MS), true);

  const afterNinetySeconds = started + 90_000;
  const lastByteAt = afterNinetySeconds - 5_000;
  assert.equal(isUploadStalled(lastByteAt, afterNinetySeconds), false);
  assert.equal(isUploadStalled(started, afterNinetySeconds), true);

  const afterFiveMinutes = started + 5 * 60 * 1000;
  const lastByteLater = afterFiveMinutes - 20_000;
  assert.equal(isUploadStalled(lastByteLater, afterFiveMinutes), false);
  assert.equal(isUploadStalled(started, afterFiveMinutes), true);
});

test("expired or unminted client tokens retry once, then map to a Japanese network error", () => {
  const expired = new Error("Vercel Blob: Client token has expired.");
  const retrieve = new Error("Vercel Blob: Failed to  retrieve the client token");
  assert.equal(isBlobTokenError(expired), true);
  assert.equal(isBlobTokenError(retrieve), true);
  assert.equal(shouldRetryBlobToken(expired, 1, BLOB_UPLOAD_TOKEN_ATTEMPTS), true);
  assert.equal(shouldRetryBlobToken(expired, 2, BLOB_UPLOAD_TOKEN_ATTEMPTS), false);
  assert.equal(isBlobTokenError(new Error("動画は80MB以下にしてください。")), false);
  assert.equal(mapUploadFailure(expired).message, BLOB_UPLOAD_NETWORK_ERROR);
});

test("in-flight parts do not idle-stall at 80s; only a long hang does", () => {
  const started = 1_000_000;
  assert.equal(shouldStallUpload({ lastActivityAt: started, inFlight: true, now: started + 80_000 }), false);
  assert.equal(shouldStallUpload({ lastActivityAt: started, inFlight: false, now: started + 80_000 }), true);
  assert.equal(
    shouldStallUpload({ lastActivityAt: started, inFlight: true, now: started + BLOB_UPLOAD_INFLIGHT_STALL_MS }),
    true,
  );
});

test("stall abort wins over a generic AbortError", () => {
  const stall = new AbortController();
  stall.abort(new Error(BLOB_UPLOAD_STALL_ERROR));
  const mapped = mapUploadFailure(Object.assign(new Error("Aborted"), { name: "AbortError" }), { stall: stall.signal });
  assert.equal(mapped.message, BLOB_UPLOAD_STALL_ERROR);
});
