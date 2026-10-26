"use client";

import { bundleFromResult, type CoachTextBundle, type TranslateRequest } from "./coach-text";
import type { CoachResponse } from "./types";

export async function requestCoachTranslation(
  input: TranslateRequest,
  signal?: AbortSignal,
): Promise<CoachTextBundle> {
  const response = await fetch("/api/coach/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: input.language,
      sourceLanguage: input.sourceLanguage,
      bundle: input.bundle,
    }),
    signal,
  });
  const payload = (await response.json().catch(() => null)) as { bundle?: CoachTextBundle; error?: string } | null;
  if (!response.ok || !payload?.bundle) {
    throw new Error(payload?.error || "translate_failed");
  }
  return payload.bundle;
}

export function translationRequestFromResult(
  result: CoachResponse,
  language: TranslateRequest["language"],
  sourceLanguage: TranslateRequest["sourceLanguage"],
): TranslateRequest {
  return {
    language,
    sourceLanguage,
    bundle: bundleFromResult(result),
  };
}
