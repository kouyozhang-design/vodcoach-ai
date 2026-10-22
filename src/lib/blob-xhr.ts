/** XHR upload that counts bytes even when Safari CORS sets lengthComputable=false. */

export const BLOB_API_URL = "https://vercel.com/api/blob";
export const BLOB_API_VERSION = "13";

export type XhrProgressEventLike = {
  loaded?: number;
  lengthComputable?: boolean;
};

export function xhrUploadLoaded(event: XhrProgressEventLike) {
  const loaded = event.loaded;
  if (typeof loaded !== "number" || !Number.isFinite(loaded) || loaded < 0) return 0;
  return loaded;
}

export function storeIdFromClientToken(token: string) {
  const parts = token.split("_");
  return parts[3] || "";
}

export function blobMpuUrl(pathname: string) {
  const params = new URLSearchParams({ pathname });
  return `${BLOB_API_URL}/mpu?${params.toString()}`;
}

export function blobMpuPartHeaders(input: {
  token: string;
  key: string;
  uploadId: string;
  partNumber: number;
  contentType?: string;
}) {
  const storeId = storeIdFromClientToken(input.token);
  const requestId = `${storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${input.token}`,
    "x-api-version": BLOB_API_VERSION,
    "x-api-blob-request-id": requestId,
    "x-api-blob-request-attempt": "0",
    "x-vercel-blob-store-id": storeId,
    "x-vercel-blob-access": "public",
    "x-mpu-action": "upload",
    "x-mpu-key": encodeURIComponent(input.key),
    "x-mpu-upload-id": input.uploadId,
    "x-mpu-part-number": String(input.partNumber),
  };
  if (input.contentType) headers["x-content-type"] = input.contentType;
  return headers;
}

export function readMpuPartEtag(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const etag = (payload as { etag?: unknown }).etag;
  return typeof etag === "string" ? etag : "";
}

export async function xhrPostBlob(options: {
  url: string;
  body: Blob;
  headers: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (loaded: number) => void;
  onActivity?: () => void;
}): Promise<string> {
  const { url, body, headers, signal, onProgress, onActivity } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.responseType = "text";

    let settled = false;
    const succeed = (text: string) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve(text);
    };
    const fail = (reason: unknown) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(reason);
    };

    const onAbort = () => {
      xhr.abort();
    };

    xhr.upload.addEventListener("loadstart", () => {
      onActivity?.();
    });
    xhr.upload.addEventListener("progress", (event) => {
      const loaded = xhrUploadLoaded(event);
      onActivity?.();
      onProgress?.(loaded);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        succeed(xhr.responseText ?? "");
        return;
      }
      fail(new Error(`Vercel Blob: upload part failed (${xhr.status})`));
    });
    xhr.addEventListener("error", () => {
      fail(new TypeError("Network request failed"));
    });
    xhr.addEventListener("timeout", () => {
      fail(new TypeError("Network request timed out"));
    });
    xhr.addEventListener("abort", () => {
      fail(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    });

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    if (signal) {
      if (signal.aborted) {
        onAbort();
        fail(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.send(body);
  });
}
