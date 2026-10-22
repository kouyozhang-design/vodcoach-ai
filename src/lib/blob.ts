export const BLOB_TOKEN_MISSING =
  "動画の保存用トークン（BLOB_READ_WRITE_TOKEN）が設定されていません。Vercel の Environment Variables に追加してください。";

export const MAX_CLIP_BYTES = 80 * 1024 * 1024;

/** Live store `vodcoach-ai-blob` is private. `access: "public"` is rejected. */
export const BLOB_ACCESS = "private" as const;

export function isPrivateBlobUrl(url: string) {
  try {
    return new URL(url).hostname.includes(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function blobPathnameFromUrl(url: string) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  return pathname.replace(/^\//, "");
}

/** Client-upload JWT lifetime. Default is too short for large match VODs. */
export const CLIENT_UPLOAD_TOKEN_MS = 6 * 60 * 60 * 1000;

export function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}
