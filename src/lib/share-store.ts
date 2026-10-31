import { get, put } from "@vercel/blob";
import { hasBlobToken } from "./blob.ts";
import { normalizeShareId, parseShareSnapshot, shareBlobPath, type ShareSnapshot } from "./share-snapshot.ts";

/** Writes one immutable private JSON blob. Does not touch IndexedDB. */
export async function writeShareSnapshot(snapshot: ShareSnapshot) {
  if (!hasBlobToken() || !normalizeShareId(snapshot.id)) return false;
  await put(shareBlobPath(snapshot.id), JSON.stringify(snapshot), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  return true;
}

export async function readShareSnapshot(id: string): Promise<ShareSnapshot | null> {
  const shareId = normalizeShareId(id);
  if (!shareId || !hasBlobToken()) return null;
  try {
    const result = await get(shareBlobPath(shareId), { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    const snapshot = parseShareSnapshot(text);
    if (!snapshot || snapshot.id !== shareId) return null;
    return snapshot;
  } catch {
    return null;
  }
}
