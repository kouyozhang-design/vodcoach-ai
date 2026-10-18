import type { GameId } from "@/lib/games";

export const CLIP_INSIGHT_IDS = ["aim", "positioning", "abilities", "practice"] as const;
export type ClipInsightId = (typeof CLIP_INSIGHT_IDS)[number];

export type CoachMode = "clip" | "match-chunk" | "match-merge" | "live";
export type CoachReportKind = "clip" | "match" | "live" | "notes";

export type CoachInsight = {
  id: string;
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
};

export type CoachChunkReport = {
  headline?: string;
  summary?: string;
  insights?: CoachInsight[];
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
