import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SHARE_APP_URL,
  SHARE_HASHTAG,
  TWEET_INTENT_URL,
  TWEET_MAX_CHARS,
  adviceFromResult,
  buildShareTweetText,
  buildShareTweetUrl,
  tweetCharCount,
} from "./share-tweet.ts";

test("tweet text keeps the Japanese hashtag, app URL, and stays within 280", () => {
  const text = buildShareTweetText("岩を離れて2射線を開いている。左端に張り直せ。");
  assert.match(text, /岩を離れて2射線/);
  assert.match(text, /#ApexAIコーチ/);
  assert.match(text, /https:\/\/vodcoach-ai\.vercel\.app/);
  assert.ok(tweetCharCount(text) <= TWEET_MAX_CHARS);
  assert.equal(SHARE_HASHTAG, "#ApexAIコーチ");
  assert.equal(SHARE_APP_URL, "https://vodcoach-ai.vercel.app");
});

test("long advice is truncated so hashtag and URL still fit", () => {
  const long = "あ".repeat(400);
  const text = buildShareTweetText(long);
  assert.match(text, /#ApexAIコーチ/);
  assert.match(text, /https:\/\/vodcoach-ai\.vercel\.app/);
  assert.ok(text.includes("…"));
  assert.ok(tweetCharCount(text) <= TWEET_MAX_CHARS);
  assert.ok(!text.startsWith("#ApexAIコーチ"));
});

test("intent URL uses x.com, encodeURIComponent, and no hashtags query param", () => {
  const url = buildShareTweetUrl("正面ピークを捨ててドアへ。");
  assert.ok(url.startsWith(`${TWEET_INTENT_URL}?text=`));
  assert.doesNotMatch(url, /[?&]hashtags=/);
  const encoded = url.slice(`${TWEET_INTENT_URL}?text=`.length);
  const decoded = decodeURIComponent(encoded);
  assert.match(decoded, /#ApexAIコーチ/);
  assert.match(decoded, /正面ピークを捨ててドアへ/);
  assert.equal(encoded, encodeURIComponent(decoded));
});

test("on-screen advice prefers the first insight, then summary", () => {
  assert.equal(
    adviceFromResult({
      headline: "見出しだけ",
      summary: "要約だけ",
      insights: [{ title: "岩を離れた", action: "左端に張り直せ" }],
    }),
    "岩を離れた。左端に張り直せ",
  );
  assert.equal(
    adviceFromResult({ headline: "見出し", summary: "要約だけ", insights: [] }),
    "要約だけ",
  );
});
