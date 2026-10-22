/** Idle (no in-flight part): fail only when nothing started or finished. */
export const BLOB_UPLOAD_STALL_MS = 80_000;

/** Hung in-flight part. 5MB at ~10KB/s still fits; part start/complete resets this. */
export const BLOB_UPLOAD_INFLIGHT_STALL_MS = 8 * 60 * 1000;

export const BLOB_UPLOAD_STALL_ERROR = "動画のアップロードが進まなくなりました。もう一度お試しください。";

export const BLOB_UPLOAD_NETWORK_ERROR = "動画のアップロードに失敗しました。もう一度お試しください。";

export const BLOB_UPLOAD_TOKEN_ATTEMPTS = 2;

export function isUploadStalled(
  lastProgressAt: number,
  now: number,
  stallMs = BLOB_UPLOAD_STALL_MS,
) {
  if (!Number.isFinite(lastProgressAt) || !Number.isFinite(now) || !Number.isFinite(stallMs)) {
    return false;
  }
  return now - lastProgressAt >= stallMs;
}

export function shouldStallUpload(state: {
  lastActivityAt: number;
  inFlight: boolean;
  now: number;
}) {
  const limit = state.inFlight ? BLOB_UPLOAD_INFLIGHT_STALL_MS : BLOB_UPLOAD_STALL_MS;
  return isUploadStalled(state.lastActivityAt, state.now, limit);
}

export function isBlobTokenError(reason: unknown) {
  const text = messageOf(reason);
  return /client token has expired|token has expired|token expired|failed to\s+(generate a client token|retrieve the client token)/i.test(text);
}

export function shouldRetryBlobToken(reason: unknown, attempt: number, maxAttempts = BLOB_UPLOAD_TOKEN_ATTEMPTS) {
  return attempt < maxAttempts && isBlobTokenError(reason);
}

export function mapUploadFailure(
  reason: unknown,
  options: { parent?: AbortSignal; stall?: AbortSignal } = {},
) {
  if (options.stall?.aborted) {
    return errorFromReason(options.stall.reason, BLOB_UPLOAD_STALL_ERROR);
  }
  if (options.parent?.aborted) {
    return errorFromReason(options.parent.reason, "解析を中断しました。");
  }
  if (reason instanceof Error && reason.message === BLOB_UPLOAD_STALL_ERROR) {
    return reason;
  }
  if (isAbortish(reason)) {
    return new Error(BLOB_UPLOAD_NETWORK_ERROR);
  }
  if (isBlobTokenError(reason) || isOpaqueBlobError(reason) || reason instanceof TypeError) {
    return new Error(BLOB_UPLOAD_NETWORK_ERROR);
  }
  if (reason instanceof Error && reason.message.trim()) {
    return reason;
  }
  return new Error(BLOB_UPLOAD_NETWORK_ERROR);
}

export function isAbortish(reason: unknown) {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { name?: string; code?: string };
  return error.name === "AbortError" || error.code === "ABORT_ERR";
}

function isOpaqueBlobError(reason: unknown) {
  return /vercel blob/i.test(messageOf(reason));
}

function errorFromReason(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message.trim()) return reason;
  if (typeof reason === "string" && reason.trim()) return new Error(reason);
  return new Error(fallback);
}

function messageOf(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "";
}
