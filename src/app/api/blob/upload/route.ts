import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  BLOB_TOKEN_MISSING,
  CLIENT_UPLOAD_TOKEN_MS,
  hasBlobToken,
  MAX_CLIP_BYTES,
} from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

function json(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status, headers: NO_STORE_HEADERS });
}

export async function GET() {
  if (!hasBlobToken()) {
    return json({ configured: false, error: BLOB_TOKEN_MISSING }, { status: 503 });
  }
  return json({ configured: true });
}

export async function POST(request: Request) {
  if (!hasBlobToken()) {
    return json({ error: BLOB_TOKEN_MISSING }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json({ error: "アップロード要求の形式が正しくありません。" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "video/mp4",
          "video/quicktime",
          "video/x-m4v",
          "video/webm",
          "video/hevc",
          "application/octet-stream",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: MAX_CLIP_BYTES,
        validUntil: Date.now() + CLIENT_UPLOAD_TOKEN_MS,
      }),
    });
    return json(jsonResponse);
  } catch {
    return json({ error: "動画のアップロードに失敗しました。" }, { status: 400 });
  }
}
