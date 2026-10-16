import { NextResponse } from "next/server";
import { getCoachProvider } from "@/lib/coach/provider";
import type { CoachFrame, CoachRequest } from "@/lib/coach/types";
import { requestHasClip } from "@/lib/coach/types";
import { gameConfigs, isGameId } from "@/lib/games";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FRAMES = 6;
const MAX_FRAME_CHARS = 900_000;

type ParsedCoachBody = {
  videoUrl?: string;
  frames: CoachFrame[];
  game: string;
  rank: string;
  character: string;
  concern: string;
};

export async function POST(request: Request) {
  try {
    const parsed = await readCoachBody(request);
    if (parsed instanceof NextResponse) return parsed;

    const { rank, character, frames, videoUrl } = parsed;
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
    if (!requestHasClip(clip) && concern.length < 8) {
      return NextResponse.json(
        { error: "動画を追加するか、立ち回り・目的を8文字以上書いてください。" },
        { status: 400 },
      );
    }

    const payload: CoachRequest = { game, rank, character, concern, frames };
    if (videoUrl) payload.videoUrl = videoUrl;

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

  return {
    videoUrl,
    frames,
    game: stringifyField(body.game),
    rank: stringifyField(body.rank),
    character: stringifyField(body.character),
    concern: stringifyField(body.concern),
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

function stringifyField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value).trim();
  return "";
}
