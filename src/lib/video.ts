const VIDEO_EXT = /\.(mp4|m4v|mov|qt|webm)$/i;
const BLOCKED_EXT = /\.(png|jpe?g|gif|webp|heic|heif|bmp|pdf|txt|zip)$/i;

export function isAllowedCoachVideo(file: { name?: string; type?: string }) {
  const type = (file.type ?? "").trim().toLowerCase().split(";")[0];
  const name = file.name ?? "";
  if (BLOCKED_EXT.test(name) || type.startsWith("image/") || type.startsWith("audio/")) return false;
  if (VIDEO_EXT.test(name)) return true;
  if (type.startsWith("video/")) return true;
  // iPhone/Safari: empty type, or octet-stream, often with IMG_*.MOV or no extension.
  if (!type || type === "application/octet-stream") return true;
  return false;
}

export function mimeFromFileName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov") || lower.endsWith(".qt")) return "video/quicktime";
  return "";
}

export function normalizeCoachVideo(file: File) {
  const name = file.name?.trim() || "clip.mov";
  const type = file.type?.trim() || mimeFromFileName(name) || "video/quicktime";
  if (type === file.type && name === file.name) return file;
  return new File([file], name, { type, lastModified: file.lastModified });
}
