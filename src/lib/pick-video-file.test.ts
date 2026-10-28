import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COACH_FILE_ACCEPT } from "./pick-video-file.ts";

test("file accept includes image and video and does not set capture", () => {
  assert.match(COACH_FILE_ACCEPT, /image\//);
  assert.match(COACH_FILE_ACCEPT, /video\//);
  assert.equal(COACH_FILE_ACCEPT.includes("capture"), false);
});

test("the homepage file field is one static React input", () => {
  const page = readFileSync(new URL("../components/home-screen.tsx", import.meta.url), "utf8");
  const picker = readFileSync(new URL("./pick-video-file.ts", import.meta.url), "utf8");
  assert.match(page, /<input[^>]*type="file"/);
  assert.equal(page.match(/type="file"/g)?.length, 1);
  assert.match(page, /accept=\{COACH_FILE_ACCEPT\}/);
  assert.doesNotMatch(page, /\bcapture\b/);
  assert.doesNotMatch(page, /createElement\(\s*["']input["']\s*\)/);
  assert.doesNotMatch(page, /showOpenFilePicker/);
  assert.doesNotMatch(page, /\.click\(\)/);
  assert.doesNotMatch(picker, /createElement\(\s*["']input["']\s*\)/);
  assert.doesNotMatch(picker, /showOpenFilePicker/);
  assert.doesNotMatch(picker, /new File\s*\(/);
});
