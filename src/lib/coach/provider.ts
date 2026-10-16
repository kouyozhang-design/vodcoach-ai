import { geminiCoachProvider } from "./gemini-provider";
import { videoCoachProvider as mockProvider } from "./mock-provider";
import type { VideoCoachProvider } from "./types";

/**
 * Server-only coach selection. Secrets stay in Environment Variables
 * (`GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN`) — never `NEXT_PUBLIC_*`.
 *
 * Live coaching is Gemini video understanding. `COACH_PROVIDER=mock` forces
 * the local mock. Any other provider value uses Gemini when the key is set,
 * otherwise mock (do not call OpenAI).
 */
export function getCoachProvider(): VideoCoachProvider {
  const provider = (process.env.COACH_PROVIDER ?? "mock").trim().toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (provider === "mock") return mockProvider;
  if (geminiKey) return geminiCoachProvider;
  return mockProvider;
}
