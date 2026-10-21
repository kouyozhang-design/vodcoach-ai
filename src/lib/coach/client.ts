"use client";

import type { CoachRequest, CoachResponse } from "./types";

/** Must stay under Vercel Hobby ~60s so a silent platform kill is never an infinite spinner. */
export const COACH_REQUEST_TIMEOUT_MS = 52_000;

export const COACH_TIMEOUT_ERROR = "解析が時間内に終わりませんでした。もう一度お試しください。";
export const COACH_GATEWAY_ERROR = "解析サーバーが時間切れになりました。もう一度お試しください。";
export const COACH_SERVER_ERROR = "解析できませんでした。もう一度お試しください。";
export const COACH_BAD_RESPONSE_ERROR = "解析サーバーから正しい応答が返りませんでした。";
export const COACH_ABORTED_ERROR = "解析を中断しました。";
export const MATCH_DEADLINE_ERROR = "試合解析が5分以内に終わりませんでした。短いクリップで試すか、もう一度お試しください。";

export type RequestCoachOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export function isAbortError(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { name?: string; code?: string };
  return error.name === "AbortError" || error.code === "ABORT_ERR";
}

export async function requestCoach(
  body: CoachRequest,
  options: RequestCoachOptions = {},
): Promise<CoachResponse> {
  const timeoutMs = options.timeoutMs ?? COACH_REQUEST_TIMEOUT_MS;
  const parent = options.signal;
  if (parent?.aborted) {
    throw abortError(parent);
  }

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parent?.addEventListener("abort", onParentAbort, { once: true });

  const timeoutError = new Error(COACH_TIMEOUT_ERROR);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fetchPromise = (async () => {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await readCoachPayload(response);
    if (!response.ok) {
      throw new Error(errorForStatus(response.status, payload.error));
    }
    if (!payload || typeof payload !== "object" || !("insights" in payload)) {
      throw new Error(COACH_BAD_RESPONSE_ERROR);
    }
    return payload as CoachResponse;
  })();

  // Race the timer so a Safari/fetch that never rejects on abort still clears the spinner.
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (reason) {
    if (parent?.aborted) {
      throw abortError(parent);
    }
    if (reason === timeoutError || isAbortError(reason) || controller.signal.aborted) {
      throw timeoutError;
    }
    if (reason instanceof Error && reason.message.trim()) {
      throw reason;
    }
    throw new Error(COACH_SERVER_ERROR);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    parent?.removeEventListener("abort", onParentAbort);
  }
}

async function readCoachPayload(response: Response): Promise<CoachResponse & { error?: string }> {
  const text = await response.text();
  if (!text.trim()) {
    if (!response.ok) return { error: errorForStatus(response.status) } as CoachResponse & { error?: string };
    throw new Error(COACH_BAD_RESPONSE_ERROR);
  }
  try {
    return JSON.parse(text) as CoachResponse & { error?: string };
  } catch {
    throw new Error(response.ok ? COACH_BAD_RESPONSE_ERROR : errorForStatus(response.status));
  }
}

export function errorForStatus(status: number, serverError?: string) {
  if (status === 504 || status === 408) return COACH_GATEWAY_ERROR;
  if (status === 429 || status === 503) {
    return "混み合っています。少し待ってからもう一度お試しください。";
  }
  const trimmed = typeof serverError === "string" ? serverError.trim() : "";
  if (trimmed) return trimmed;
  return COACH_SERVER_ERROR;
}

function abortError(signal: AbortSignal) {
  const reason = signal.reason;
  if (reason instanceof Error && reason.message.trim()) return reason;
  if (typeof reason === "string" && reason.trim()) return new Error(reason);
  return new Error(COACH_ABORTED_ERROR);
}
