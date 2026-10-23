import { looksLikeSlogan } from "./bar.ts";
import { parseTimestamp, shiftTimestamp } from "../match-plan.ts";
import type { CloseRangeFight, CoachChunkReport, CoachFrame, CoachMode, CoachRequest } from "./types.ts";

export const MAX_FIGHTS_BY_MODE: Record<CoachMode, number> = {
  clip: 4,
  "match-chunk": 3,
  "match-merge": 8,
  live: 0,
};

function stringify(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function fightWindowSec(fight: Pick<CloseRangeFight, "start" | "end">) {
  const start = parseTimestamp(fight.start) ?? 0;
  const parsedEnd = parseTimestamp(fight.end);
  const end = parsedEnd == null || parsedEnd <= start ? start + 6 : parsedEnd;
  return { startSec: start, endSec: Math.min(start + 14, Math.max(start + 2, end)) };
}

export function parseCloseRangeFights(
  parsed: Record<string, unknown>,
  input: CoachRequest,
  mode: CoachMode,
): CloseRangeFight[] {
  if (mode === "live") return [];
  const raw = Array.isArray(parsed.closeRangeFights) ? parsed.closeRangeFights : [];
  const start = input.startOffsetSec ?? 0;
  const end = input.endOffsetSec ?? start;
  const max = MAX_FIGHTS_BY_MODE[mode];
  const fights: CloseRangeFight[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const row = raw[index];
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const title = stringify(record.title);
    const sightlines = stringify(record.sightlines);
    const knowHow = stringify(record.knowHow);
    if (!title && !sightlines && !knowHow) continue;
    if (looksLikeSlogan(title) || looksLikeSlogan(sightlines) || looksLikeSlogan(knowHow)) continue;
    let startStamp = stringify(record.start) || stringify(record.timestamp);
    let endStamp = stringify(record.end);
    if (mode === "match-chunk") {
      startStamp = shiftTimestamp(startStamp, start, end) ?? startStamp;
      endStamp = shiftTimestamp(endStamp || startStamp, start, end) ?? endStamp;
    }
    if (!startStamp) continue;
    fights.push({
      id: stringify(record.id) || `fight-${index + 1}`,
      start: startStamp,
      end: endStamp || startStamp,
      title: title || `近距離 ${index + 1}`,
      sightlines: sightlines || knowHow,
      knowHow: knowHow || sightlines,
    });
  }
  return fights.slice(0, max);
}

export function mergeCloseRangeFights(fights: CloseRangeFight[], max: number) {
  const kept: CloseRangeFight[] = [];
  for (const fight of fights) {
    const same = kept.find(
      (item) =>
        item.start === fight.start &&
        item.title.slice(0, 8) === fight.title.slice(0, 8),
    );
    if (same) continue;
    kept.push(fight);
    if (kept.length >= max) break;
  }
  return kept;
}

export function fightsFromChunkReports(reports: CoachChunkReport[] | undefined) {
  return mergeCloseRangeFights(
    (reports ?? []).flatMap((report) => report.closeRangeFights ?? []),
    MAX_FIGHTS_BY_MODE["match-merge"],
  );
}

export function framesInFightWindow(
  frames: CoachFrame[] | undefined,
  fight: Pick<CloseRangeFight, "start" | "end">,
) {
  const { startSec, endSec } = fightWindowSec(fight);
  return (frames ?? []).filter(
    (frame) => frame.timestamp >= startSec - 1.5 && frame.timestamp <= endSec + 1.5,
  );
}

export function resolveCloseRangeFights(
  parsed: Record<string, unknown>,
  input: CoachRequest,
  mode: CoachMode,
) {
  const fromModel = parseCloseRangeFights(parsed, input, mode);
  if (mode === "match-merge" && fromModel.length === 0) {
    return fightsFromChunkReports(input.chunkReports);
  }
  return fromModel;
}
