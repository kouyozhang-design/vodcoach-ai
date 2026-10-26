import { NextResponse } from "next/server";
import { parseTranslateRequest } from "@/lib/coach/coach-text";
import { translateCoachBundle } from "@/lib/coach/translate-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "翻訳は既存の文章だけを受け取ります。動画は送りません。" },
      { status: 400 },
    );
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSONの形式が正しくありません。" }, { status: 400 });
  }
  const parsed = parseTranslateRequest(json);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const bundle = await translateCoachBundle(parsed);
    return NextResponse.json({ bundle });
  } catch {
    return NextResponse.json({ error: "translate_failed" }, { status: 502 });
  }
}
