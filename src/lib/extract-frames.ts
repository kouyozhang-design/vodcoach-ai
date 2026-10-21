"use client";

export type CoachFrame = {
  timestamp: number;
  mimeType: "image/jpeg";
  dataUrl: string;
};

const FRAME_COUNT = 4;
const MATCH_FRAME_COUNT = 6;
const MAX_WIDTH = 640;
const JPEG_QUALITY = 0.55;

/** Draw a few JPEGs from a video element or blob URL. Never uses <input type="file">. */
export async function extractJpegFrames(
  video: HTMLVideoElement | null,
  src?: string,
): Promise<CoachFrame[]> {
  return extractJpegFramesInRange(video, src, 0, undefined, FRAME_COUNT);
}

/** Sample JPEGs inside a time window (match chunks). Seeks; does not play in realtime. */
export async function extractJpegFramesInRange(
  video: HTMLVideoElement | null,
  src: string | undefined,
  startSec: number,
  endSec?: number,
  count = MATCH_FRAME_COUNT,
): Promise<CoachFrame[]> {
  const player = await readyPlayer(video, src);
  if (!player) return [];

  const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 1;
  const start = Math.max(0, startSec);
  const end = Math.min(duration, endSec == null || endSec <= start ? duration : endSec);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return [];

  const times = sampleTimesInRange(start, end, count);
  const frames: CoachFrame[] = [];

  try {
    for (const timestamp of times) {
      await seekTo(player, timestamp);
      const width = player.videoWidth || 640;
      const height = player.videoHeight || 360;
      const scale = Math.min(1, MAX_WIDTH / width);
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.drawImage(player, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      if (dataUrl.startsWith("data:image/jpeg")) {
        frames.push({ timestamp, mimeType: "image/jpeg", dataUrl });
      }
    }
  } finally {
    if (player !== video) {
      player.removeAttribute("src");
      player.load();
      player.remove();
    }
  }

  return frames;
}

function sampleTimesInRange(start: number, end: number, count: number) {
  const span = Math.max(0.2, end - start);
  if (count <= 1) return [start + span / 2];
  return Array.from({ length: count }, (_, index) => {
    const t = start + span * ((index + 1) / (count + 1));
    return Math.min(end - 0.05, Math.max(start + 0.05, t));
  });
}

async function readyPlayer(video: HTMLVideoElement | null, src?: string) {
  if (video && video.readyState >= 1 && (video.videoWidth > 0 || Number.isFinite(video.duration))) {
    return video;
  }
  const url = src || video?.currentSrc || video?.src;
  if (!url) return null;
  const player = document.createElement("video");
  player.muted = true;
  player.playsInline = true;
  player.preload = "auto";
  player.src = url;
  await waitEvent(player, "loadeddata");
  return player;
}

const SEEK_TIMEOUT_MS = 8_000;
const LOAD_TIMEOUT_MS = 12_000;

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("フレームを抽出できませんでした。"));
    }, SEEK_TIMEOUT_MS);
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("フレームを抽出できませんでした。"));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = time;
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("フレームを抽出できませんでした。"));
    }
  });
}

function waitEvent(video: HTMLVideoElement, eventName: "loadeddata" | "loadedmetadata") {
  if (eventName === "loadeddata" && video.readyState >= 2) return Promise.resolve();
  if (eventName === "loadedmetadata" && video.readyState >= 1) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("動画を読み込めませんでした。"));
    }, LOAD_TIMEOUT_MS);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("動画を読み込めませんでした。"));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onReady);
    video.addEventListener("error", onError);
  });
}
