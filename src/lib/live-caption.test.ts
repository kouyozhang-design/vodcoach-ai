import assert from "node:assert/strict";
import { test } from "node:test";
import { hiddenCaption, hideLiveCaption, showLiveCaption } from "./live-caption.ts";

test("a spoken line is one caption, and the next line replaces it", () => {
  const first = showLiveCaption(hiddenCaption, "岩へ切れ。");
  assert.equal(first.visible, true);
  assert.equal(first.text, "岩へ切れ。");
  assert.equal(first.fade, 1);

  const next = showLiveCaption(first, "  第3が右。 ");
  assert.equal(next.text, "第3が右。");
  assert.equal(next.visible, true);
  assert.equal(next.fade, 2);
  assert.equal("lines" in next, false);
});

test("speech ending hides that same line without starting a list", () => {
  const shown = showLiveCaption(hiddenCaption, "Cut back to the rock.");
  const hidden = hideLiveCaption(shown);
  assert.equal(hidden.visible, false);
  assert.equal(hidden.text, "Cut back to the rock.");
  assert.equal(hidden.fade, shown.fade);
  assert.equal(hideLiveCaption(hidden), hidden);
});

test("a blank line does not open a caption", () => {
  assert.equal(showLiveCaption(hiddenCaption, "   "), hiddenCaption);
  const shown = showLiveCaption(hiddenCaption, "待て。");
  const cleared = showLiveCaption(shown, "");
  assert.equal(cleared.visible, false);
  assert.equal(cleared.text, "待て。");
});
