export const BLOB_TOKEN_MISSING =
  "動画の保存用トークン（BLOB_READ_WRITE_TOKEN）が設定されていません。Vercel の Environment Variables に追加してください。";

export const MAX_CLIP_BYTES = 80 * 1024 * 1024;

export function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}
