import { speechLocale, type CoachLanguage } from "./coach-language.ts";
import type { CoachInsight, CoachResponse, LiveNextMove, LiveSpeakMoment } from "./coach/types.ts";
import { LIVE_NEXT_MOVES, LIVE_SPEAK_MOMENTS } from "./coach/types.ts";

/** Mid-fight talk must stay a spray call, not a lecture. */
export const MID_FIGHT_MAX_CHARS = 42;
/** Post-fight / standoff can be a bit longer, still TTS-short. */
export const LIVE_SPOKEN_MAX_CHARS = 96;

export function parseSpeakMoment(value: unknown): LiveSpeakMoment | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim() as LiveSpeakMoment;
  return (LIVE_SPEAK_MOMENTS as readonly string[]).includes(trimmed) ? trimmed : undefined;
}

export function parseNextMove(value: unknown): LiveNextMove | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim() as LiveNextMove;
  return (LIVE_NEXT_MOVES as readonly string[]).includes(trimmed) ? trimmed : undefined;
}

export function looksLikeSurveyBeacon(text: string) {
  return /調査ビーコン|survey\s*beacon|recon|スキャン/i.test(text);
}

export function spokenLineUsesScan(line: string) {
  const hasEnemy = /敵|スキャン|ビーコン|ピン|位置|隊|enemy|scan|beacon|squad/i.test(line);
  const hasZone = /アンチ|ゾーン|リング|zone|ring/i.test(line);
  const hasTime = /残り|秒|分|left|sec|min/i.test(line);
  const hasMove = /ローテ|回転|待て|ホールド|漁夫|第三者|切れ|離脱|セット|構え|押し|拡張|rotate|hold|third|disengage|setup|push/i.test(line);
  return hasEnemy && hasZone && hasTime && hasMove;
}

export function sentenceCount(text: string) {
  return text
    .split(/[。．.!?！？]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export function clampSpokenLine(text: string, maxChars = LIVE_SPOKEN_MAX_CHARS) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  const cut = compact.slice(0, maxChars);
  const stop = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("、"), cut.lastIndexOf(" "));
  return (stop >= 12 ? cut.slice(0, stop) : cut).trim();
}

export function composeSpokenLine(input: {
  spokenLine?: string;
  insights?: Pick<CoachInsight, "title" | "action">[];
}) {
  const direct = input.spokenLine?.replace(/\s+/g, " ").trim();
  if (direct) return clampSpokenLine(direct);
  const first = input.insights?.[0];
  if (!first) return "";
  const fallback = [first.title, first.action].filter(Boolean).join("。");
  return clampSpokenLine(fallback);
}

export function isMidFightLecture(moment: LiveSpeakMoment | undefined, line: string) {
  if (moment !== "mid-fight") return false;
  const compact = line.replace(/\s+/g, " ").trim();
  return compact.length > MID_FIGHT_MAX_CHARS || sentenceCount(compact) > 2;
}

export function spokenLineForCue(response: Pick<CoachResponse, "spokenLine" | "insights" | "speakMoment">) {
  const line = composeSpokenLine(response);
  if (!line) return "";
  if (isMidFightLecture(response.speakMoment, line)) return "";
  if (response.speakMoment === "mid-fight") return clampSpokenLine(line, MID_FIGHT_MAX_CHARS);
  return line;
}

type SpeechSynth = {
  speaking: boolean;
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
};

function synth(): SpeechSynth | null {
  if (typeof window === "undefined") return null;
  const api = window.speechSynthesis;
  return api ?? null;
}

export function canUseSpeech() {
  return Boolean(synth() && typeof SpeechSynthesisUtterance !== "undefined");
}

export function pickJapaneseVoice(voices: Array<Pick<SpeechSynthesisVoice, "lang" | "name">>) {
  const ja = voices.filter((voice) => /^ja\b/i.test(voice.lang));
  return (
    ja.find((voice) => /google|kyoko|otoya|nanami|haruka|sayaka/i.test(voice.name)) ??
    ja[0] ??
    null
  );
}

export function pickEnglishVoice(voices: Array<Pick<SpeechSynthesisVoice, "lang" | "name">>) {
  const en = voices.filter((voice) => /^en\b/i.test(voice.lang));
  return (
    en.find((voice) => /google|samantha|daniel|alex|siri|aria|jenny/i.test(voice.name)) ??
    en.find((voice) => /^en-US\b/i.test(voice.lang)) ??
    en[0] ??
    null
  );
}

export function pickVoiceForLanguage(
  voices: Array<Pick<SpeechSynthesisVoice, "lang" | "name">>,
  language: CoachLanguage,
) {
  return language === "en" ? pickEnglishVoice(voices) : pickJapaneseVoice(voices);
}

/** Browsers block TTS until a click/tap. Call this in the same gesture as 画面共有. */
export function unlockSpeech(language: CoachLanguage = "ja") {
  const api = synth();
  if (!api || typeof SpeechSynthesisUtterance === "undefined") return false;
  try {
    api.cancel();
    const warm = new SpeechSynthesisUtterance(language === "en" ? "." : "。");
    warm.lang = speechLocale(language);
    warm.volume = 0.01;
    warm.rate = 2;
    const voice = pickVoiceForLanguage(api.getVoices(), language);
    if (voice) warm.voice = voice as SpeechSynthesisVoice;
    api.speak(warm);
    api.cancel();
    return true;
  } catch {
    return false;
  }
}

export function cancelSpeech() {
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}

export function speakCoachLine(
  text: string,
  language: CoachLanguage,
  handlers: { onstart?: () => void; onend?: () => void; onerror?: () => void } = {},
) {
  const api = synth();
  const line = text.replace(/\s+/g, " ").trim();
  if (!api || !line || typeof SpeechSynthesisUtterance === "undefined") {
    handlers.onerror?.();
    return false;
  }
  try {
    api.cancel();
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.lang = speechLocale(language);
    utterance.rate = 1.08;
    utterance.pitch = 0.95;
    const voice = pickVoiceForLanguage(api.getVoices(), language);
    if (voice) utterance.voice = voice as SpeechSynthesisVoice;
    utterance.onstart = () => handlers.onstart?.();
    utterance.onend = () => handlers.onend?.();
    utterance.onerror = () => handlers.onerror?.();
    api.speak(utterance);
    return true;
  } catch {
    handlers.onerror?.();
    return false;
  }
}

export function speakJapanese(
  text: string,
  handlers: { onstart?: () => void; onend?: () => void; onerror?: () => void } = {},
) {
  return speakCoachLine(text, "ja", handlers);
}
