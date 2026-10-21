"use client";

import { upload } from "@vercel/blob/client";
import { BLOB_TOKEN_MISSING, MAX_CLIP_BYTES } from "@/lib/blob";
import { normalizeCoachVideo } from "@/lib/video";

type BlobStatus = { configured: boolean; error?: string };

const BLOB_UPLOAD_TIMEOUT_MS = 90_000;
const BLOB_UPLOAD_TIMEOUT_ERROR = "動画のアップロードが時間内に終わりませんでした。もう一度お試しください。";

export async function uploadClipToBlob(file: File, signal?: AbortSignal): Promise<string> {
  if (file.size > MAX_CLIP_BYTES) {
    throw new Error("動画は80MB以下にしてください。");
  }
  if (signal?.aborted) {
    throw new Error(BLOB_UPLOAD_TIMEOUT_ERROR);
  }

  const status = await readBlobStatus(signal);
  if (!status.configured) {
    throw new Error(status.error || BLOB_TOKEN_MISSING);
  }

  const clip = normalizeCoachVideo(file);
  const pathname = `coach-clips/${safeName(clip.name)}`;
  const mintedAt = Date.now();
  // Never pass clientToken — each upload must mint a fresh handleUpload JWT.
  const blob = await withAbort(
    upload(pathname, clip, {
      access: "public",
      handleUploadUrl: `/api/blob/upload?n=${mintedAt}`,
      multipart: true,
      clientPayload: String(mintedAt),
    }),
    signal,
    BLOB_UPLOAD_TIMEOUT_MS,
    BLOB_UPLOAD_TIMEOUT_ERROR,
  );
  return blob.url;
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
    if (signal?.aborted) throw new Error(BLOB_UPLOAD_TIMEOUT_ERROR);
    if (reason instanceof Error && reason.name === "AbortError") {
      throw new Error(BLOB_UPLOAD_TIMEOUT_ERROR);
    }
    return { configured: false, error: BLOB_TOKEN_MISSING };
  }
}

function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(message));
      return;
    }
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error(message));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function safeName(name: string) {
  const trimmed = name.trim() || "clip.mp4";
  const cleaned = trimmed.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  return cleaned || "clip.mp4";
}
