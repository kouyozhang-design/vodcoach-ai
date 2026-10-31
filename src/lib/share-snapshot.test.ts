import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildShareSnapshot,
  parseShareSnapshot,
  shareBlobPath,
  sharePagePath,
} from "./share-snapshot.ts";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const result = {
  analysisId: OTHER,
  game: "apex-legends",
  character: "Wraith",
  headline: "岩のピーク",
  summary: "2射線のまま打ち合っている。",
  insights: [{ id: "one", title: "ピーク", finding: "頭だけ出す。", action: "1歩下がる。" }],
  viralScript: { video_title: "岩", ai_tsukkomi: "頭だけ。", cta_text: "続きはアプリで。" },
  frames: [{ dataUrl: `data:image/jpeg;base64,${"a".repeat(80)}` }],
};

test("a share id is server-chosen and the page path can load it", () => {
  const snapshot = buildShareSnapshot({ id: OTHER, language: "ja", result }, ID);
  assert.ok(snapshot);
  assert.equal(snapshot.id, ID);
  assert.equal(snapshot.result.analysisId, ID);
  assert.equal(sharePagePath(snapshot.id), `/s/${ID}`);
  assert.equal(shareBlobPath(snapshot.id), `shares/${ID}.json`);
  assert.equal(JSON.stringify(snapshot).includes("dataUrl"), false);
  assert.equal(parseShareSnapshot(JSON.stringify(snapshot))?.result.headline, "岩のピーク");
  assert.equal(buildShareSnapshot({ language: "ja", result: { game: "apex-legends", headline: "" } }, ID), null);
  assert.equal(buildShareSnapshot({ language: "ja", result }, "../etc/passwd"), null);
});

test("valorant share drops a script and keeps the report", () => {
  const snapshot = buildShareSnapshot(
    {
      language: "en",
      result: {
        ...result,
        game: "valorant",
        character: "Jett",
      },
    },
    ID,
  );
  assert.ok(snapshot);
  assert.equal(snapshot.viralScript, undefined);
  assert.equal(snapshot.result.viralScript, undefined);
  assert.equal(snapshot.result.character, "Jett");
});

test("sharing writes a private blob and does not delete local history or touch billing", () => {
  const route = readFileSync(new URL("../app/api/share/route.ts", import.meta.url), "utf8");
  const store = readFileSync(new URL("./share-store.ts", import.meta.url), "utf8");
  const button = readFileSync(new URL("../components/squad-share-button.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../components/home-screen.tsx", import.meta.url), "utf8");
  const cards = readFileSync(new URL("../components/pricing-cards.tsx", import.meta.url), "utf8");
  assert.match(route, /crypto\.randomUUID\(\)/);
  assert.equal(route.includes("deleteSavedCoaching"), false);
  assert.equal(route.includes("writeProfileStatus"), false);
  assert.equal(route.includes("stripe"), false);
  assert.match(store, /access: "private"/);
  assert.match(store, /allowOverwrite: false/);
  assert.equal(store.includes("indexedDB"), false);
  assert.equal(button.includes("x.com"), false);
  assert.equal(button.includes("twitter"), false);
  const header = page.slice(page.indexOf('status === "complete"'), page.indexOf("<InsightBoard"));
  assert.match(header, /SquadShareButton/);
  assert.equal(header.includes("ShareTweetButton"), false);
  assert.equal(header.includes("x.com"), false);
  assert.ok(page.indexOf("<ShareTweetButton") > page.indexOf("<InsightBoard"));
  assert.match(page, /data-testid="coach-dashboard"/);
  assert.match(page, /deleteSavedCoaching/);
  assert.match(cards, /requestStripeCheckout/);
  assert.equal(cards.includes("webhook"), false);
});
