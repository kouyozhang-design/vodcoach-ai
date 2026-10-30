import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("the caption css keeps the spoken line solid inside a thin frame", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf(".live-caption {"), css.indexOf("@keyframes live-caption-in"));
  assert.match(block, /\.live-caption-text \{[^}]*opacity:\s*1/);
  assert.match(block, /top:\s*50%/);
  assert.match(block, /right:\s*0\.5rem/);
  assert.match(block, /translateY\(-50%\)/);
  assert.match(block, /max-width:\s*40%/);
  assert.match(block, /border:\s*1px solid rgb\(255 255 255 \/ 0\.22\)/);
  assert.match(block, /background:\s*transparent/);
  assert.match(block, /white-space:\s*nowrap/);
  assert.doesNotMatch(block, /left:\s*0\.5rem/);
  assert.doesNotMatch(block, /bottom:\s*0\.5rem/);
});
