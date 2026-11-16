import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPrivateBlobUrl } from "./blob.ts";
import { allowUserRequest } from "./request-limit.ts";

test("a private blob host is accepted and a lookalike host is not", () => {
  assert.equal(
    isPrivateBlobUrl("https://cdi5fpfujgayuxrm.private.blob.vercel-storage.com/coach-clips/clip.mp4"),
    true,
  );
  assert.equal(isPrivateBlobUrl("https://evil.example/x.private.blob.vercel-storage.com/clip.mp4"), false);
  assert.equal(isPrivateBlobUrl("https://user:pass@store.private.blob.vercel-storage.com/clip.mp4"), false);
  assert.equal(isPrivateBlobUrl("http://store.private.blob.vercel-storage.com/clip.mp4"), false);
});

test("a caller stops at the window limit and can continue after it expires", () => {
  const key = `guard-${Date.now()}`;
  assert.equal(allowUserRequest(key, 2, 1_000, 0), true);
  assert.equal(allowUserRequest(key, 2, 1_000, 10), true);
  assert.equal(allowUserRequest(key, 2, 1_000, 20), false);
  assert.equal(allowUserRequest(key, 2, 1_000, 1_100), true);
});

test("paid routes check the session and rate limit before spending or storing", () => {
  const coach = readFileSync(new URL("../app/api/coach/route.ts", import.meta.url), "utf8");
  const chat = readFileSync(new URL("../app/api/coach/chat/route.ts", import.meta.url), "utf8");
  const translate = readFileSync(new URL("../app/api/coach/translate/route.ts", import.meta.url), "utf8");
  const upload = readFileSync(new URL("../app/api/blob/upload/route.ts", import.meta.url), "utf8");
  const share = readFileSync(new URL("../app/api/share/route.ts", import.meta.url), "utf8");
  const gemini = readFileSync(new URL("./coach/gemini-provider.ts", import.meta.url), "utf8");
  for (const source of [coach, chat, translate, upload, share]) {
    assert.match(source, /gatePaidCaller/);
  }
  assert.match(coach, /isPrivateBlobUrl/);
  const fetchCalls = gemini.match(/fetch\(videoUrl/g) ?? [];
  assert.equal(fetchCalls.length, 0);
  assert.match(gemini, /isPrivateBlobUrl\(videoUrl\)/);
});
