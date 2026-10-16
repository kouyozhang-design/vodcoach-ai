import { videoCoachProvider as mockProvider } from "./mock-provider";
import { openaiCoachProvider } from "./openai-provider";
import type { VideoCoachProvider } from "./types";

/**
 * Server-only coach selection. Secrets stay in Environment Variables
 * (`OPENAI_API_KEY`, `BLOB_READ_WRITE_TOKEN`) — never `NEXT_PUBLIC_*`.
 */
export function getCoachProvider(): VideoCoachProvider {
  const provider = (process.env.COACH_PROVIDER ?? "mock").trim().toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (provider === "openai" && openaiKey) {
    return openaiCoachProvider;
  }

  return mockProvider;
}
