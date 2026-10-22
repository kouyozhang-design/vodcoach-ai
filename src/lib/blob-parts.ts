/** Vercel Blob MPU minimum (except the last part). Smaller slices = real UI steps on Safari. */
export const BLOB_PART_BYTES = 5 * 1024 * 1024;

export const BLOB_PART_CONCURRENCY = 2;

export type BlobPartPlan = {
  partNumber: number;
  start: number;
  end: number;
};

export function planBlobParts(size: number, partBytes = BLOB_PART_BYTES): BlobPartPlan[] {
  if (!Number.isFinite(size) || size <= 0) return [];
  const chunk = Math.max(1, Math.floor(partBytes));
  const parts: BlobPartPlan[] = [];
  let start = 0;
  let partNumber = 1;
  while (start < size) {
    const end = Math.min(start + chunk, size);
    parts.push({ partNumber, start, end });
    start = end;
    partNumber += 1;
  }
  return parts;
}

export function uploadLoadedBytes(
  completed: ReadonlyMap<number, number>,
  inflight: ReadonlyMap<number, number>,
) {
  let loaded = 0;
  for (const value of completed.values()) loaded += value;
  for (const value of inflight.values()) loaded += value;
  return loaded;
}

export function uploadPercentage(loaded: number, total: number) {
  if (!Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (loaded / total) * 100));
}
