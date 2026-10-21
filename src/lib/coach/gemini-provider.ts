import { formatTimestamp, shiftTimestamp } from "@/lib/match-plan";
import { mimeFromFileName } from "@/lib/video";
import {
  CLIP_INSIGHT_IDS,
  requestHasClip,
  resolveCoachMode,
  type CoachInsight,
  type CoachMode,
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

class CoachProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "http" | "parse" | "rate-limit",
    readonly status?: number,
  ) {
    super(message);
  }
}

type GeminiPart = Record<string, unknown>;

class GeminiVideoCoachProvider implements VideoCoachProvider {
  async analyze(input: CoachRequest): Promise<CoachResponse> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new CoachProviderError(CONNECT_ERROR, "http");

    const mode = resolveCoachMode(input);
    const videoUrl = input.videoUrl?.trim();
    const frames = input.frames ?? [];
    const hasVideo = Boolean(videoUrl);
    const userText = buildUserText(input, mode, hasVideo, frames.length > 0);

    let parsed: Record<string, unknown>;
    if (mode === "match-merge") {
      parsed = await generateCoachJson(key, [{ text: userText }], mode);
    } else if (hasVideo && videoUrl) {
      parsed = await analyzeVideo(key, videoUrl, userText, input, mode, frames);
    } else if (frames.length > 0) {
      parsed = await generateCoachJson(key, [{ text: userText }, ...imageParts(frames)], mode);
    } else {
      parsed = await generateCoachJson(key, [{ text: userText }], mode);
    }

    return toCoachResponse(parsed, input, mode);
  }
}

async function analyzeVideo(
  apiKey: string,
  videoUrl: string,
  userText: string,
  input: CoachRequest,
  mode: CoachMode,
  frames: CoachRequest["frames"],
) {
  const range = videoRange(input, mode);
  const { mimeType, size } = await sniffVideo(videoUrl);
  const urlPart = videoFilePart(videoUrl, mimeType, range);
  const allowFilesApi = mode === "clip" && !input.segmentOnly;
  const extras = frames && frames.length > 0 ? imageParts(frames) : [];

  const tryUrl = size === undefined || size <= EXTERNAL_URL_MAX_BYTES || mode !== "clip";
  if (tryUrl) {
    try {
      // Blob URL path: video only. JPEG backups stay off this request so HUD/legend reads stay on the clip.
      return await generateCoachJson(apiKey, [{ text: userText }, urlPart], mode);
    } catch (error) {
      if (error instanceof CoachProviderError && (error.kind === "parse" || error.kind === "rate-limit")) {
        throw error;
      }
      const canFallback = error instanceof CoachProviderError ? error.kind === "http" : true;
      if (!canFallback) throw error;
      if (extras.length > 0) {
        return generateCoachJson(apiKey, [{ text: userText }, ...extras], mode);
      }
      if (!allowFilesApi) throw error;
    }
  }

  if (!allowFilesApi) {
    if (extras.length > 0) return generateCoachJson(apiKey, [{ text: userText }, ...extras], mode);
    throw new CoachProviderError(CONNECT_ERROR, "http");
  }

  const uploaded = await uploadBlobToGeminiFiles(apiKey, videoUrl, mimeType);
  const filePart = videoFilePart(uploaded.uri, uploaded.mimeType || mimeType, range);
  return generateCoachJson(apiKey, [{ text: userText }, filePart], mode);
}

function videoRange(input: CoachRequest, mode: CoachMode) {
  if (mode !== "match-chunk" || input.segmentOnly) return undefined;
  if (input.startOffsetSec == null && input.endOffsetSec == null) return undefined;
  return { start: input.startOffsetSec, end: input.endOffsetSec };
}

function videoFilePart(
  fileUri: string,
  mimeType: string,
  range?: { start?: number; end?: number },
): GeminiPart {
  const metadata: Record<string, unknown> = { fps: 1 };
  if (typeof range?.start === "number" && Number.isFinite(range.start)) {
    metadata.start_offset = `${Math.max(0, range.start)}s`;
  }
  if (typeof range?.end === "number" && Number.isFinite(range.end) && range.end > (range.start ?? 0)) {
    metadata.end_offset = `${range.end}s`;
  }
  return {
    file_data: { mime_type: mimeType, file_uri: fileUri },
    video_metadata: metadata,
  };
}

