/** Bounded parallel mapper. Used so match-chunk Gemini calls do not stampede rate limits. */

export type MapPoolOptions = {
  /** Delay before worker i starts, i * staggerMs. Softens a burst of POSTs. */
  staggerMs?: number;
  /** Stop claiming new items when aborted. In-flight mappers still settle. */
  signal?: AbortSignal;
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
  const signal = options.signal;
  let cursor = 0;

  async function worker(workerIndex: number) {
    if (signal?.aborted) throw abortFrom(signal);
    if (staggerMs > 0 && workerIndex > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, staggerMs * workerIndex);
        const onAbort = () => {
          clearTimeout(timer);
          reject(abortFrom(signal));
        };
        if (signal) signal.addEventListener("abort", onAbort, { once: true });
      });
    }
    while (true) {
      if (signal?.aborted) throw abortFrom(signal);
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, (_, workerIndex) => worker(workerIndex)));
  return results;
}

function abortFrom(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}
