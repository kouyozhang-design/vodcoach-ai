import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { BLOB_TOKEN_MISSING, hasBlobToken, MAX_CLIP_BYTES } from "@/lib/blob";

export const runtime = "nodejs";

export async function GET() {
  if (!hasBlobToken()) {
    return NextResponse.json({ configured: false, error: BLOB_TOKEN_MISSING }, { status: 503 });
  }
  return NextResponse.json({ configured: true });
}

export async function POST(request: Request) {
  if (!hasBlobToken()) {
    return NextResponse.json({ error: BLOB_TOKEN_MISSING }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "アップロード要求の形式が正しくありません。" }, { status: 400 });
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
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch {
    return NextResponse.json({ error: "動画のアップロードに失敗しました。" }, { status: 400 });
  }
}