function imageParts(frames: NonNullable<CoachRequest["frames"]>): GeminiPart[] {
  const parts: GeminiPart[] = [];
  for (const frame of frames) {
    const part = inlineJpeg(frame.dataUrl);
    if (part) {
      parts.push({ text: `静止画 ${formatTimestamp(frame.timestamp)}` }, part);
    }
  }
  return parts;
}

function inlineJpeg(dataUrl: string): GeminiPart | null {
  const match = dataUrl.match(/^data:(image\/jpeg);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  return { inline_data: { mime_type: "image/jpeg", data: match[2].replace(/\s+/g, "") } };
}

const MAX_GENERATE_ATTEMPTS = 3;

async function generateCoachJson(apiKey: string, parts: GeminiPart[], mode: CoachMode) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt(mode) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: mode === "live" ? 0.3 : 0.4,
      responseMimeType: "application/json",
      responseSchema: schemaFor(mode),
    },
  });

  let lastRateLimit: CoachProviderError | undefined;
  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(GENERATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
        signal: AbortSignal.timeout(48_000),
      });
    } catch {
      throw new CoachProviderError(CONNECT_ERROR, "http");
    }

    if (response.status === 429 || response.status === 503) {
      lastRateLimit = new CoachProviderError(CONNECT_ERROR, "rate-limit", response.status);
      if (attempt < MAX_GENERATE_ATTEMPTS - 1) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      throw lastRateLimit;
    }

    if (!response.ok) throw new CoachProviderError(CONNECT_ERROR, "http", response.status);

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

  throw lastRateLimit ?? new CoachProviderError(CONNECT_ERROR, "http");
}

