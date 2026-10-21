import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  COACH_BAD_RESPONSE_ERROR,
  COACH_GATEWAY_ERROR,
  COACH_TIMEOUT_ERROR,
  isAbortError,
  requestCoach,
} from "./client.ts";
import type { CoachRequest } from "./types.ts";

const sample: CoachRequest = {
  game: "apex-legends",
  rank: "Platinum",
  character: "Wraith",
  concern: "近距離で先にダウンします",
  mode: "match-chunk",
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("requestCoach times out a hanging coach POST with a Japanese error", async () => {
  globalThis.fetch = async (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      signal.addEventListener(
        "abort",
        () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
        { once: true },
      );
    });

  await assert.rejects(
    () => requestCoach(sample, { timeoutMs: 40 }),
    (error: unknown) => error instanceof Error && error.message === COACH_TIMEOUT_ERROR,
  );
});

test("requestCoach maps HTML 504 to a Japanese gateway error", async () => {
  globalThis.fetch = async () =>
    new Response("<html>Gateway Timeout</html>", {
      status: 504,
      headers: { "Content-Type": "text/html" },
    });

  await assert.rejects(
    () => requestCoach(sample, { timeoutMs: 1_000 }),
    (error: unknown) => error instanceof Error && error.message === COACH_GATEWAY_ERROR,
  );
});

test("requestCoach surfaces JSON 500 error text and rejects empty 500", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "解析できませんでした。もう一度お試しください。" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    () => requestCoach(sample, { timeoutMs: 1_000 }),
    (error: unknown) =>
      error instanceof Error && error.message === "解析できませんでした。もう一度お試しください。",
  );

  globalThis.fetch = async () => new Response("", { status: 500 });
  await assert.rejects(
    () => requestCoach(sample, { timeoutMs: 1_000 }),
    (error: unknown) => error instanceof Error && error.message.includes("解析できませんでした"),
  );
});

test("requestCoach rejects non-JSON 200 and parent abort", async () => {
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  await assert.rejects(
    () => requestCoach(sample, { timeoutMs: 1_000 }),
    (error: unknown) => error instanceof Error && error.message === COACH_BAD_RESPONSE_ERROR,
  );

  const controller = new AbortController();
  controller.abort(new Error("試合解析が5分以内に終わりませんでした。短いクリップで試すか、もう一度お試しください。"));
  await assert.rejects(
    () => requestCoach(sample, { signal: controller.signal, timeoutMs: 1_000 }),
    (error: unknown) =>
      error instanceof Error && error.message.includes("5分以内に終わりませんでした"),
  );
});

test("requestCoach returns a 200 JSON coach payload", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        analysisId: "test",
        game: "apex-legends",
        character: "Wraith",
        headline: "ok",
        summary: "ok",
        insights: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const payload = await requestCoach(sample, { timeoutMs: 1_000 });
  assert.equal(payload.headline, "ok");
  assert.equal(payload.analysisId, "test");
});

test("isAbortError recognizes AbortError", () => {
  const error = new Error("Aborted");
  error.name = "AbortError";
  assert.equal(isAbortError(error), true);
  assert.equal(isAbortError(new Error("no")), false);
});
