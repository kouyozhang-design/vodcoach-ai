"use client";

export type CoachFrame = {
  timestamp: number;
  mimeType: "image/jpeg";
  dataUrl: string;
};

const FRAME_COUNT = 4;
const MAX_WIDTH = 640;
const JPEG_QUALITY = 0.55;

/** Draw a few JPEGs from a video element or blob URL. Never uses <input type="file">. */
export async function extractJpegFrames(
  video: HTMLVideoElement | null,
  src?: string,
): Promise<CoachFrame[]> {
  const player = await readyPlayer(video, src);
  if (!player) return [];

  const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 1;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return [];

  const times = sampleTimes(duration, FRAME_COUNT);
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

function sampleTimes(duration: number, count: number) {
  if (count <= 1) return [Math.min(0.1, duration / 2)];
  return Array.from({ length: count }, (_, index) => {
    const t = duration * ((index + 1) / (count + 1));
    return Math.min(duration - 0.05, Math.max(0.05, t));
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

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("フレームを抽出できませんでした。"));
    };
    const cleanup = () => {
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
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("動画を読み込めませんでした。"));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onReady);
    video.addEventListener("error", onError);
  });
}
