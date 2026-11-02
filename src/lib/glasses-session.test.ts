import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COACH_LANGUAGES } from "./coach-language.ts";
import { glassesCopy, glassesCopyKeys } from "./glasses-copy.ts";
import { GLASSES_CODE_KEY } from "./glasses-client.ts";
import {
  applyGlassesAction,
  createGlassesHub,
  gestureFromTemple,
  glassesPluginUrl,
  GLASSES_CANVAS_LIMIT,
  GLASSES_TEXT_MAX,
  GLASSES_TEXT_MIN,
  normalizePairCode,
  parseWatchGesture,
  renderGlassesCanvas,
} from "./glasses-session.ts";
import { templeEventType } from "../../even-hub/g2-watch/src/temple.ts";

const TTL_MS = 45 * 60 * 1000;

test("pair codes avoid ambiguous characters and plugin URL follows the page host", () => {
  assert.equal(normalizePairCode(" k7m2 "), "K7M2");
  assert.equal(normalizePairCode("K7MO"), null);
  assert.equal(normalizePairCode("abc"), null);
  const hub = createGlassesHub();
  for (let i = 0; i < 20; i += 1) {
    const view = hub.open(i, "ja");
    assert.match(view.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  }
  assert.equal(
    glassesPluginUrl("http://localhost:3000/live", "ABCD"),
    "http://localhost:5173/?code=ABCD&api=http%3A%2F%2Flocalhost%3A3000",
  );
  assert.equal(new URL(glassesPluginUrl("http://192.168.1.8:3000", "K7M2")).host, "192.168.1.8:5173");
});

test("watch gestures and G2 temple events share one reducer", () => {
  assert.equal(parseWatchGesture("CLICK"), "click");
  assert.equal(parseWatchGesture("nope"), null);
  assert.equal(gestureFromTemple(undefined), "click");
  assert.equal(gestureFromTemple(0), "click");
  assert.equal(gestureFromTemple("2"), "scroll-down");
  assert.equal(gestureFromTemple(9), "long-press");
  assert.equal(gestureFromTemple(8), null);
  assert.equal(templeEventType({ textEvent: { eventType: undefined } }), 0);
  assert.equal(templeEventType({ textEvent: { eventType: 3 } }), 3);
  assert.equal(templeEventType({ textEvent: { eventType: 4 } }), null);
  assert.equal(templeEventType({ sysEvent: { eventType: 9 } }), 9);
  assert.equal(templeEventType({ sysEvent: { eventType: 8 } }), null);
  assert.equal(gestureFromTemple(templeEventType({ textEvent: {} })), "click");
  assert.equal(gestureFromTemple(templeEventType({ sysEvent: { eventType: 10 } })), "long-press-release");
});

test("a new cue wakes the lens, pin holds it, and the crown walks history", () => {
  const hub = createGlassesHub();
  const opened = hub.open(0, "ja");
  assert.equal(opened.revision, 1);
  assert.equal(opened.textColor, GLASSES_TEXT_MAX);
  assert.match(opened.canvas, /^Watch 8\n待機\n明4\n\n指示なし\nタップで最後の指示$/);

  const first = hub.line(opened.code, "ローテして切れ", 1);
  assert.equal(typeof first === "string", false);
  if (typeof first === "string") return;
  assert.equal(first.mode, "cue");
  assert.match(first.canvas, /指示 1\/1\n明4\n\nローテして切れ\n\nタップ 次/);
  assert.equal(first.canvas.length <= GLASSES_CANVAS_LIMIT, true);

  const pinned = hub.gesture(opened.code, "double-click", "watch", 2);
  if (typeof pinned === "string") return;
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.watchConnected, true);
  const held = hub.line(opened.code, "次のリングで切れ", 3);
  if (typeof held === "string") return;
  assert.match(held.canvas, /ローテして切れ/);
  assert.match(held.canvas, /固定/);
  assert.equal(held.count, 2);
  assert.equal(held.line, "ローテして切れ");

  const newer = hub.gesture(opened.code, "scroll-down", "watch", 4);
  if (typeof newer === "string") return;
  assert.equal(newer.line, "次のリングで切れ");
  const older = hub.gesture(opened.code, "scroll-up", "watch", 5);
  if (typeof older === "string") return;
  assert.equal(older.line, "ローテして切れ");
  hub.gesture(opened.code, "scroll-down", "watch", 6);

  const standby = hub.gesture(opened.code, "long-press", "watch", 6);
  if (typeof standby === "string") return;
  assert.equal(standby.mode, "standby");
  assert.match(standby.canvas, /待機/);
  const release = hub.gesture(opened.code, "long-press-release", "watch", 7);
  if (typeof release === "string") return;
  assert.equal(release.revision, standby.revision);

  const woken = hub.line(opened.code, "ホールド", 8);
  if (typeof woken === "string") return;
  assert.equal(woken.mode, "standby");
  assert.equal(woken.pinned, true);
  const unpinned = hub.gesture(opened.code, "double-click", "glasses", 9);
  if (typeof unpinned === "string") return;
  assert.equal(unpinned.pinned, false);
  assert.equal(unpinned.glassesConnected, true);
  const back = hub.gesture(opened.code, "click", null, 10);
  if (typeof back === "string") return;
  assert.equal(back.mode, "cue");
  assert.equal(back.line, "ホールド");
});

