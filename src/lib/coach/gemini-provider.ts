import { mimeFromFileName } from "@/lib/video";
import {
  requestHasClip,
  type CoachInsight,
  type CoachRequest,
  type CoachResponse,
  type VideoCoachProvider,
} from "./types";

const MODEL = "gemini-3.8-flash";
const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const FILES_START_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const FILES_GET_URL = "https://generativelanguage.googleapis.com/v1beta";
const EXTERNAL_URL_MAX_BYTES = 15 * 1024 * 1024;
const CONNECT_ERROR = "AIコーチに接続できませんでした。";
const PARSE_ERROR = "AIコーチの応答を解析できませんでした。";
const INSIGHT_IDS = ["aim", "positioning", "abilities", "practice"] as const;

class CoachProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "http" | "parse",
  ) {
    super(message);
  }
}

type GeminiPart = Record<string, unknown>;

class GeminiVideoCoachProvider implements VideoCoachProvider {
  async analyze(input: CoachRequest): Promise<CoachResponse> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new CoachProviderError(CONNECT_ERROR, "http");

    const videoUrl = input.videoUrl?.trim();
    const hasVideo = Boolean(videoUrl);
    const userText = buildUserText(input, hasVideo);

    let parsed: Record<string, unknown>;
    if (hasVideo && videoUrl) {
      parsed = await analyzeVideo(key, videoUrl, userText);
    } else {
      parsed = await generateCoachJson(key, [{ text: userText }]);
    }

    return toCoachResponse(parsed, input);
  }
}

async function analyzeVideo(apiKey: string, videoUrl: string, userText: string) {
  const { mimeType, size } = await sniffVideo(videoUrl);
  const urlPart = videoFilePart(videoUrl, mimeType);

  if (size === undefined || size <= EXTERNAL_URL_MAX_BYTES) {
    try {
      return await generateCoachJson(apiKey, [{ text: userText }, urlPart]);
    } catch (error) {
      const canFallback =
        error instanceof CoachProviderError ? error.kind === "http" : true;
      if (!canFallback) throw error;
    }
  }

  const uploaded = await uploadBlobToGeminiFiles(apiKey, videoUrl, mimeType);
  const filePart = videoFilePart(uploaded.uri, uploaded.mimeType || mimeType);
  return generateCoachJson(apiKey, [{ text: userText }, filePart]);
}

function videoFilePart(fileUri: string, mimeType: string): GeminiPart {
  return {
    file_data: { mime_type: mimeType, file_uri: fileUri },
    video_metadata: { fps: 1 },
  };
}

async function generateCoachJson(apiKey: string, parts: GeminiPart[]) {
  const response = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: COACH_SCHEMA,
      },
    }),
  });

  if (!response.ok) throw new CoachProviderError(CONNECT_ERROR, "http");

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!raw.trim()) throw new CoachProviderError(PARSE_ERROR, "parse");

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") throw new CoachProviderError(PARSE_ERROR, "parse");
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CoachProviderError) throw error;
    throw new CoachProviderError(PARSE_ERROR, "parse");
  }
}

async function uploadBlobToGeminiFiles(apiKey: string, videoUrl: string, mimeType: string) {
  const videoResponse = await fetch(videoUrl, { method: "GET", redirect: "follow" });
  if (!videoResponse.ok) throw new CoachProviderError(CONNECT_ERROR, "http");
  const bytes = await videoResponse.arrayBuffer();
  const resolvedMime =
    headerMime(videoResponse.headers.get("content-type")) || mimeType || "video/mp4";

  const start = await fetch(FILES_START_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": resolvedMime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "coach-clip" } }),
  });
  if (!start.ok) throw new CoachProviderError(CONNECT_ERROR, "http");

  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new CoachProviderError(CONNECT_ERROR, "http");

  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!uploaded.ok) throw new CoachProviderError(CONNECT_ERROR, "http");

  const started = (await uploaded.json()) as {
    file?: { name?: string; uri?: string; mimeType?: string; state?: string };
  };
  const file = started.file;
  if (!file?.name || !file.uri) throw new CoachProviderError(CONNECT_ERROR, "http");

  const ready = await waitUntilActive(apiKey, file.name);
  return { uri: ready.uri || file.uri, mimeType: ready.mimeType || resolvedMime };
}

