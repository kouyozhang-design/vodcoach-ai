import { get, head, issueSignedToken, presignUrl } from "@vercel/blob";
import { blobPathnameFromUrl, isPrivateBlobUrl } from "@/lib/blob";

const SIGNED_GET_MS = 2 * 60 * 60 * 1000;

/** Gemini fetches file_uri itself, so private blobs need a time-limited GET URL. */
export async function readableVideoUrl(videoUrl: string) {
  if (!isPrivateBlobUrl(videoUrl)) return videoUrl;
  const pathname = blobPathnameFromUrl(videoUrl);
  const signed = await issueSignedToken({
    pathname,
    operations: ["get", "head"],
    validUntil: Date.now() + SIGNED_GET_MS,
  });
  const { presignedUrl } = await presignUrl(
    {
      delegationToken: signed.delegationToken,
      clientSigningToken: signed.clientSigningToken,
    },
    { access: "private", operation: "get", pathname },
  );
  return presignedUrl;
}

export async function sniffPrivateVideo(videoUrl: string) {
  const meta = await head(videoUrl);
  return {
    mimeType: (meta.contentType || "").split(";")[0].trim(),
    size: meta.size,
  };
}

export async function readPrivateVideoBytes(videoUrl: string) {
  const result = await get(videoUrl, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const bytes = await new Response(result.stream).arrayBuffer();
  const mimeType = (result.blob.contentType || "").split(";")[0].trim();
  return { bytes, mimeType, size: result.blob.size };
}
