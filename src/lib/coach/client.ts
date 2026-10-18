"use client";

import type { CoachRequest, CoachResponse } from "./types";

export async function requestCoach(body: CoachRequest): Promise<CoachResponse> {
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as CoachResponse & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "解析に失敗しました。");
  }
  return payload;
}
