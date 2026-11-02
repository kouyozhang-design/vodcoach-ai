import assert from "node:assert/strict";
import { test } from "node:test";
import { templeEventType } from "./temple.ts";
import {
  applyRemoteAction,
  createRemoteHub,
  gestureFromTemple,
  MENU,
  normalizePairCode,
  TEXT_MAX,
  TEXT_MIN,
} from "./session.ts";

const TTL_MS = 45 * 60 * 1000;

function viewOf<T>(result: T) {
  assert.equal(typeof result, "object");
  if (typeof result === "string") throw new Error(result);
  return result as Exclude<T, string>;
}

test("the lenses show a pair code the watch can type", () => {
  assert.equal(normalizePairCode(" k7m2 "), "K7M2");
  assert.equal(normalizePairCode("K7MO"), null);
  const hub = createRemoteHub();
  const opened = hub.open(0);
  assert.match(opened.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  assert.equal(opened.mode, "pair");
  assert.equal(opened.textColor, TEXT_MAX);
  assert.match(opened.canvas, new RegExp(`^Watch 8\\n${opened.code}\\n明4\\n\\nWatchにこのコード\\nタップでメニュー$`));
});

test("watch taps and the crown operate the menu, and temples use the same gestures", () => {
  assert.equal(gestureFromTemple(undefined), "click");
  assert.equal(gestureFromTemple(9), "long-press");
  assert.equal(gestureFromTemple(8), null);
  assert.equal(templeEventType({ textEvent: {} }), 0);
  assert.equal(templeEventType({ sysEvent: { eventType: 10 } }), 10);
  assert.equal(gestureFromTemple(templeEventType({ textEvent: { eventType: 2 } })), "scroll-down");

  const hub = createRemoteHub();
  const opened = hub.open(0);
  const menu = viewOf(hub.gesture(opened.code, "click", "watch", 1));
  assert.equal(menu.mode, "menu");
  assert.equal(menu.watchConnected, true);
  assert.match(menu.canvas, /> 明るさ\n {2}メモ\n {2}接続/);

  const next = viewOf(hub.gesture(opened.code, "scroll-down", "watch", 2));
  assert.equal(next.label, "メモ");
  assert.match(next.canvas, / {2}明るさ\n> メモ/);
  const back = viewOf(hub.gesture(opened.code, "scroll-up", "glasses", 3));
  assert.equal(back.label, "明るさ");
  assert.equal(back.glassesConnected, true);

  const page = viewOf(hub.gesture(opened.code, "click", "watch", 4));
  assert.equal(page.mode, "page");
  assert.match(page.canvas, /^明るさ\n明4\n\nクラウンで変更\nダブルで戻る$/);
  const dim = viewOf(hub.gesture(opened.code, "scroll-down", "watch", 5));
  assert.equal(dim.textColor, 3);
  const menuAgain = viewOf(hub.gesture(opened.code, "double-click", "watch", 6));
  assert.equal(menuAgain.mode, "menu");
  const pair = viewOf(hub.gesture(opened.code, "long-press", "watch", 7));
  assert.equal(pair.mode, "pair");
  const release = viewOf(hub.gesture(opened.code, "long-press-release", "watch", 8));
  assert.equal(release.revision, pair.revision);
});

test("brightness stays inside the G2 text range", () => {
  const hub = createRemoteHub();
  const opened = hub.open(0);
  let current = viewOf(hub.gesture(opened.code, "click", "watch", 1));
  for (let i = 0; i < 6; i += 1) current = viewOf(hub.gesture(opened.code, "dimmer", "watch", 10 + i));
  assert.equal(current.textColor, TEXT_MIN);
  for (let i = 0; i < 6; i += 1) current = viewOf(hub.gesture(opened.code, "brighter", "watch", 20 + i));
  assert.equal(current.textColor, TEXT_MAX);
  assert.equal(MENU.length, 3);
});

test("idle sessions expire and failed lookups back off", () => {
  const hub = createRemoteHub();
  const opened = hub.open(0);
  assert.equal(hub.read(opened.code, null, TTL_MS + 1), "missing");
  const limited = createRemoteHub();
  for (let i = 0; i < 40; i += 1) assert.equal(limited.read("ABCD", null, 1000 + i), "missing");
  assert.equal(limited.read("ABCD", null, 2000), "busy");
  const fresh = createRemoteHub();
  const created = applyRemoteAction(fresh, { action: "open" }, 0);
  assert.equal(created.status, 200);
  if (created.status !== 200) return;
  const fromTemple = applyRemoteAction(fresh, {
    action: "gesture",
    code: created.view.code,
    source: "glasses",
    eventType: 0,
  }, 1);
  assert.equal(fromTemple.status, 200);
  if (fromTemple.status !== 200) return;
  assert.equal(fromTemple.view.mode, "menu");
  assert.equal(applyRemoteAction(fresh, { action: "nope", code: created.view.code }, 2).status, 400);
});
