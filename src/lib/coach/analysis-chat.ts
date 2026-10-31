import type { CoachLanguage } from "../coach-language.ts";
import {
  analysisChatSystemPrompt,
  analysisJsonForPrompt,
  chatContents,
  groundedFallbackReply,
  replyFromModel,
  type AnalysisChatSubject,
  type ChatTurn,
} from "./analysis-chat-prompt.ts";

/** Same model as clip, match, and live. No second provider. */
export const ANALYSIS_CHAT_MODEL = "gemini-3.8-flash";

const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${ANALYSIS_CHAT_MODEL}:generateContent`;

export async function answerAnalysisChat(input: {
  subject: AnalysisChatSubject;
  language: CoachLanguage;
  messages: ChatTurn[];
}) {
  const providerName = (process.env.COACH_PROVIDER ?? "").trim().toLowerCase();
  const key = process.env.GEMINI_API_KEY?.trim();
  if (providerName === "mock" || !key) return groundedFallbackReply(input.subject);
  const analysisJson = analysisJsonForPrompt(input.subject);
  const reply = await requestGeminiReply(key, analysisChatSystemPrompt(input.language, analysisJson), input.messages);
  return reply;
}

async function requestGeminiReply(apiKey: string, system: string, messages: ChatTurn[]) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: chatContents(messages),
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 600,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: { reply: { type: "string" } },
        required: ["reply"],
      },
    },
  });

  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(GENERATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
      signal: AbortSignal.timeout(48_000),
    });
    lastStatus = response.status;
    if ((response.status === 429 || response.status === 503) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      continue;
    }
    if (!response.ok) throw new Error("chat_failed");
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const reply = replyFromModel(raw);
    if (!reply) throw new Error("chat_failed");
    return reply;
  }
  throw new Error(lastStatus === 429 || lastStatus === 503 ? "chat_failed" : "chat_failed");
}
