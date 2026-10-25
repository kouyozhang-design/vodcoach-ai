import { isPrivateBlobUrl } from "@/lib/blob";
import { readableVideoUrl, readPrivateVideoBytes, sniffPrivateVideo } from "@/lib/blob-read";
import { formatTimestamp } from "@/lib/match-plan";
import { mimeFromFileName } from "@/lib/video";
import { resolveCoachLanguage, type CoachLanguage } from "../coach-language";
import { spokenLineForCue, parseNextMove, parseSpeakMoment } from "../live-speech";
import { pickApexPoiFromParsed, serializeApexPoi } from "./apex-poi";
import { resolveCloseRangeFights } from "./fight-detail";
import { parseViralScript } from "./viral-script";
import { insightsFromParsed } from "./insight-tabs";
import { buildUserText, systemPrompt } from "./prompts";
import { parseRotation } from "./rotation";
import {
  INSIGHT_TAB_IDS,
  LIVE_NEXT_MOVES,
  LIVE_SPEAK_MOMENTS,
  ROTATION_INTENTS,
  resolveCoachMode,
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
    const language = resolveCoachLanguage(input);
    const userText = buildUserText(input, mode, hasVideo, frames.length > 0);

    let parsed: Record<string, unknown>;
    if (mode === "match-merge") {
      parsed = await generateCoachJson(key, [{ text: userText }], mode, language);
    } else if (hasVideo && videoUrl) {
      parsed = await analyzeVideo(key, videoUrl, userText, input, mode, frames);
    } else if (frames.length > 0) {
      parsed = await generateCoachJson(key, [{ text: userText }, ...imageParts(frames)], mode, language);
    } else {
      parsed = await generateCoachJson(key, [{ text: userText }], mode, language);
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
  const fileUri = await readableVideoUrl(videoUrl);
  const urlPart = videoFilePart(fileUri, mimeType, range);
  const allowFilesApi = mode === "clip" && !input.segmentOnly;
  const extras = frames && frames.length > 0 ? imageParts(frames) : [];

  const tryUrl = size === undefined || size <= EXTERNAL_URL_MAX_BYTES || mode !== "clip";
  if (tryUrl) {
    try {
      // Blob URL path: video only. JPEG backups stay off this request so HUD/legend reads stay on the clip.
      return await generateCoachJson(apiKey, [{ text: userText }, urlPart], mode, resolveCoachLanguage(input));
    } catch (error) {
      if (error instanceof CoachProviderError && (error.kind === "parse" || error.kind === "rate-limit")) {
        throw error;
      }
      const canFallback = error instanceof CoachProviderError ? error.kind === "http" : true;
      if (!canFallback) throw error;
      if (extras.length > 0) {
        return generateCoachJson(apiKey, [{ text: userText }, ...extras], mode, resolveCoachLanguage(input));
      }
      if (!allowFilesApi) throw error;
    }
  }

  if (!allowFilesApi) {
    if (extras.length > 0) return generateCoachJson(apiKey, [{ text: userText }, ...extras], mode, resolveCoachLanguage(input));
    throw new CoachProviderError(CONNECT_ERROR, "http");
  }

  const uploaded = await uploadBlobToGeminiFiles(apiKey, videoUrl, mimeType);
  const filePart = videoFilePart(uploaded.uri, uploaded.mimeType || mimeType, range);
  return generateCoachJson(apiKey, [{ text: userText }, filePart], mode, resolveCoachLanguage(input));
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

async function generateCoachJson(apiKey: string, parts: GeminiPart[], mode: CoachMode, language: CoachLanguage) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt(mode, language) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: mode === "live" ? 0.25 : 0.35,
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
  let bytes: ArrayBuffer;
  let resolvedMime = mimeType || "video/mp4";
  if (isPrivateBlobUrl(videoUrl)) {
    const privateFile = await readPrivateVideoBytes(videoUrl);
    if (!privateFile) throw new CoachProviderError(CONNECT_ERROR, "http");
    bytes = privateFile.bytes;
    resolvedMime = privateFile.mimeType || resolvedMime;
  } else {
    const videoResponse = await fetch(videoUrl, { method: "GET", redirect: "follow" });
    if (!videoResponse.ok) throw new CoachProviderError(CONNECT_ERROR, "http");
    bytes = await videoResponse.arrayBuffer();
    resolvedMime = headerMime(videoResponse.headers.get("content-type")) || resolvedMime;
  }

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
    if (isPrivateBlobUrl(videoUrl)) {
      const meta = await sniffPrivateVideo(videoUrl);
      return {
        mimeType: headerMime(meta.mimeType) || fromName,
        size: meta.size > 0 ? meta.size : undefined,
      };
    }
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


function schemaFor(mode: CoachMode) {
  const insightProperties = {
    id: { type: "STRING" },
    tab: { type: "STRING", enum: [...INSIGHT_TAB_IDS] },
    timestamp: { type: "STRING" },
    title: { type: "STRING" },
    finding: { type: "STRING" },
    action: { type: "STRING" },
  };
  const properties: Record<string, unknown> = {
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
  };
  const required = ["headline", "summary", "insights"];
  if (mode === "live") {
    properties.shouldSpeak = { type: "BOOLEAN" };
    properties.skipReason = { type: "STRING" };
    properties.spokenLine = { type: "STRING" };
    properties.speakMoment = { type: "STRING", enum: [...LIVE_SPEAK_MOMENTS] };
    properties.usedScan = { type: "BOOLEAN" };
    properties.nextMove = { type: "STRING", enum: [...LIVE_NEXT_MOVES] };
    required.push("shouldSpeak");
  }
  if (mode === "match-chunk") {
    properties.rotation = {
      type: "OBJECT",
      properties: {
        intent: { type: "STRING", enum: [...ROTATION_INTENTS] },
        ring: { type: "STRING" },
        path: { type: "STRING" },
        thirdPartyTiming: { type: "STRING" },
        note: { type: "STRING" },
      },
    };
    required.push("rotation");
  }
  if (mode === "match-merge") {
    properties.rotationStory = { type: "STRING" };
    required.push("rotationStory");
  }
  properties.mapPoi = {
    type: "OBJECT",
    properties: {
      map: { type: "STRING" },
      poi: { type: "STRING" },
    },
  };
  if (mode !== "live") {
    properties.closeRangeFights = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          start: { type: "STRING" },
          end: { type: "STRING" },
          title: { type: "STRING" },
          sightlines: { type: "STRING" },
          knowHow: { type: "STRING" },
        },
        required: ["start", "title", "sightlines", "knowHow"],
      },
    };
    required.push("closeRangeFights");
  }
  if (mode === "clip" || mode === "match-merge") {
    properties.viralScript = {
      type: "OBJECT",
      properties: {
        video_title: { type: "STRING" },
        ai_tsukkomi: { type: "STRING" },
        cta_text: { type: "STRING" },
      },
      required: ["video_title", "ai_tsukkomi", "cta_text"],
    };
    required.push("viralScript");
  }
  return {
    type: "OBJECT",
    properties,
    required,
  };
}

