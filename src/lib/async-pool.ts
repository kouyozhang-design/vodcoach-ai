/** Bounded parallel mapper. Used so match-chunk Gemini calls do not stampede rate limits. */

export type MapPoolOptions = {
  /** Delay before worker i starts, i * staggerMs. Softens a burst of POSTs. */
  staggerMs?: number;
};

export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  options: MapPoolOptions = {},
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;

  const parsed = Math.floor(concurrency);
  const limit = Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : 1, items.length));
  const staggerMs = Math.max(0, options.staggerMs ?? 0);
  let cursor = 0;

  async function worker(workerIndex: number) {
    if (staggerMs > 0 && workerIndex > 0) {
      await new Promise((resolve) => setTimeout(resolve, staggerMs * workerIndex));
    }
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, (_, workerIndex) => worker(workerIndex)));
  return results;
}
