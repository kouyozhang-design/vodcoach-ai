/** Error only when match analysis stops completing steps — not because wall clock passed 5 minutes. */
export const MATCH_STALL_MS = 80_000;

export const MATCH_STALL_ERROR = "解析が進まなくなりました。もう一度お試しください。";

export function isAnalysisStalled(
  lastProgressAt: number,
  now: number,
  stallMs = MATCH_STALL_MS,
) {
  if (!Number.isFinite(lastProgressAt) || !Number.isFinite(now) || !Number.isFinite(stallMs)) {
    return false;
  }
  return now - lastProgressAt >= stallMs;
}
