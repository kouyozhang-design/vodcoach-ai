import assert from "node:assert/strict";
import { test } from "node:test";
import { COACHING_BAR, FIGHT_EXPLAIN, looksLikeSlogan } from "./bar.ts";

test("coaching bar forbids outcome-only and slogan coaching", () => {
  assert.match(COACHING_BAR, /期待値/);
  assert.match(COACHING_BAR, /結果だけで褒めたり責めたりしない/);
  assert.match(COACHING_BAR, /ゲーム／ランク／キャラ／悩み/);
  assert.match(COACHING_BAR, /本当に指摘すべき局面だけ/);
  assert.match(COACHING_BAR, /ゾーンファースト/);
  assert.match(COACHING_BAR, /漁夫/);
  assert.match(COACHING_BAR, /詰め/);
  assert.match(COACHING_BAR, /件数は固定しない/);
  assert.match(COACHING_BAR, /段差/);
  assert.match(COACHING_BAR, /階段/);
  assert.match(COACHING_BAR, /確殺/);
  assert.match(COACHING_BAR, /武器/);
  assert.match(FIGHT_EXPLAIN, /解説ができた/);
  assert.match(FIGHT_EXPLAIN, /closeRangeFights/);
});

test("looksLikeSlogan catches generic FPS filler", () => {
  assert.equal(looksLikeSlogan("エイムを意識"), true);
  assert.equal(looksLikeSlogan("ポジションを取ろう"), true);
  assert.equal(
    looksLikeSlogan("00:18で岩から離れて2射線を同時に開いたので、左端に張り直す方が期待値が高い"),
    false,
  );
});
