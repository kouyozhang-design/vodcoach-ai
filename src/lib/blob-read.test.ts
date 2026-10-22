import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOB_ACCESS, blobPathnameFromUrl, isPrivateBlobUrl } from "./blob.ts";

test("live Blob store access is private", () => {
  assert.equal(BLOB_ACCESS, "private");
});

test("private Blob URLs expose pathname for presigned GET", () => {
  const url =
    "https://cdi5fpfujgayuxrm.private.blob.vercel-storage.com/coach-clips/clip-abc.mp4";
  assert.equal(isPrivateBlobUrl(url), true);
  assert.equal(blobPathnameFromUrl(url), "coach-clips/clip-abc.mp4");
  assert.equal(isPrivateBlobUrl("https://example.com/clip.mp4"), false);
});
