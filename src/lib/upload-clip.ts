"use client";

import { createMultipartUploader } from "@vercel/blob/client";
import { mapPool } from "@/lib/async-pool";
import { BLOB_TOKEN_MISSING, MAX_CLIP_BYTES } from "@/lib/blob";
import {
  BLOB_PART_CONCURRENCY,
  planBlobParts,
  uploadLoadedBytes,
  uploadPercentage,
} from "@/lib/blob-parts";
import {
  blobMpuPartHeaders,
  blobMpuUrl,
  readMpuPartEtag,
  xhrPostBlob,
} from "@/lib/blob-xhr";
import { normalizeCoachVideo } from "@/lib/video";
import {
  BLOB_UPLOAD_NETWORK_ERROR,
  BLOB_UPLOAD_STALL_ERROR,
  BLOB_UPLOAD_TOKEN_ATTEMPTS,
  isAbortish,
  mapUploadFailure,
  shouldRetryBlobToken,
  shouldStallUpload,
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

const PART_RETRIES = 3;

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
  let lastActivityAt = Date.now();
  let inFlight = 0;

  const stall = new AbortController();
  const combined = combineSignals(signal, stall.signal);
  const touch = () => {
    lastActivityAt = Date.now();
  };

  const timer = setInterval(() => {
    if (!shouldStallUpload({ lastActivityAt, inFlight: inFlight > 0, now: Date.now() })) return;
    stall.abort(new Error(BLOB_UPLOAD_STALL_ERROR));
  }, 1_000);

  const report = (loaded: number) => {
    onProgress?.({
      loaded,
      total: clip.size,
      percentage: uploadPercentage(loaded, clip.size),
    });
  };

  try {
    // Never pass clientToken or SDK onUploadProgress.
    // Progress comes from XHR (including !lengthComputable) and completed 5MB parts.
    const token = await mintClientToken(pathname, combined);
    touch();
    report(0);

    const uploader = await createMultipartUploader(pathname, {
      access: "public",
      token,
      contentType: clip.type,
      abortSignal: combined,
    });
    touch();

    const plans = planBlobParts(clip.size);
    const completed = new Map<number, number>();
    const inflight = new Map<number, number>();
    const emit = () => report(uploadLoadedBytes(completed, inflight));

    const uploaded = await mapPool(
      plans,
      BLOB_PART_CONCURRENCY,
      async (plan) => {
        const size = plan.end - plan.start;
        inFlight += 1;
        inflight.set(plan.partNumber, 0);
        touch();
        emit();
        try {
          const body = clip.slice(plan.start, plan.end, clip.type || "application/octet-stream");
          const text = await postPartWithRetry({
            pathname,
            token,
            key: uploader.key,
            uploadId: uploader.uploadId,
            partNumber: plan.partNumber,
            contentType: clip.type,
            body,
            signal: combined,
            onProgress: (loaded) => {
              inflight.set(plan.partNumber, Math.min(size, loaded));
              touch();
              emit();
            },
            onActivity: touch,
          });
          const etag = readMpuPartEtag(safeJson(text));
          if (!etag) throw new Error(BLOB_UPLOAD_NETWORK_ERROR);
          completed.set(plan.partNumber, size);
          inflight.delete(plan.partNumber);
          touch();
          emit();
          return { etag, partNumber: plan.partNumber };
        } catch (reason) {
          inflight.delete(plan.partNumber);
          throw reason;
        } finally {
          inFlight = Math.max(0, inFlight - 1);
        }
      },
      { signal: combined },
    );

    const blob = await uploader.complete(uploaded);
    report(clip.size);
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

async function mintClientToken(pathname: string, signal?: AbortSignal) {
  const mintedAt = Date.now();
  const response = await fetch(`/api/blob/upload?n=${mintedAt}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname,
        clientPayload: String(mintedAt),
        multipart: true,
      },
    }),
    signal,
  });
  let payload: { clientToken?: string; error?: string } = {};
  try {
    payload = (await response.json()) as { clientToken?: string; error?: string };
  } catch {
    payload = {};
  }
  if (!response.ok || !payload.clientToken) {
    throw new Error(payload.error || "Vercel Blob: Failed to retrieve the client token");
  }
  return payload.clientToken;
}

async function postPartWithRetry(input: {
  pathname: string;
  token: string;
  key: string;
  uploadId: string;
  partNumber: number;
  contentType?: string;
  body: Blob;
  signal?: AbortSignal;
  onProgress: (loaded: number) => void;
  onActivity: () => void;
}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= PART_RETRIES; attempt += 1) {
    throwIfAborted(input.signal);
    try {
      return await xhrPostBlob({
        url: blobMpuUrl(input.pathname),
        body: input.body,
        headers: blobMpuPartHeaders(input),
        signal: input.signal,
        onProgress: input.onProgress,
        onActivity: input.onActivity,
      });
    } catch (reason) {
      lastError = reason;
      if (input.signal?.aborted || isAbortish(reason)) throw reason;
      if (reason instanceof Error && reason.message === BLOB_UPLOAD_STALL_ERROR) throw reason;
      if (attempt >= PART_RETRIES || !isRetryablePartError(reason)) throw reason;
    }
  }
  throw lastError;
}

function isRetryablePartError(reason: unknown) {
  if (reason instanceof TypeError) return true;
  const text = reason instanceof Error ? reason.message : "";
  return /upload part failed \((0|408|425|429|500|502|503|504)\)/i.test(text);
}

function safeJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
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
