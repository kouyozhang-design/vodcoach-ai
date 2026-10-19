export const BLOB_TOKEN_MISSING =
  "動画の保存用トークン（BLOB_READ_WRITE_TOKEN）が設定されていません。Vercel の Environment Variables に追加してください。";

export const MAX_CLIP_BYTES = 80 * 1024 * 1024;

/** Client-upload JWT lifetime. Default is too short for large match VODs. */
export const CLIENT_UPLOAD_TOKEN_MS = 6 * 60 * 60 * 1000;

export function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}
