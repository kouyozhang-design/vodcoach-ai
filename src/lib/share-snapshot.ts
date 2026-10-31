import { parseCoachLanguage, type CoachLanguage } from "./coach-language.ts";
import type {
  CloseRangeFight,
  CoachInsight,
  CoachReportKind,
  CoachResponse,
  InsightTabId,
  ViralScript,
} from "./coach/types.ts";
import type { GameId } from "./games.ts";

const SHARE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TABS = new Set<string>(["rotation", "aim", "abilities", "endgame", "other"]);
const KINDS = new Set<string>(["clip", "match", "live", "notes"]);
const MAX_JSON = 400_000;

export type ShareSnapshot = {
  version: 1;
  id: string;
  language: CoachLanguage;
  result: CoachResponse;
};

export function normalizeShareId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  return SHARE_ID.test(id) ? id : null;
}

export function shareBlobPath(id: string) {
  return `shares/${id}.json`;
}

export function sharePagePath(id: string) {
  return `/s/${id}`;
}

function clipText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

function asInsight(value: unknown): CoachInsight | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const title = clipText(row.title, 240);
  const finding = clipText(row.finding, 2000);
  const action = clipText(row.action, 2000);
  if (!title && !finding && !action) return null;
  const tab = typeof row.tab === "string" && TABS.has(row.tab) ? (row.tab as InsightTabId) : undefined;
  const timestamp = clipText(row.timestamp, 32);
  return {
    id: clipText(row.id, 80) || "insight",
    tab,
    timestamp: timestamp || undefined,
    title,
    finding,
    action,
  };
}

function asFight(value: unknown): CloseRangeFight | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const title = clipText(row.title, 240);
  const sightlines = clipText(row.sightlines, 4000);
  const knowHow = clipText(row.knowHow, 4000);
  if (!title && !sightlines && !knowHow) return null;
  return {
    id: clipText(row.id, 80) || "fight",
    start: clipText(row.start, 32),
    end: clipText(row.end, 32),
    title,
    sightlines,
    knowHow,
  };
}

function asViral(value: unknown): ViralScript | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const script = {
    video_title: clipText(row.video_title, 200),
    ai_tsukkomi: clipText(row.ai_tsukkomi, 200),
    cta_text: clipText(row.cta_text, 240),
  };
  if (!script.video_title && !script.ai_tsukkomi && !script.cta_text) return undefined;
  return script;
}

/**
 * A shareable coaching report. `id` is chosen by the server.
 * A client-supplied id is ignored so an existing link cannot be replaced.
 * Video bytes and frame data URLs are not kept.
 */
export function buildShareSnapshot(body: unknown, id: string): ShareSnapshot | null {
  const shareId = normalizeShareId(id);
  if (!shareId || !body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const raw = row.result;
  if (!raw || typeof raw !== "object") return null;
  const result = raw as Record<string, unknown>;
  if (result.game !== "apex-legends" && result.game !== "valorant") return null;
  const game = result.game as GameId;
  const insights = Array.isArray(result.insights)
    ? result.insights.map(asInsight).filter((item): item is CoachInsight => item !== null).slice(0, 60)
    : [];
  const fights = Array.isArray(result.closeRangeFights)
    ? result.closeRangeFights.map(asFight).filter((item): item is CloseRangeFight => item !== null).slice(0, 40)
    : [];
  const headline = clipText(result.headline, 400);
  const summary = clipText(result.summary, 4000);
  const rotationStory = clipText(result.rotationStory, 4000);
  if (!headline && !summary && insights.length === 0 && !rotationStory && fights.length === 0) return null;
  const kind = typeof result.kind === "string" && KINDS.has(result.kind) ? (result.kind as CoachReportKind) : undefined;
  const snapshot: ShareSnapshot = {
    version: 1,
    id: shareId,
    language: parseCoachLanguage(row.language),
    result: {
      analysisId: shareId,
      game,
      character: clipText(result.character, 80),
      headline,
      summary,
      insights,
      closeRangeFights: fights.length > 0 ? fights : undefined,
      kind,
      rotationStory: rotationStory || undefined,
      viralScript: game === "apex-legends" ? asViral(result.viralScript) : undefined,
    },
  };
  if (JSON.stringify(snapshot).length > MAX_JSON) return null;
  return snapshot;
}

export function parseShareSnapshot(raw: string): ShareSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    const id = normalizeShareId(parsed?.id);
    if (!id) return null;
    const snapshot = buildShareSnapshot(parsed, id);
    if (!snapshot || snapshot.id !== id) return null;
    return snapshot;
  } catch {
    return null;
  }
}