async function waitUntilActive(apiKey: string, fileName: string) {
  const name = fileName.startsWith("files/") ? fileName : `files/${fileName}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${FILES_GET_URL}/${name}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!response.ok) throw new CoachProviderError(CONNECT_ERROR, "http");
    const payload = (await response.json()) as {
      uri?: string;
      mimeType?: string;
      state?: string;
      file?: { uri?: string; mimeType?: string; state?: string };
    };
    const state = payload.state || payload.file?.state;
    const uri = payload.uri || payload.file?.uri;
    const mimeType = payload.mimeType || payload.file?.mimeType;
    if (state === "FAILED") throw new CoachProviderError(CONNECT_ERROR, "http");
    if (state === "ACTIVE" && uri) return { uri, mimeType };
    await sleep(1000);
  }
  throw new CoachProviderError(CONNECT_ERROR, "http");
}

async function sniffVideo(videoUrl: string) {
  const fromName = mimeFromVideoUrl(videoUrl);
  try {
    const response = await fetch(videoUrl, { method: "HEAD", redirect: "follow" });
    const fromHeader = headerMime(response.headers.get("content-type"));
    const raw = response.ok ? response.headers.get("content-length") : null;
    const parsed = raw ? Number(raw) : NaN;
    return {
      mimeType: fromHeader || fromName,
      size: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    };
  } catch {
    return { mimeType: fromName, size: undefined };
  }
}

function mimeFromVideoUrl(url: string) {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname);
    return mimeFromFileName(pathname) || "video/mp4";
  } catch {
    return "video/mp4";
  }
}

function headerMime(value: string | null) {
  if (!value) return "";
  const mime = value.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime.startsWith("video/")) return mime;
  return "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SYSTEM_PROMPT = `あなたはFPSの動画コーチです。日本語で、指定JSONだけを返します。
insights は必ず4件で id は aim, positioning, abilities, practice の順。
各 insight は title / finding / action を具体的に。クリップ動画があるときは映像の時間帯に触れる。
JPEGの静止画フレームではなく、渡された動画そのものを見てください。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":"aim"|"positioning"|"abilities"|"practice","timestamp":string,"title":string,"finding":string,"action":string}]}`;

const COACH_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    summary: { type: "STRING" },
    insights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", enum: ["aim", "positioning", "abilities", "practice"] },
          timestamp: { type: "STRING" },
          title: { type: "STRING" },
          finding: { type: "STRING" },
          action: { type: "STRING" },
        },
        required: ["id", "title", "finding", "action"],
      },
    },
  },
  required: ["headline", "summary", "insights"],
};

function buildUserText(input: CoachRequest, hasVideo: boolean) {
  const lines = [
    `ゲーム: ${input.game}`,
    `ランク: ${input.rank}`,
    `キャラクター: ${input.character}`,
    `悩み・目的: ${input.concern || "（未記入。ランクとキャラから推測）"}`,
    hasVideo
      ? "クリップ動画を添付しています。動画ファイルそのものを見てコーチングしてください。"
      : "動画なし。ノートコーチングです。",
  ];
  if (input.videoUrl && hasVideo) {
    lines.push("クリップはクラウド上のHTTPS URLから参照しています。");
  }
  if (!hasVideo && requestHasClip(input)) {
    lines.push("静止画フレームは使わず、ノート情報だけでコーチングしてください。");
  }
  return lines.join("\n");
}

function toCoachResponse(parsed: Record<string, unknown>, input: CoachRequest): CoachResponse {
  const insightsRaw = Array.isArray(parsed.insights) ? parsed.insights : [];
  const insights: CoachInsight[] = INSIGHT_IDS.map((id, index) => {
    const row = (insightsRaw[index] ?? findInsight(insightsRaw, id) ?? {}) as Record<string, unknown>;
    return {
      id,
      timestamp: stringify(row.timestamp) || undefined,
      title: stringify(row.title) || fallbackTitle(id),
      finding: stringify(row.finding) || "この項目の具体的な観察は得られませんでした。",
      action: stringify(row.action) || "次の試合で一つだけ意識して繰り返してください。",
    };
  });

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    headline: stringify(parsed.headline) || `${input.character} コーチング · ${input.rank}`,
    summary: stringify(parsed.summary) || `${input.rank}の${input.character}向けの改善ポイントです。`,
    insights,
  };
}

function findInsight(rows: unknown[], id: CoachInsight["id"]) {
  return rows.find((row) => {
    if (!row || typeof row !== "object") return false;
    return stringify((row as Record<string, unknown>).id) === id;
  });
}

function stringify(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackTitle(id: CoachInsight["id"]) {
  if (id === "aim") return "エイム";
  if (id === "positioning") return "立ち回り";
  if (id === "abilities") return "スキル";
  return "練習";
}

export const geminiCoachProvider: VideoCoachProvider = new GeminiVideoCoachProvider();