function retryDelayMs(attempt: number) {
  return 800 * 2 ** attempt + Math.floor(Math.random() * 280);
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
    const response = await fetch(videoUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
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

function systemPrompt(mode: CoachMode) {
  if (mode === "live") {
    return `あなたはFPSのライブコーチです。日本語で指定JSONだけを返します。
今見えているゲーム画面（共有フレーム）だけを根拠に、直後の動きを短く指示します。
insights は2〜4件。id は自由（fight, peek, util, rotate など）。timestamp は "now" か経過 mm:ss。
ゲーム内HUDへ重ねる前提の指示は書かない。画面が黒・メニュー・非ゲームならその旨を summary に書く。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":string,"timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  if (mode === "match-chunk") {
    return `あなたはFPSの試合VODコーチです。日本語で指定JSONだけを返します。
渡された時間帯だけを見て、具体的な場面を4〜8件出します。aim / positioning / abilities / practice の4枠に縛らない。
timestamp は試合全体の mm:ss（チャンク先頭からの相対ではなく絶対時間）。
JPEGは補助。動画セグメントがあるときは動画を優先。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":string,"timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  if (mode === "match-merge") {
    return `あなたはFPSの試合レポート編集者です。日本語で指定JSONだけを返します。
区間レポートを1本の試合レポートにまとめます。重複は削り、タイムスタンプ付きの具体的な場面を8〜16件残します。
4枠（aim/positioning/abilities/practice）に圧縮しない。timestamp は mm:ss のまま。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":string,"timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  return `あなたはFPSの動画コーチです。日本語で、指定JSONだけを返します。
insights は必ず4件で id は aim, positioning, abilities, practice の順。
各 insight は title / finding / action を具体的に。クリップ動画があるときは映像の時間帯に触れる。
JPEGの静止画フレームではなく、渡された動画そのものを見てください。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":"aim"|"positioning"|"abilities"|"practice","timestamp":string,"title":string,"finding":string,"action":string}]}`;
}

function schemaFor(mode: CoachMode) {
  const insightProperties =
    mode === "clip"
      ? {
          id: { type: "STRING", enum: [...CLIP_INSIGHT_IDS] },
          timestamp: { type: "STRING" },
          title: { type: "STRING" },
          finding: { type: "STRING" },
          action: { type: "STRING" },
        }
      : {
          id: { type: "STRING" },
          timestamp: { type: "STRING" },
          title: { type: "STRING" },
          finding: { type: "STRING" },
          action: { type: "STRING" },
        };
  return {
    type: "OBJECT",
    properties: {
      headline: { type: "STRING" },
      summary: { type: "STRING" },
      insights: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: insightProperties,
          required: ["id", "title", "finding", "action"],
        },
      },
    },
    required: ["headline", "summary", "insights"],
  };
}

function buildUserText(input: CoachRequest, mode: CoachMode, hasVideo: boolean, hasFrames: boolean) {
  const lines = [
    `ゲーム: ${input.game}`,
    `ランク: ${input.rank}`,
    `キャラクター: ${input.character}`,
    `悩み・目的: ${input.concern || "（未記入。ランクとキャラから推測）"}`,
  ];

  if (mode === "live") {
    lines.push("ライブ画面共有のフレームです。今この瞬間のコーチングを返してください。ゲーム内オーバーレイは使いません。");
    if (hasFrames) lines.push(`静止画 ${input.frames?.length ?? 0} 枚を添付しています。`);
    return lines.join("\n");
  }

  if (mode === "match-merge") {
    const reports = input.chunkReports ?? [];
    lines.push("以下は試合を時間分割して解析した区間レポートです。1本の試合レポートに統合してください。");
    if (input.durationSec) lines.push(`試合の長さ: ${formatTimestamp(input.durationSec)}`);
    reports.forEach((report, index) => {
      const start = report.startOffsetSec ?? 0;
      const end = report.endOffsetSec ?? start;
      lines.push(`--- 区間 ${index + 1} ${formatTimestamp(start)}–${formatTimestamp(end)} ---`);
      if (report.headline) lines.push(`見出し: ${report.headline}`);
      if (report.summary) lines.push(`要約: ${report.summary}`);
      for (const insight of report.insights ?? []) {
        lines.push(
          `- [${insight.timestamp || "?"}] ${insight.title}: ${insight.finding} / 行動: ${insight.action}`,
        );
      }
    });
    return lines.join("\n");
  }

  if (mode === "match-chunk") {
    const start = input.startOffsetSec ?? 0;
    const end = input.endOffsetSec ?? start;
    lines.push(
      `試合VODの区間 ${formatTimestamp(start)}–${formatTimestamp(end)} です。timestamp はこの試合時刻で書いてください。`,
    );
    if (typeof input.chunkIndex === "number" && typeof input.chunkCount === "number") {
      lines.push(`区間 ${input.chunkIndex + 1}/${input.chunkCount}`);
    }
    if (input.durationSec) lines.push(`試合全体の長さ: ${formatTimestamp(input.durationSec)}`);
    if (hasVideo) lines.push("クリップはクラウド上のHTTPS URLです。指定オフセットの動画を優先してください。");
    if (hasFrames) lines.push("同じ区間のJPEGを補助として添付しています。");
    return lines.join("\n");
  }

  lines.push(
    hasVideo
      ? "クリップ動画を添付しています。動画ファイルそのものを見てコーチングしてください。"
      : "動画なし。ノートコーチングです。",
  );
  if (input.videoUrl && hasVideo) {
    lines.push("クリップはクラウド上のHTTPS URLから参照しています。");
  }
  if (!hasVideo && requestHasClip(input)) {
    lines.push("静止画フレームは使わず、ノート情報だけでコーチングしてください。");
  }
  return lines.join("\n");
}

function toCoachResponse(parsed: Record<string, unknown>, input: CoachRequest, mode: CoachMode): CoachResponse {
  const insights =
    mode === "clip" ? toClipInsights(parsed) : toFreeInsights(parsed, input, mode);

  const hasVideo = Boolean(input.videoUrl);
  const kind =
    mode === "live"
      ? "live"
      : mode === "match-chunk" || mode === "match-merge"
        ? "match"
        : hasVideo
          ? "clip"
          : "notes";

  const response: CoachResponse = {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    headline: stringify(parsed.headline) || fallbackHeadline(input, kind),
    summary: stringify(parsed.summary) || fallbackSummary(input, kind),
    insights,
    kind,
  };
  if (typeof input.durationSec === "number" && Number.isFinite(input.durationSec)) {
    response.durationSec = input.durationSec;
  }
  if (mode === "match-chunk") {
    response.chunk = {
      startOffsetSec: input.startOffsetSec ?? 0,
      endOffsetSec: input.endOffsetSec ?? input.startOffsetSec ?? 0,
      index: input.chunkIndex,
      count: input.chunkCount,
    };
  }
  return response;
}

function toClipInsights(parsed: Record<string, unknown>): CoachInsight[] {
  const insightsRaw = Array.isArray(parsed.insights) ? parsed.insights : [];
  return CLIP_INSIGHT_IDS.map((id, index) => {
    const row = (insightsRaw[index] ?? findInsight(insightsRaw, id) ?? {}) as Record<string, unknown>;
    return {
      id,
      timestamp: stringify(row.timestamp) || undefined,
      title: stringify(row.title) || fallbackTitle(id),
      finding: stringify(row.finding) || "この項目の具体的な観察は得られませんでした。",
      action: stringify(row.action) || "次の試合で一つだけ意識して繰り返してください。",
    };
  });
}

function toFreeInsights(parsed: Record<string, unknown>, input: CoachRequest, mode: CoachMode): CoachInsight[] {
  const insightsRaw = Array.isArray(parsed.insights) ? parsed.insights : [];
  const start = input.startOffsetSec ?? 0;
  const end = input.endOffsetSec ?? start;
  const max = mode === "live" ? 4 : mode === "match-merge" ? 16 : 8;
  const insights: CoachInsight[] = [];
  for (let index = 0; index < insightsRaw.length && insights.length < max; index += 1) {
    const row = insightsRaw[index];
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const title = stringify(record.title);
    const finding = stringify(record.finding);
    const action = stringify(record.action);
    if (!title && !finding) continue;
    let timestamp = stringify(record.timestamp) || undefined;
    if (mode === "match-chunk") timestamp = shiftTimestamp(timestamp, start, end);
    if (mode === "live" && !timestamp) timestamp = "now";
    insights.push({
      id: stringify(record.id) || `scene-${index + 1}`,
      timestamp,
      title: title || `場面 ${index + 1}`,
      finding: finding || "この場面の具体的な観察は得られませんでした。",
      action: action || "次の数秒で一つだけ修正してください。",
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "observe",
      timestamp: mode === "live" ? "now" : formatTimestamp(start),
      title: "観察不足",
      finding: "この区間から具体的な指摘を組み立てられませんでした。",
      action: "同じ区間をもう一度送るか、撃ち合いが入ったクリップで再解析してください。",
    });
  }
  return insights;
}

function findInsight(rows: unknown[], id: string) {
  return rows.find((row) => {
    if (!row || typeof row !== "object") return false;
    return stringify((row as Record<string, unknown>).id) === id;
  });
}

function stringify(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackTitle(id: (typeof CLIP_INSIGHT_IDS)[number]) {
  if (id === "aim") return "エイム";
  if (id === "positioning") return "立ち回り";
  if (id === "abilities") return "スキル";
  return "練習";
}

function fallbackHeadline(input: CoachRequest, kind: CoachResponse["kind"]) {
  if (kind === "live") return `${input.character} ライブ · ${input.rank}`;
  if (kind === "match") return `${input.character} 試合一本 · ${input.rank}`;
  return `${input.character} コーチング · ${input.rank}`;
}

function fallbackSummary(input: CoachRequest, kind: CoachResponse["kind"]) {
  if (kind === "live") return `${input.rank}の${input.character}向けに、今の画面から次の動きを出します。`;
  if (kind === "match") return `${input.rank}の${input.character}の試合から、タイムスタンプ付きの指摘をまとめました。`;
  return `${input.rank}の${input.character}向けの改善ポイントです。`;
}

export const geminiCoachProvider: VideoCoachProvider = new GeminiVideoCoachProvider();
