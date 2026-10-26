import {
  languageInstruction,
  speechLocale,
  spokenLanguageLine,
  type CoachLanguage,
} from "../coach-language.ts";
import { alignBundle, bundleFromUnknown, type CoachTextBundle, type TranslateRequest } from "./coach-text.ts";

/** Same model as match and live analysis. Translation never uploads video. */
export const TRANSLATE_MODEL = "gemini-3.8-flash";

const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TRANSLATE_MODEL}:generateContent`;

export function translateSystemPrompt(language: CoachLanguage) {
  return `You translate an existing coaching JSON into the selected language. You do not watch video, you do not re-analyze, and you do not add facts, times, weapons, or moments that are not already in the source.
${languageInstruction(language)}
${spokenLanguageLine(language)}
Keep the same number of insights and close-range fights, in the same order. Keep ids. JSON keys stay English.
headline, summary, rotationStory, spokenLine, insight title/finding/action, closeRangeFights title/sightlines/knowHow, and viralScript video_title/ai_tsukkomi/cta_text are the only strings you rewrite.
ai_tsukkomi stays at most 100 characters. spokenLine is what ${speechLocale(language)} text-to-speech will read. Short and sharp. No tabs.
If the source is already in the target language, return it unchanged.`;
}

export async function translateCoachBundle(request: TranslateRequest): Promise<CoachTextBundle> {
  if (request.sourceLanguage && request.sourceLanguage === request.language) return request.bundle;
  const providerName = (process.env.COACH_PROVIDER ?? "").trim().toLowerCase();
  const key = process.env.GEMINI_API_KEY?.trim();
  if (providerName === "mock" || !key) return request.bundle;
  const translated = await requestGeminiTranslation(key, request.language, request.bundle);
  return alignBundle(request.bundle, translated);
}

async function requestGeminiTranslation(apiKey: string, language: CoachLanguage, bundle: CoachTextBundle) {
  const response = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: translateSystemPrompt(language) }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(bundle) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(48_000),
  });
  if (!response.ok) throw new Error("translate_failed");
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const parsed = bundleFromUnknown(JSON.parse(raw));
  if (!parsed) throw new Error("translate_failed");
  return parsed;
}