test("brightness stays inside the G2 text range and duplicate lines do not redraw", () => {
  const hub = createGlassesHub();
  const opened = hub.open(0, "en");
  let current = hub.line(opened.code, "hold the angle", 1);
  if (typeof current === "string") return;
  const revision = current.revision;
  current = hub.line(opened.code, "hold the angle", 2);
  if (typeof current === "string") return;
  assert.equal(current.revision, revision);
  current = hub.gesture(opened.code, "click", "watch", 3);
  if (typeof current === "string") return;
  assert.equal(current.revision, revision);
  for (let i = 0; i < 6; i += 1) current = hub.gesture(opened.code, "dimmer", "watch", 10 + i);
  if (typeof current === "string") return;
  assert.equal(current.textColor, GLASSES_TEXT_MIN);
  for (let i = 0; i < 6; i += 1) current = hub.gesture(opened.code, "brighter", "watch", 20 + i);
  if (typeof current === "string") return;
  assert.equal(current.textColor, GLASSES_TEXT_MAX);
  assert.match(current.canvas, /STANDBY|Cue/);
  assert.match(current.canvas, /B4/);

  const long = hub.line(opened.code, "x".repeat(200), 40);
  if (typeof long === "string") return;
  assert.equal(long.line.length <= 96, true);
  assert.equal(long.canvas.length <= GLASSES_CANVAS_LIMIT, true);
});

test("history keeps the newest eight cues and idle sessions expire", () => {
  const hub = createGlassesHub();
  const opened = hub.open(0, "ja");
  for (let i = 0; i < 9; i += 1) hub.line(opened.code, `cue-${i}`, i + 1);
  const latest = hub.read(opened.code, null, 20);
  if (typeof latest === "string") return;
  assert.equal(latest.count, 8);
  assert.equal(latest.line, "cue-8");
  assert.equal(latest.canvas.includes("cue-0"), false);
  assert.equal(hub.read(opened.code, null, 20 + TTL_MS + 1), "missing");
});

test("failed lookups back off and the action parser accepts watch and temple payloads", () => {
  const hub = createGlassesHub();
  for (let i = 0; i < 40; i += 1) assert.equal(hub.read("ABCD", null, 1000 + i), "missing");
  assert.equal(hub.read("ABCD", null, 2000), "busy");
  assert.deepEqual(applyGlassesAction(hub, { action: "gesture", code: "ABCD", gesture: "click" }, 3000), {
    status: 429,
    error: "busy",
  });

  const fresh = createGlassesHub();
  const opened = applyGlassesAction(fresh, { action: "open", language: "ja" }, 0);
  assert.equal(opened.status, 200);
  if (opened.status !== 200) return;
  const fromWatch = applyGlassesAction(fresh, {
    action: "gesture",
    code: opened.view.code,
    gesture: "dimmer",
    source: "watch",
  }, 1);
  assert.equal(fromWatch.status, 200);
  if (fromWatch.status !== 200) return;
  assert.equal(fromWatch.view.textColor, 3);
  const fromTemple = applyGlassesAction(fresh, {
    action: "gesture",
    code: opened.view.code,
    source: "glasses",
    eventType: 3,
  }, 2);
  assert.equal(fromTemple.status, 200);
  if (fromTemple.status !== 200) return;
  assert.equal(fromTemple.view.pinned, true);
  assert.equal(applyGlassesAction(fresh, { action: "nope", code: opened.view.code }, 3).status, 400);
  const english = applyGlassesAction(fresh, { action: "language", code: opened.view.code, language: "en" }, 4);
  assert.equal(english.status, 200);
  if (english.status !== 200) return;
  assert.match(english.view.canvas, /STANDBY/);
  assert.equal(renderGlassesCanvas({
    mode: "standby",
    cues: [],
    index: 0,
    pinned: false,
    textColor: 4,
    language: "en",
  }).startsWith("Watch 8\nSTANDBY"), true);
});

test("every glasses string exists in all 12 languages and the live page publishes cues", () => {
  const keys = glassesCopyKeys();
  const leads = new Set<string>();
  for (const language of COACH_LANGUAGES) {
    const copy = glassesCopy(language);
    leads.add(copy.lead);
    for (const key of keys) assert.ok(copy[key].trim().length > 0, `${language}.${key}`);
  }
  assert.equal(leads.size, COACH_LANGUAGES.length);
  assert.equal(glassesCopy("ja").open, "セッションを作る");
  assert.equal(glassesCopy("en").open, "Create session");

  const live = readFileSync(new URL("../components/live-session.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../components/home-screen.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/glasses/session/route.ts", import.meta.url), "utf8");
  const plugin = readFileSync(new URL("../../even-hub/g2-watch/src/main.ts", import.meta.url), "utf8");
  const watch = readFileSync(new URL("../../watch/VodcoachWatch/VodcoachWatchApp.swift", import.meta.url), "utf8");
  assert.equal(live.includes("pushGlassesCue"), true);
  assert.equal(home.includes("GlassesWatch"), true);
  assert.match(route, /Access-Control-Allow-Origin/);
  assert.match(plugin, /textContainerUpgrade/);
  assert.match(plugin, /waitForEvenAppBridge/);
  assert.match(watch, /digitalCrownRotation/);
  assert.match(watch, /scroll-up/);
  assert.equal(GLASSES_CODE_KEY, "vodcoach.glasses.code");
});
