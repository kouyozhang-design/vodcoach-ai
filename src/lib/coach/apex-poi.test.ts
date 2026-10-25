import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apexMapContext,
  approxPromptTokens,
  formatApexPoiIndex,
  formatApexPoiSlice,
  matchApexLocation,
  parseApexPoiRef,
  resolveApexLocation,
} from "./apex-poi.ts";
import { buildUserText } from "./prompts.ts";
import type { CoachRequest } from "./types.ts";

const apex: CoachRequest = {
  game: "apex-legends",
  rank: "Gold",
  character: "Wraith",
  concern: "近距離で先にダウンします",
};

test("matches Japanese and English POI names without inventing a map", () => {
  assert.deepEqual(matchApexLocation("フラグメント東で詰める"), {
    mapId: "worlds-edge",
    poiId: "fragment-east",
  });
  assert.deepEqual(matchApexLocation("Fragment West stacks"), {
    mapId: "worlds-edge",
    poiId: "fragment-west",
  });
  assert.deepEqual(matchApexLocation("Estates hold"), { mapId: "olympus", poiId: "estates" });
  assert.equal(matchApexLocation("特に地名は書いていない"), undefined);
});

test("explicit mapPoi wins over vague concern text", () => {
  const location = resolveApexLocation({
    ...apex,
    concern: "Skyhookが気になる",
    mapPoi: { map: "worlds-edge", poi: "fragment-east" },
  });
  assert.deepEqual(location, { mapId: "worlds-edge", poiId: "fragment-east" });
  assert.equal(parseApexPoiRef({ map: "nowhere", poi: "nowhere" }), undefined);
});

test("live unidentified sends the name index only, never the atlas", () => {
  const live = apexMapContext(apex, "live");
  assert.match(live, /Apex POI index/);
  assert.doesNotMatch(live, /Apex map atlas/);
  assert.doesNotMatch(live, /Apex map fact/);
  assert.doesNotMatch(live, /西ダンプ/);
  assert.ok(approxPromptTokens(live) < 220);
  assert.ok(approxPromptTokens(formatApexPoiIndex()) < 220);
});

test("live identified sends only the matched POI slice", () => {
  const slice = apexMapContext(
    { ...apex, mapPoi: { map: "worlds-edge", poi: "fragment-east" } },
    "live",
  );
  assert.match(slice, /Apex map fact/);
  assert.match(slice, /fragment-east/);
  assert.match(slice, /西ダンプ/);
  assert.doesNotMatch(slice, /Apex map atlas/);
  assert.doesNotMatch(slice, /skyhook:/);
  assert.doesNotMatch(slice, /estates:/);
  assert.ok(approxPromptTokens(slice) < 180);
  assert.ok(approxPromptTokens(formatApexPoiSlice({ mapId: "worlds-edge", poiId: "fragment-east" })) < 180);
});

test("VOD unidentified can include the compact atlas; VALORANT gets none", () => {
  const vod = apexMapContext(apex, "clip");
  assert.match(vod, /Apex map atlas/);
  assert.match(vod, /fragment-east/);
  assert.match(vod, /estates/);
  const valorant = apexMapContext(
    { game: "valorant", rank: "Gold", character: "Jett", concern: "サイト進入" },
    "live",
  );
  assert.equal(valorant, "");
});

test("user text wires win-rate cover and keeps VALORANT off the atlas", () => {
  const liveApex = buildUserText({ ...apex, mode: "live" }, "live", false, true);
  assert.match(liveApex, /勝率が上がる/);
  assert.match(liveApex, /Apex POI index/);
  assert.doesNotMatch(liveApex, /西ダンプ/);

  const liveKnown = buildUserText(
    { ...apex, mode: "live", mapPoi: { map: "worlds-edge", poi: "fragment-east" } },
    "live",
    false,
    true,
  );
  assert.match(liveKnown, /Apex map fact/);
  assert.match(liveKnown, /西ダンプ/);
  assert.doesNotMatch(liveKnown, /Apex map atlas/);

  const valo = buildUserText(
    { game: "valorant", rank: "Gold", character: "Jett", concern: "サイト進入で先に倒されます", mode: "live" },
    "live",
    false,
    true,
  );
  assert.doesNotMatch(valo, /Apex POI index/);
  assert.doesNotMatch(valo, /Apex map atlas/);
});
