import type { GameId } from "@/lib/games";

export type CoachInsight = {
  id: "aim" | "positioning" | "abilities" | "practice";
  timestamp?: string;
  title: string;
  finding: string;
  action: string;
};

export type CoachRequest = {
  video?: File;
  game: GameId;
  rank: string;
  character: string;
  concern: string;
};

export type CoachResponse = {
  analysisId: string;
  game: GameId;
  character: string;
  headline: string;
  summary: string;
  insights: CoachInsight[];
};

export interface VideoCoachProvider {
  analyze(input: CoachRequest): Promise<CoachResponse>;
}