function toCoachResponse(parsed: Record<string, unknown>, input: CoachRequest, mode: CoachMode): CoachResponse {
  const insights = insightsFromParsed(parsed, input, mode);

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
    summary: stringify(parsed.summary) || fallbackSummary(input, kind, insights.length),
    insights,
    kind,
  };
  const fights = resolveCloseRangeFights(parsed, input, mode);
  if (fights.length > 0) response.closeRangeFights = fights;
  if (mode === "clip" || mode === "match-merge") {
    const script = parseViralScript(parsed.viralScript, input.game, resolveCoachLanguage(input));
    if (script) response.viralScript = script;
  }
  const mapPoi = serializeApexPoi(pickApexPoiFromParsed(parsed, input));
  if (mapPoi) response.mapPoi = mapPoi;
  if (mode === "live") {
    const speakMoment = parseSpeakMoment(parsed.speakMoment);
    if (speakMoment) response.speakMoment = speakMoment;
    const nextMove = parseNextMove(parsed.nextMove);
    if (nextMove) response.nextMove = nextMove;
    if (parsed.usedScan === true) response.usedScan = true;
    if (parsed.usedScan === false) response.usedScan = false;
    response.spokenLine = stringify(parsed.spokenLine);
    const spoken = spokenLineForCue(response);
    const explicitSkip = parsed.shouldSpeak === false;
    response.shouldSpeak = !explicitSkip && Boolean(spoken);
    const skipReason = stringify(parsed.skipReason);
    if (!response.shouldSpeak) {
      response.skipReason = skipReason || (insights.length === 0 && !spoken ? "指摘すべき局面なし" : "繰り返し");
      response.insights = [];
      response.spokenLine = "";
      delete response.speakMoment;
    } else {
      response.spokenLine = spoken;
    }
  }
  if (typeof input.durationSec === "number" && Number.isFinite(input.durationSec)) {
    response.durationSec = input.durationSec;
  }
  if (mode === "match-chunk") {
    const rotation = parseRotation(parsed.rotation);
    if (rotation) response.rotation = rotation;
    response.chunk = {
      startOffsetSec: input.startOffsetSec ?? 0,
      endOffsetSec: input.endOffsetSec ?? input.startOffsetSec ?? 0,
      index: input.chunkIndex,
      count: input.chunkCount,
    };
  }
  if (mode === "match-merge") {
    const story = stringify(parsed.rotationStory);
    if (story) response.rotationStory = story;
  }
  return response;
}

function stringify(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackHeadline(input: CoachRequest, kind: CoachResponse["kind"]) {
  if (kind === "live") return `${input.character} ライブ · ${input.rank}`;
  if (kind === "match") return `${input.character} 試合一本 · ${input.rank}`;
  return `${input.character} コーチング · ${input.rank}`;
}

function fallbackSummary(input: CoachRequest, kind: CoachResponse["kind"], insightCount = 0) {
  const who = `${input.rank}の${input.character}`;
  if (kind === "live") {
    return insightCount > 0
      ? `${who}向けに、戦闘後か膠着のときだけ声で次の1手を出します。`
      : `${who}の画面を注視中。戦闘後と膠着だけ話します。`;
  }
  if (kind === "match") {
    return insightCount > 0
      ? `${who}の試合から、過程と期待値で見たタイムスタンプ付きの指摘です。`
      : `${who}のこの試合から、指摘すべき局面はありませんでした。`;
  }
  return `${who}向けに、悩みと根拠から過程の改善点を整理しました。`;
}

export const geminiCoachProvider: VideoCoachProvider = new GeminiVideoCoachProvider();
