import { NextResponse } from "next/server";
import { getCoachProvider } from "@/lib/coach/provider";
import type {
  CoachChunkReport,
  CoachFrame,
  CoachMode,
  CoachRequest,
} from "@/lib/coach/types";
import { requestHasClip, resolveCoachMode } from "@/lib/coach/types";
import { gameConfigs, isGameId } from "@/lib/games";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FRAMES = 8;
const MAX_FRAME_CHARS = 900_000;
const MAX_CHUNK_REPORTS = 20;

type ParsedCoachBody = {
  videoUrl?: string;
  frames: CoachFrame[];
  game: string;
  rank: string;
  character: string;
  concern: string;
  mode: CoachMode;
  startOffsetSec?: number;
  endOffsetSec?: number;
  durationSec?: number;
  chunkIndex?: number;
  chunkCount?: number;
  segmentOnly?: boolean;
  chunkReports?: CoachChunkReport[];
};

export async function POST(request: Request) {
  try {
    const parsed = await readCoachBody(request);
    if (parsed instanceof NextResponse) return parsed;

    const { rank, character, frames, videoUrl, mode } = parsed;
    const game = parsed.game;
    const concern = parsed.concern;
    const clip = { videoUrl, frames };

    if (!isGameId(game)) {
      return NextResponse.json({ error: "対応ゲームを選択してください。" }, { status: 400 });
    }
    const config = gameConfigs[game];
    if (!config.ranks.includes(rank) || !config.characters.includes(character)) {
      return NextResponse.json(
        { error: `有効なランクと${config.characterLabel}を選択してください。` },
        { status: 400 },
      );
    }

    if (mode === "match-merge") {
      if (!parsed.chunkReports || parsed.chunkReports.length === 0) {
        return NextResponse.json({ error: "まとめる区間レポートがありません。" }, { status: 400 });
      }
    } else if (mode === "live") {
      if (frames.length === 0) {
        return NextResponse.json(
          { error: "画面共有のフレームが届いていません。ウィンドウまたは画面を共有してください。" },
          { status: 400 },
        );
      }
    } else if (!requestHasClip(clip) && concern.length < 8) {
      return NextResponse.json(
        { error: "動画を追加するか、立ち回り・目的を8文字以上書いてください。" },
        { status: 400 },
      );
    }

    const payload: CoachRequest = { game, rank, character, concern, frames, mode };
    if (videoUrl) payload.videoUrl = videoUrl;
    if (parsed.startOffsetSec != null) payload.startOffsetSec = parsed.startOffsetSec;
    if (parsed.endOffsetSec != null) payload.endOffsetSec = parsed.endOffsetSec;
    if (parsed.durationSec != null) payload.durationSec = parsed.durationSec;
    if (parsed.chunkIndex != null) payload.chunkIndex = parsed.chunkIndex;
    if (parsed.chunkCount != null) payload.chunkCount = parsed.chunkCount;
    if (parsed.segmentOnly) payload.segmentOnly = true;
    if (parsed.chunkReports) payload.chunkReports = parsed.chunkReports;

    const result = await getCoachProvider().analyze(payload);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "解析できませんでした。もう一度お試しください。" },
      { status: 500 },
    );
  }
}

async function readCoachBody(request: Request): Promise<ParsedCoachBody | NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "動画ファイルはAPIに直接送らず、先にクラウドへアップロードしてください。" },
      { status: 413 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSONの形式が正しくありません。" }, { status: 400 });
  }
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "JSONの形式が正しくありません。" }, { status: 400 });
  }
  const body = json as Record<string, unknown>;
  const frames = parseFrames(body.frames);
  if (frames instanceof NextResponse) return frames;
  const videoUrl = parseVideoUrl(body.videoUrl);
  if (videoUrl instanceof NextResponse) return videoUrl;
  const chunkReports = parseChunkReports(body.chunkReports);
  if (chunkReports instanceof NextResponse) return chunkReports;

  const mode = resolveCoachMode({ mode: stringifyField(body.mode) as CoachMode });

  return {
    videoUrl,
    frames,
    game: stringifyField(body.game),
    rank: stringifyField(body.rank),
    character: stringifyField(body.character),
    concern: stringifyField(body.concern),
    mode,
    startOffsetSec: parseNumber(body.startOffsetSec),
    endOffsetSec: parseNumber(body.endOffsetSec),
    durationSec: parseNumber(body.durationSec),
    chunkIndex: parseInteger(body.chunkIndex),
    chunkCount: parseInteger(body.chunkCount),
    segmentOnly: body.segmentOnly === true,
    chunkReports,
  };
}

function parseVideoUrl(value: unknown): string | undefined | NextResponse {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    return NextResponse.json({ error: "動画URLの形式が正しくありません。" }, { status: 400 });
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return NextResponse.json({ error: "動画URLの形式が正しくありません。" }, { status: 400 });
    }
    return trimmed;
  } catch {
    return NextResponse.json({ error: "動画URLの形式が正しくありません。" }, { status: 400 });
  }
}

function parseFrames(value: unknown): CoachFrame[] | NextResponse {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    return NextResponse.json({ error: "フレームの形式が正しくありません。" }, { status: 400 });
  }
  if (value.length > MAX_FRAMES) {
    return NextResponse.json({ error: "フレーム数が多すぎます。" }, { status: 400 });
  }
  const frames: CoachFrame[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return NextResponse.json({ error: "フレームの形式が正しくありません。" }, { status: 400 });
    }
    const row = entry as Record<string, unknown>;
    const dataUrl = typeof row.dataUrl === "string" ? row.dataUrl : "";
    if (!dataUrl.startsWith("data:image/jpeg") || dataUrl.length > MAX_FRAME_CHARS) {
      return NextResponse.json({ error: "フレーム画像を読み取れませんでした。" }, { status: 400 });
    }
    const timestamp = typeof row.timestamp === "number" && Number.isFinite(row.timestamp) ? row.timestamp : 0;
    frames.push({ timestamp, mimeType: "image/jpeg", dataUrl });
  }
  return frames;
}

function parseChunkReports(value: unknown): CoachChunkReport[] | undefined | NextResponse {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    return NextResponse.json({ error: "区間レポートの形式が正しくありません。" }, { status: 400 });
  }
  if (value.length > MAX_CHUNK_REPORTS) {
    return NextResponse.json({ error: "区間レポートが多すぎます。" }, { status: 400 });
  }
  const reports: CoachChunkReport[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return NextResponse.json({ error: "区間レポートの形式が正しくありません。" }, { status: 400 });
    }
    const row = entry as Record<string, unknown>;
    const insights = Array.isArray(row.insights)
      ? row.insights.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const insight = item as Record<string, unknown>;
          return [
            {
              id: stringifyField(insight.id) || "scene",
              timestamp: stringifyField(insight.timestamp) || undefined,
              title: stringifyField(insight.title),
              finding: stringifyField(insight.finding),
              action: stringifyField(insight.action),
            },
          ];
        })
      : [];
    reports.push({
      headline: stringifyField(row.headline) || undefined,
      summary: stringifyField(row.summary) || undefined,
      insights,
      startOffsetSec: parseNumber(row.startOffsetSec),
      endOffsetSec: parseNumber(row.endOffsetSec),
    });
  }
  return reports;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseInteger(value: unknown): number | undefined {
  const parsed = parseNumber(value);
  return parsed == null ? undefined : Math.trunc(parsed);
}

function stringifyField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value).trim();
  return "";
}
