import { COACH_LANGUAGES, parseCoachLanguage, type CoachLanguage } from "./coach-language.ts";
import { bundleFromUnknown, type CoachTextBundle } from "./coach/coach-text.ts";
import type { CoachInsight, CoachResponse } from "./coach/types.ts";
import { isGameId, type GameId } from "./games.ts";
import type { SavedCoachingRecord } from "./saved-coaching.ts";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_PAYLOAD_CHARS = 900_000;

export type SyncPlan = {
  download: SavedCoachingRecord[];
  upload: SavedCoachingRecord[];
  dropLocalIds: string[];
};

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function insightsOf(value: unknown): CoachInsight[] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 40).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = text(row.title, 400);
    const finding = text(row.finding, 4000);
    const action = text(row.action, 4000);
    if (!title && !finding && !action) return [];
    const insight: CoachInsight = {
      id: text(row.id, 80) || "insight",
      title,
      finding,
      action,
    };
    if (typeof row.timestamp === "string" && row.timestamp.trim()) insight.timestamp = text(row.timestamp, 32);
    if (row.tab === "rotation" || row.tab === "aim" || row.tab === "abilities" || row.tab === "endgame" || row.tab === "other") {
      insight.tab = row.tab;
    }
    return [insight];
  });
}

function resultOf(value: unknown, id: string, game: GameId, character: string): CoachResponse | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const insights = insightsOf(row.insights);
  if (!insights) return null;
  const headline = text(row.headline, 400);
  const summary = text(row.summary, 8000);
  const result: CoachResponse = {
    analysisId: id,
    game,
    character,
    headline,
    summary,
    insights,
  };
  if (typeof row.rotationStory === "string" && row.rotationStory.trim()) result.rotationStory = text(row.rotationStory, 8000);
  if (row.kind === "clip" || row.kind === "match" || row.kind === "live" || row.kind === "notes") result.kind = row.kind;
  if (Array.isArray(row.closeRangeFights)) {
    result.closeRangeFights = row.closeRangeFights.slice(0, 16).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const fight = item as Record<string, unknown>;
      return [{
        id: text(fight.id, 80) || "fight",
        start: text(fight.start, 32),
        end: text(fight.end, 32),
        title: text(fight.title, 400),
        sightlines: text(fight.sightlines, 4000),
        knowHow: text(fight.knowHow, 4000),
      }];
    });
  }
  if (row.viralScript && typeof row.viralScript === "object") {
    const viral = row.viralScript as Record<string, unknown>;
    result.viralScript = {
      video_title: text(viral.video_title, 200),
      ai_tsukkomi: text(viral.ai_tsukkomi, 200),
      cta_text: text(viral.cta_text, 200),
    };
  }
  if (row.rotation && typeof row.rotation === "object") {
    const rotation = row.rotation as Record<string, unknown>;
    result.rotation = {
      ring: text(rotation.ring, 400),
      path: text(rotation.path, 400),
      thirdPartyTiming: text(rotation.thirdPartyTiming, 400),
      note: text(rotation.note, 800),
    };
    if (
      rotation.intent === "zone-first"
      || rotation.intent === "zone-cut"
      || rotation.intent === "third-party"
      || rotation.intent === "unknown"
    ) {
      result.rotation.intent = rotation.intent;
    }
  }
  return result;
}

function bundlesOf(value: unknown): Partial<Record<CoachLanguage, CoachTextBundle>> {
  if (!value || typeof value !== "object") return {};
  const next: Partial<Record<CoachLanguage, CoachTextBundle>> = {};
  for (const [key, bundle] of Object.entries(value as Record<string, unknown>)) {
    if (!(COACH_LANGUAGES as readonly string[]).includes(key)) continue;
    const parsed = bundleFromUnknown(bundle);
    if (!parsed) continue;
    next[key as CoachLanguage] = parsed;
  }
  return next;
}

/** Coaching JSON only. No video, no frames, no local sync flags. */
export function accountRecordBody(record: unknown): SavedCoachingRecord | null {
  const parsed = parseAccountRecord(record);
  if (!parsed) return null;
  const encoded = JSON.stringify(parsed);
  if (encoded.length > MAX_PAYLOAD_CHARS || encoded.includes("data:image")) return null;
  return parsed;
}

export function parseAccountRecord(value: unknown): SavedCoachingRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = text(row.id, 80);
  if (!ID_PATTERN.test(id)) return null;
  const gameText = text(row.game, 40);
  if (!isGameId(gameText)) return null;
  const character = text(row.character, 80);
  const result = resultOf(row.result, id, gameText, character);
  if (!result) return null;
  const savedAt = typeof row.savedAt === "number" && Number.isFinite(row.savedAt) ? row.savedAt : 0;
  const updatedAt = typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt) ? row.updatedAt : savedAt;
  const record: SavedCoachingRecord = {
    id,
    savedAt,
    updatedAt,
    game: gameText,
    character,
    rank: text(row.rank, 80),
    concern: text(row.concern, 240),
    sourceLanguage: parseCoachLanguage(row.sourceLanguage),
    result,
    translations: bundlesOf(row.translations),
  };
  const videoName = text(row.videoName, 180);
  if (videoName) record.videoName = videoName;
  return record;
}

/**
 * Signed-out rows stay on the device: they upload only when pendingAccount was set
 * while a session was saving them. An account copy missing on the server was deleted
 * on another device.
 */
export function planAccountSync(local: SavedCoachingRecord[], remote: SavedCoachingRecord[]): SyncPlan {
  const remoteById = new Map(remote.map((row) => [row.id, row]));
  const download: SavedCoachingRecord[] = [];
  const upload: SavedCoachingRecord[] = [];
  const dropLocalIds: string[] = [];

  for (const row of remote) {
    const mine = local.find((item) => item.id === row.id);
    if (!mine || row.updatedAt > mine.updatedAt) download.push(row);
  }

  for (const row of local) {
    const theirs = remoteById.get(row.id);
    if (row.pendingAccount && (!theirs || row.updatedAt >= theirs.updatedAt)) {
      upload.push(row);
      continue;
    }
    if (row.accountCopy && !theirs && !row.pendingAccount) dropLocalIds.push(row.id);
  }

  return { download, upload, dropLocalIds };
}

/** Keep this device's video URL when the account row replaces the coaching JSON. */
export function recordFromAccount(remote: SavedCoachingRecord, local: SavedCoachingRecord | null): SavedCoachingRecord {
  return {
    ...remote,
    remoteVideoUrl: local?.remoteVideoUrl,
    pendingAccount: false,
    accountCopy: true,
  };
}
