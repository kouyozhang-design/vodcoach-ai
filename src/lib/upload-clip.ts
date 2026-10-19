"use client";

import { upload } from "@vercel/blob/client";
import { BLOB_TOKEN_MISSING, MAX_CLIP_BYTES } from "@/lib/blob";
import { normalizeCoachVideo } from "@/lib/video";

type BlobStatus = { configured: boolean; error?: string };

export async function uploadClipToBlob(file: File): Promise<string> {
  if (file.size > MAX_CLIP_BYTES) {
    throw new Error("動画は80MB以下にしてください。");
  }

  const status = await readBlobStatus();
  if (!status.configured) {
    throw new Error(status.error || BLOB_TOKEN_MISSING);
  }

  const clip = normalizeCoachVideo(file);
  const pathname = `coach-clips/${safeName(clip.name)}`;
  const mintedAt = Date.now();
  // Never pass clientToken — each upload must mint a fresh handleUpload JWT.
  const blob = await upload(pathname, clip, {
    access: "public",
    handleUploadUrl: `/api/blob/upload?n=${mintedAt}`,
    multipart: true,
    clientPayload: String(mintedAt),
  });
  return blob.url;
}

async function readBlobStatus(): Promise<BlobStatus> {
  try {
    const response = await fetch(`/api/blob/upload?n=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
    const payload = (await response.json()) as BlobStatus & { error?: string };
    if (!response.ok) {
      return { configured: false, error: payload.error || BLOB_TOKEN_MISSING };
    }
    return { configured: Boolean(payload.configured), error: payload.error };
  } catch {
    return { configured: false, error: BLOB_TOKEN_MISSING };
  }
}

function safeName(name: string) {
  const trimmed = name.trim() || "clip.mp4";
  const cleaned = trimmed.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  return cleaned || "clip.mp4";
}
