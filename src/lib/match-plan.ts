/** Time windows for full-match VOD coaching. Hobby functions die around 60s, so long matches are split. */

export const SHORT_CLIP_MAX_SEC = 90;
export const MATCH_CHUNK_SEC = 40;
export const MAX_MATCH_CHUNKS = 20;
export const MATCH_COVER_MAX_SEC = MATCH_CHUNK_SEC * MAX_MATCH_CHUNKS;

export type MatchChunk = {
  index: number;
  startSec: number;
  endSec: number;
};

export function isLongMatch(durationSec: number | null | undefined) {
  return typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > SHORT_CLIP_MAX_SEC;
}

export function planMatchChunks(durationSec: number): MatchChunk[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return [{ index: 0, startSec: 0, endSec: 0 }];
  }
  if (durationSec <= SHORT_CLIP_MAX_SEC) {
    return [{ index: 0, startSec: 0, endSec: roundSec(durationSec) }];
  }

  const coverEnd = Math.min(durationSec, MATCH_COVER_MAX_SEC);
  const chunks: MatchChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < coverEnd && chunks.length < MAX_MATCH_CHUNKS) {
    const rawEnd = Math.min(coverEnd, start + MATCH_CHUNK_SEC);
    const remainder = coverEnd - rawEnd;
    const end = remainder > 0 && remainder < 8 ? coverEnd : rawEnd;
    chunks.push({ index, startSec: roundSec(start), endSec: roundSec(end) });
    index += 1;
    start = end;
  }
  return chunks;
}

export function formatTimestamp(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function parseTimestamp(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  if (match[3] != null) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Shift a chunk-relative timestamp into match time. Absolute timestamps already inside the window are kept. */
export function shiftTimestamp(value: string | undefined, startSec: number, endSec: number): string | undefined {
  if (!value?.trim()) return formatTimestamp(startSec);
  const parsed = parseTimestamp(value);
  if (parsed == null) return value.trim();
  if (parsed >= startSec - 0.5 && parsed <= endSec + 1.5) return formatTimestamp(parsed);
  if (parsed <= endSec - startSec + 1.5) return formatTimestamp(parsed + startSec);
  return formatTimestamp(Math.min(endSec, Math.max(startSec, parsed)));
}

export function roundSec(value: number) {
  return Math.round(value * 10) / 10;
}
