import type { GameId } from "@/lib/games";

/** Legacy clip ids. New reports use free ids plus `tab`. */
export const CLIP_INSIGHT_IDS = ["aim", "positioning", "abilities", "practice"] as const;
export type ClipInsightId = (typeof CLIP_INSIGHT_IDS)[number];

export const INSIGHT_TAB_IDS = ["rotation", "aim", "abilities", "endgame", "other"] as const;
export type InsightTabId = (typeof INSIGHT_TAB_IDS)[number];

export const ROTATION_INTENTS = ["zone-first", "zone-cut", "third-party", "unknown"] as const;
export type RotationIntent = (typeof ROTATION_INTENTS)[number];

export type CoachMode = "clip" | "match-chunk" | "match-merge" | "live";
export type CoachReportKind = "clip" | "match" | "live" | "notes";

export type RotationNote = {
  intent?: RotationIntent;
  ring?: string;
  path?: string;
  thirdPartyTiming?: string;
  note?: string;
};

export type CoachInsight = {
  id: string;
  tab?: InsightTabId;
  timestamp?: string;
  title: string;
  finding: string;
  action: string;
};

export type CoachFrame = {
  timestamp: number;
  mimeType: "image/jpeg";
  dataUrl: string;
};

export type CoachRequest = {
  videoUrl?: string;
  frames?: CoachFrame[];
  game: GameId;
  rank: string;
  character: string;
  concern: string;
  mode?: CoachMode;
  startOffsetSec?: number;
  endOffsetSec?: number;
  durationSec?: number;
  chunkIndex?: number;
  chunkCount?: number;
  segmentOnly?: boolean;
  chunkReports?: CoachChunkReport[];
  recentCues?: string[];
};

export type CoachChunkReport = {
  headline?: string;
  summary?: string;
  insights?: CoachInsight[];
  rotation?: RotationNote;
  startOffsetSec?: number;
  endOffsetSec?: number;
};

export type CoachResponse = {
  analysisId: string;
  game: GameId;
  character: string;
  headline: string;
  summary: string;
  insights: CoachInsight[];
  kind?: CoachReportKind;
  durationSec?: number;
  chunk?: { startOffsetSec: number; endOffsetSec: number; index?: number; count?: number };
  truncated?: boolean;
  shouldSpeak?: boolean;
  skipReason?: string;
  rotation?: RotationNote;
  rotationStory?: string;
};

export interface VideoCoachProvider {
  analyze(input: CoachRequest): Promise<CoachResponse>;
}

export function requestHasClip(input: Pick<CoachRequest, "videoUrl" | "frames">) {
  return Boolean(input.videoUrl) || Boolean(input.frames && input.frames.length > 0);
}

export function resolveCoachMode(input: Pick<CoachRequest, "mode">): CoachMode {
  if (input.mode === "match-chunk" || input.mode === "match-merge" || input.mode === "live" || input.mode === "clip") {
    return input.mode;
  }
  return "clip";
}
