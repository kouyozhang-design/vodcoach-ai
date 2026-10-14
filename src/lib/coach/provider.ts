import { videoCoachProvider as mockProvider } from "./mock-provider";
import type { VideoCoachProvider } from "./types";

/**
 * Server-only coach selection. Secrets must stay in Environment Variables
 * (`OPENAI_API_KEY`, `GEMINI_API_KEY`) — never `NEXT_PUBLIC_*`.
 *
 * Today the shipped adapter is the local mock so a free Vercel deploy works
 * with no keys. When you add a GPT-4o / Gemini adapter, swap it here using
 * `COACH_PROVIDER=openai` or `COACH_PROVIDER=gemini`.
 */
export function getCoachProvider(): VideoCoachProvider {
  const provider = (process.env.COACH_PROVIDER ?? "mock").trim().toLowerCase();

  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    console.warn("[coach] COACH_PROVIDER=openai but OPENAI_API_KEY is unset; using mock.");
  }
  if ((provider === "gemini" || provider === "google") && !process.env.GEMINI_API_KEY) {
    console.warn("[coach] COACH_PROVIDER=gemini but GEMINI_API_KEY is unset; using mock.");
  }

  return mockProvider;
}
