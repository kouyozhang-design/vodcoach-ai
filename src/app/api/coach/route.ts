import { NextResponse } from "next/server";
import { getCoachProvider } from "@/lib/coach/provider";
import type { CoachRequest } from "@/lib/coach/types";
import { gameConfigs, isGameId } from "@/lib/games";
import { isAllowedCoachVideo } from "@/lib/video";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Hobby caps request bodies at ~4.5MB. Local/self-host keeps 100MB.
const MAX_VIDEO_BYTES = process.env.VERCEL ? Math.floor(4.5 * 1024 * 1024) : 100 * 1024 * 1024;

type ParsedCoachBody = {
  video?: File;
  game: string;
  rank: string;
  character: string;
  concern: string;
};

export async function POST(request: Request) {
  try {
    const parsed = await readCoachBody(request);
    if (parsed instanceof NextResponse) return parsed;

    const { video, rank, character } = parsed;
    const game = parsed.game;
    const concern = parsed.concern;

    if (video) {
      if (!isAllowedCoachVideo(video)) {
        return NextResponse.json({ error: "MP4、WebM、MOV形式の動画を使用してください。" }, { status: 415 });
      }
      if (video.size > MAX_VIDEO_BYTES) {
        return NextResponse.json(
          {
            error: process.env.VERCEL
              ? "Vercel 無料プランでは動画は約4.5MBまでです。短いクリップにするか、動画なしで解析してください。"
              : "動画は100MB以下にしてください。",
          },
          { status: 413 },
        );
      }
    }

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
    if (!video && concern.length < 8) {
      return NextResponse.json(
        { error: "動画を追加するか、立ち回り・目的を8文字以上書いてください。" },
        { status: 400 },
      );
    }

    const payload: CoachRequest = { game, rank, character, concern };
    if (video) payload.video = video;

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

  if (contentType.includes("application/json")) {
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
    return {
      game: stringifyField(body.game),
      rank: stringifyField(body.rank),
      character: stringifyField(body.character),
      concern: stringifyField(body.concern),
    };
  }

  const formData = await request.formData();
  return {
    video: optionalVideo(formData.get("video")),
    game: stringifyField(formData.get("game")),
    rank: stringifyField(formData.get("rank")),
    character: stringifyField(formData.get("character")),
    concern: stringifyField(formData.get("concern")),
  };
}

function stringifyField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value).trim();
  return "";
}

function optionalVideo(value: FormDataEntryValue | null): File | undefined {
  if (!(value instanceof File)) return undefined;
  if (value.size === 0 || value.name === "") return undefined;
  return value;
}
