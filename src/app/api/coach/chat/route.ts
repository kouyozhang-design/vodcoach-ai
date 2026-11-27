import { NextResponse } from "next/server";
import { answerAnalysisChat } from "@/lib/coach/analysis-chat";
import { parseChatRequest } from "@/lib/coach/analysis-chat-prompt";
import { gatePaidCaller } from "@/lib/paid-route-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await gatePaidCaller("coach-chat", 20, 60, 10 * 60 * 1000);
  if (denied) return denied;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "bad" }, { status: 400 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "bad" }, { status: 400 });
  }
  const parsed = parseChatRequest(json);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const reply = await answerAnalysisChat(parsed);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "chat_failed" }, { status: 502 });
  }
}
