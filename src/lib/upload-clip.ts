"use client";

import { upload } from "@vercel/blob/client";
import { BLOB_TOKEN_MISSING, MAX_CLIP_BYTES } from "@/lib/blob";
import { normalizeCoachVideo } from "@/lib/video";
import {
  BLOB_UPLOAD_NETWORK_ERROR,
  BLOB_UPLOAD_STALL_ERROR,
  BLOB_UPLOAD_STALL_MS,
  BLOB_UPLOAD_TOKEN_ATTEMPTS,
  isAbortish,
  isUploadStalled,
  mapUploadFailure,
  shouldRetryBlobToken,
} from "@/lib/upload-stall";

type BlobStatus = { configured: boolean; error?: string };

export type UploadClipProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

export type UploadClipOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: UploadClipProgress) => void;
};

export async function uploadClipToBlob(
  file: File,
  options: UploadClipOptions = {},
): Promise<string> {
  const { signal, onProgress } = options;

  if (file.size > MAX_CLIP_BYTES) {
    throw new Error("動画は80MB以下にしてください。");
  }
  throwIfAborted(signal);

  const status = await readBlobStatus(signal);
  if (!status.configured) {
    throw new Error(status.error || BLOB_TOKEN_MISSING);
  }

  const clip = normalizeCoachVideo(file);
  const pathname = `coach-clips/${safeName(clip.name)}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= BLOB_UPLOAD_TOKEN_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await uploadOnce(pathname, clip, { signal, onProgress });
    } catch (reason) {
      lastError = reason;
      if (reason instanceof Error && reason.message === BLOB_UPLOAD_STALL_ERROR) {
        throw reason;
      }
      if (signal?.aborted) {
        throw mapUploadFailure(reason, { parent: signal });
      }
      if (shouldRetryBlobToken(reason, attempt)) {
        continue;
      }
      throw mapUploadFailure(reason, { parent: signal });
    }
  }
  throw mapUploadFailure(lastError);
}

async function uploadOnce(
  pathname: string,
  clip: File,
  options: UploadClipOptions,
): Promise<string> {
  const { signal, onProgress } = options;
  const mintedAt = Date.now();
  let lastLoaded = -1;
  let lastPercentage = -1;
  let lastProgressAt = Date.now();

  const stall = new AbortController();
  const combined = combineSignals(signal, stall.signal);

  const timer = setInterval(() => {
    if (!isUploadStalled(lastProgressAt, Date.now(), BLOB_UPLOAD_STALL_MS)) return;
    stall.abort(new Error(BLOB_UPLOAD_STALL_ERROR));
  }, 1_000);

  try {
    // Never pass clientToken — each attempt must mint a fresh handleUpload JWT.
    const blob = await upload(pathname, clip, {
      access: "public",
      handleUploadUrl: `/api/blob/upload?n=${mintedAt}`,
      multipart: true,
      clientPayload: String(mintedAt),
      abortSignal: combined,
      onUploadProgress({ loaded, total, percentage }) {
        if (loaded > lastLoaded || percentage > lastPercentage) {
          lastLoaded = loaded;
          lastPercentage = percentage;
          lastProgressAt = Date.now();
        }
        onProgress?.({ loaded, total, percentage });
      },
    });
    return blob.url;
  } catch (reason) {
    if (stall.signal.aborted || signal?.aborted) {
      throw mapUploadFailure(reason, { parent: signal, stall: stall.signal });
    }
    throw reason;
  } finally {
    clearInterval(timer);
  }
}

async function readBlobStatus(signal?: AbortSignal): Promise<BlobStatus> {
  try {
    const response = await fetch(`/api/blob/upload?n=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
      signal,
    });
    const payload = (await response.json()) as BlobStatus & { error?: string };
    if (!response.ok) {
      return { configured: false, error: payload.error || BLOB_TOKEN_MISSING };
    }
    return { configured: Boolean(payload.configured), error: payload.error };
  } catch (reason) {
    throwIfAborted(signal, reason);
    return { configured: false, error: BLOB_TOKEN_MISSING };
  }
}

function throwIfAborted(signal?: AbortSignal, reason?: unknown): void {
  if (signal?.aborted || isAbortish(reason)) {
    throw mapUploadFailure(reason, { parent: signal });
  }
}

function combineSignals(parent?: AbortSignal, stall?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => {
    if (controller.signal.aborted) return;
    const reason = stall?.aborted
      ? stall.reason
      : parent?.aborted
        ? parent.reason
        : new Error(BLOB_UPLOAD_NETWORK_ERROR);
    controller.abort(reason);
  };
  if (parent?.aborted || stall?.aborted) {
    abort();
    return controller.signal;
  }
  parent?.addEventListener("abort", abort, { once: true });
  stall?.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function safeName(name: string) {
  const trimmed = name.trim() || "clip.mp4";
  const cleaned = trimmed.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  return cleaned || "clip.mp4";
}
