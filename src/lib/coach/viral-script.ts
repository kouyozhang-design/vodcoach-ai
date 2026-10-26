import type { CoachLanguage } from "../coach-language.ts";
import { SHARE_APP_URL } from "../share-tweet.ts";
import type { GameId } from "../games.ts";
import type { ViralScript } from "./types.ts";

export type { ViralScript };

export const TSUKKOMI_MAX_CHARS = 100;
export const TITLE_MAX_CHARS = 40;
export const CTA_MAX_CHARS = 80;

export function charLength(value: string) {
  return [...value].length;
}

export function clampChars(value: string, max: number) {
  return [...value.trim()].slice(0, max).join("");
}

const CTA_BY_LANGUAGE: Record<CoachLanguage, (host: string) => string> = {
  ja: (host) => `自分のVODもVODCoach.AIで刺せ → ${host}`,
  en: (host) => `Roast your VOD on VODCoach.AI → ${host}`,
  pt: (host) => `Assa seu VOD no VODCoach.AI → ${host}`,
  ko: (host) => `네 VOD도 VODCoach.AI에서 찔러 봐 → ${host}`,
  de: (host) => `Roast dein VOD auf VODCoach.AI → ${host}`,
  fr: (host) => `Fais rôtir ton VOD sur VODCoach.AI → ${host}`,
  es: (host) => `Asa tu VOD en VODCoach.AI → ${host}`,
  pl: (host) => `Przypiekaj VOD na VODCoach.AI → ${host}`,
  "zh-TW": (host) => `用 VODCoach.AI 刺自己的 VOD → ${host}`,
  tr: (host) => `VOD’unu VODCoach.AI’de közle → ${host}`,
  it: (host) => `Arrosto il VOD su VODCoach.AI → ${host}`,
  id: (host) => `Panggang VOD-mu di VODCoach.AI → ${host}`,
};

export function defaultCta(language: CoachLanguage) {
  const host = SHARE_APP_URL.replace(/^https:\/\//, "");
  return CTA_BY_LANGUAGE[language](host);
}

/** Apex only. Empty title or tsukkomi means the footage did not support a callout. */
export function parseViralScript(
  value: unknown,
  game: GameId,
  language: CoachLanguage,
): ViralScript | undefined {
  if (game !== "apex-legends") return undefined;
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const video_title = clampChars(typeof row.video_title === "string" ? row.video_title : "", TITLE_MAX_CHARS);
  const ai_tsukkomi = clampChars(typeof row.ai_tsukkomi === "string" ? row.ai_tsukkomi : "", TSUKKOMI_MAX_CHARS);
  if (!video_title || !ai_tsukkomi) return undefined;
  const cta = clampChars(typeof row.cta_text === "string" ? row.cta_text : "", CTA_MAX_CHARS);
  return {
    video_title,
    ai_tsukkomi,
    cta_text: cta || defaultCta(language),
  };
}

export function formatViralScriptCopy(script: ViralScript) {
  return [script.video_title, script.ai_tsukkomi, script.cta_text].join("\n");
}
