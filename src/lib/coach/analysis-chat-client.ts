import type { CoachLanguage } from "../coach-language.ts";
import type { AnalysisChatSubject, ChatTurn } from "./analysis-chat-prompt.ts";

export async function requestAnalysisChat(input: {
  analysis: AnalysisChatSubject;
  language: CoachLanguage;
  messages: ChatTurn[];
}) {
  const response = await fetch("/api/coach/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      analysis: input.analysis,
      language: input.language,
      messages: input.messages,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { reply?: unknown; error?: unknown } | null;
  if (!response.ok || !payload || typeof payload.reply !== "string" || !payload.reply.trim()) {
    throw new Error("chat_failed");
  }
  return payload.reply.trim();
}
