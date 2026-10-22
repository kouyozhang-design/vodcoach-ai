import assert from "node:assert/strict";
import { test } from "node:test";
import { coachVideoContentType, normalizeCoachVideo } from "./video.ts";

test("coachVideoContentType maps Mac types without inventing a File copy", () => {
  assert.equal(coachVideoContentType({ name: "clip.mov", type: "" }), "video/quicktime");
  assert.equal(coachVideoContentType({ name: "clip.mp4", type: "" }), "video/mp4");
  assert.equal(coachVideoContentType({ name: "clip.mov", type: "video/x-quicktime" }), "video/quicktime");
  assert.equal(coachVideoContentType({ name: "clip.mp4", type: "video/h265" }), "video/hevc");
  assert.equal(coachVideoContentType({ name: "clip.mp4", type: "video/mp4" }), "video/mp4");
});

test("normalizeCoachVideo keeps the same File instance", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "clip.mov", { type: "" });
  assert.equal(normalizeCoachVideo(file), file);
});
