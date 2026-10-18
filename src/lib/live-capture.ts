"use client";

export const LIVE_INTERVAL_MS = 7000;
export const LIVE_JPEG_QUALITY = 0.52;
export const LIVE_MAX_WIDTH = 960;

export function canCaptureDisplay() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export async function startDisplayCapture(): Promise<MediaStream> {
  if (!canCaptureDisplay()) {
    throw new LiveCaptureError(
      "unsupported",
      "このブラウザでは画面共有が使えません。PCの Chrome または Edge で開いてください。スマホではライブコーチは使えません。",
    );
  }
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 8, max: 15 },
        width: { max: 1280 },
        height: { max: 720 },
      },
      audio: false,
    });
  } catch (error) {
    throw mapCaptureError(error);
  }
}

export function grabJpegFrame(video: HTMLVideoElement, maxWidth = LIVE_MAX_WIDTH, quality = LIVE_JPEG_QUALITY) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl.startsWith("data:image/jpeg") ? dataUrl : null;
}

export function isCanvasMostlyBlack(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) return false;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 16) {
    sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    count += 1;
  }
  return count > 0 && sum / count < 14;
}

export function liveCaptureErrorMessage(error: unknown) {
  if (error instanceof LiveCaptureError) return error.message;
  return mapCaptureError(error).message;
}

export class LiveCaptureError extends Error {
  constructor(
    readonly code: "denied" | "unsupported" | "ended" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "LiveCaptureError";
  }
}

function mapCaptureError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new LiveCaptureError(
      "denied",
      "画面共有が拒否されました。ブラウザの許可を出したあと、ゲームのウィンドウまたは画面を選んで再試行してください。",
    );
  }
  if (name === "NotFoundError" || name === "NotReadableError") {
    return new LiveCaptureError(
      "unknown",
      "共有できる画面が見つかりませんでした。ゲームをウィンドウ表示またはボーダーレスにしてから、もう一度開始してください。フルスクリーン専有のままだと選べないことがあります。",
    );
  }
  if (name === "AbortError") {
    return new LiveCaptureError("denied", "画面共有がキャンセルされました。");
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return new LiveCaptureError(
      "unsupported",
      "このブラウザでは画面共有が使えません。PCの Chrome または Edge で開いてください。",
    );
  }
  return new LiveCaptureError(
    "unknown",
    "画面共有を開始できませんでした。チート対策（VALORANTのVanguardなど）がキャプチャを拒んでいる可能性もあります。",
  );
}
