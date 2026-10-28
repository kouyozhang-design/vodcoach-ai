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
  pending?: boolean;
  paused?: boolean;
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  pause?: () => void;
  resume?: () => void;
  addEventListener?: (type: "voiceschanged", listener: () => void) => void;
};

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesHooked = false;
let speakGeneration = 0;
let keepAliveId: number | undefined;

/** Chrome applies cancel() asynchronously and drops a speak() in that same turn. */
export const SPEAK_AFTER_CANCEL_MS = 100;
const START_WATCHDOG_MS = 1500;
const KEEPALIVE_MS = 10_000;

export type SpeechEngineState = {
  speaking: boolean;
  pending: boolean;
  paused: boolean;
};

export type SpeechStep =
  | { op: "resume" }
  | { op: "cancel" }
  | { op: "speak"; when: "now" | "later" };

/** Screen-share unlock must speak inside the gesture. A busy engine speaks on the next turn. */
export function planSpeech(state: SpeechEngineState, purpose: "unlock" | "line"): SpeechStep[] {
  if (purpose === "unlock") {
    const steps: SpeechStep[] = [];
    if (state.paused) steps.push({ op: "resume" });
    steps.push({ op: "speak", when: "now" });
    return steps;
  }
  if (state.speaking || state.pending) {
    return [{ op: "cancel" }, { op: "speak", when: "later" }];
  }
  if (state.paused) return [{ op: "resume" }, { op: "speak", when: "now" }];
  return [{ op: "speak", when: "now" }];
}

/** Chrome stalls the engine after ~15s. Nudge only while a line is queued or the engine is paused. */
export function planKeepAlive(state: { speaking: boolean; pending?: boolean; paused: boolean }): Array<"pause" | "resume"> {
  if (state.speaking || state.pending) return ["pause", "resume"];
  if (state.paused) return ["resume"];
  return [];
}

export function runSpeechPlan(
  api: { resume?: () => void; cancel: () => void },
  steps: SpeechStep[],
  speak: () => void,
  later: (speak: () => void) => void,
) {
  for (const step of steps) {
    if (step.op === "resume") {
      try {
        api.resume?.();
      } catch {
        /* ignore */
      }
    } else if (step.op === "cancel") {
      api.cancel();
    } else if (step.when === "now") {
      speak();
    } else {
      later(speak);
    }
  }
}

/** Replacing a line cancels the previous utterance. That is not a failure once it had started. */
export function speechErrorIgnored(code: string | undefined, started: boolean) {
  if (!started) return false;
  return code === "interrupted" || code === "canceled";
}

/** Same-turn cancel drops the new utterance before onstart. Retry it. */
export function speechErrorDropped(code: string | undefined) {
  return code === "interrupted" || code === "canceled";
}

/** A bad voice match should fall through to utterance.lang, not stay silent. */
export function speechErrorRetriesWithoutVoice(code: string | undefined) {
  return (
    code === "voice-unavailable" ||
    code === "language-unavailable" ||
    code === "network" ||
    code === "synthesis-failed" ||
    code === "synthesis-unavailable"
  );
}

function synth(): SpeechSynth | null {
  if (typeof window === "undefined") return null;
  const api = window.speechSynthesis;
  return api ?? null;
}

export function canUseSpeech() {
  return Boolean(synth() && typeof SpeechSynthesisUtterance !== "undefined");
}

export function pickJapaneseVoice(voices: Array<Pick<SpeechSynthesisVoice, "lang" | "name">>) {
  const ja = voices.filter((voice) => /^ja\b/i.test(voice.lang.replace(/_/g, "-")));
  return (
    ja.find((voice) => /google|kyoko|otoya|nanami|haruka|sayaka/i.test(voice.name)) ??
    ja[0] ??
    null
  );
}

export function pickEnglishVoice(voices: Array<Pick<SpeechSynthesisVoice, "lang" | "name">>) {
  const en = voices.filter((voice) => /^en\b/i.test(voice.lang.replace(/_/g, "-")));
  return (
    en.find((voice) => /google|samantha|daniel|alex|siri|aria|jenny/i.test(voice.name)) ??
    en.find((voice) => /^en-us\b/i.test(voice.lang.replace(/_/g, "-"))) ??
    en[0] ??
    null
  );
}

function voiceLang(lang: string) {
  return lang.toLowerCase().replace(/_/g, "-");
}

/** Exact locale, then the same language, then Traditional Chinese before Simplified. */
export function pickVoiceForLanguage(
  voices: Array<Pick<SpeechSynthesisVoice, "lang" | "name">>,
  language: CoachLanguage,
) {
  if (language === "en") return pickEnglishVoice(voices);
  if (language === "ja") return pickJapaneseVoice(voices);
  const wanted = voiceLang(speechLocale(language));
  const prefix = language === "zh-TW" ? "zh" : wanted.slice(0, 2);
  const ranked = voices
    .map((voice) => ({ voice, score: scoreVoice(voice, language, wanted, prefix) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.voice ?? null;
}

function scoreVoice(
  voice: Pick<SpeechSynthesisVoice, "lang" | "name">,
  language: CoachLanguage,
  wanted: string,
  prefix: string,
) {
  const lang = voiceLang(voice.lang);
  let score = 0;
  if (lang === wanted) score += 100;
  else if (lang.startsWith(`${wanted}-`)) score += 90;
  else if (language === "zh-TW" && (lang.includes("hant") || lang.startsWith("zh-tw"))) score += 80;
  else if (lang.startsWith(prefix)) score += language === "zh-TW" && lang.startsWith("zh-cn") ? 10 : 50;
  if (score === 0) return 0;
  if (/google|siri|premium|natural/i.test(voice.name)) score += 5;
  return score;
}

function engineOf(api: SpeechSynth): SpeechEngineState {
  return {
    speaking: Boolean(api.speaking),
    pending: Boolean(api.pending),
    paused: Boolean(api.paused),
  };
}

function currentVoices(api: SpeechSynth) {
  try {
    const fresh = api.getVoices() ?? [];
    if (fresh.length > 0) cachedVoices = fresh.slice();
  } catch {
    /* ignore */
  }
  return cachedVoices;
}

export function primeSpeechVoices() {
  const api = synth();
  if (!api) return;
  currentVoices(api);
  if (voicesHooked || typeof api.addEventListener !== "function") return;
  voicesHooked = true;
  try {
    api.addEventListener("voiceschanged", () => {
      currentVoices(api);
    });
  } catch {
    voicesHooked = false;
  }
}

function nudge(api: SpeechSynth) {
  const steps = planKeepAlive({
    speaking: Boolean(api.speaking),
    pending: Boolean(api.pending),
    paused: Boolean(api.paused),
  });
  for (const step of steps) {
    try {
      if (step === "pause") api.pause?.();
      else api.resume?.();
    } catch {
      /* ignore */
    }
  }
}

function ensureKeepAlive() {
  if (typeof window === "undefined" || keepAliveId !== undefined) return;
  keepAliveId = window.setInterval(() => {
    const api = synth();
    if (!api) return;
    nudge(api);
  }, KEEPALIVE_MS);
}

function stopKeepAlive() {
  if (keepAliveId === undefined || typeof window === "undefined") return;
  window.clearInterval(keepAliveId);
  keepAliveId = undefined;
}

function resumeEngine(api: SpeechSynth) {
  try {
    api.resume?.();
  } catch {
    /* ignore */
  }
}

function assignVoice(
  utterance: SpeechSynthesisUtterance,
  api: SpeechSynth,
  language: CoachLanguage,
  allowVoice: boolean,
) {
  utterance.lang = speechLocale(language);
  if (!allowVoice) return;
  const voice = pickVoiceForLanguage(currentVoices(api), language);
  if (voice) utterance.voice = voice as SpeechSynthesisVoice;
}

/** Browsers block TTS until a click/tap. Call this in the same gesture as 画面共有. */
export function unlockSpeech(language: CoachLanguage = "ja") {
  const api = synth();
  if (!api || typeof SpeechSynthesisUtterance === "undefined") return false;
  speakGeneration += 1;
  primeSpeechVoices();
  try {
    const steps = planSpeech(engineOf(api), "unlock");
    runSpeechPlan(
      api,
      steps,
      () => {
        const warm = new SpeechSynthesisUtterance(language === "ja" ? "あ" : "a");
        warm.volume = 0.01;
        warm.rate = 1;
        assignVoice(warm, api, language, true);
        resumeEngine(api);
        api.speak(warm);
      },
      (speak) => {
        speak();
      },
    );
    ensureKeepAlive();
    return true;
  } catch {
    return false;
  }
}

export function cancelSpeech() {
  speakGeneration += 1;
  stopKeepAlive();
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
  const generation = ++speakGeneration;
  primeSpeechVoices();
  ensureKeepAlive();
  let retried = false;
  let failed = false;

  const speakOnce = (allowVoice: boolean) => {
    if (generation !== speakGeneration) return;
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 1.08;
    utterance.pitch = 0.95;
    assignVoice(utterance, api, language, allowVoice);
    let started = false;
    utterance.onstart = () => {
      started = true;
      if (generation === speakGeneration) handlers.onstart?.();
    };
    utterance.onend = () => {
      if (generation === speakGeneration) handlers.onend?.();
    };
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      if (generation !== speakGeneration) return;
      const code = event.error;
      if (speechErrorIgnored(code, started)) return;
      if (!started && speechErrorDropped(code)) return;
      if (!retried && speechErrorRetriesWithoutVoice(code)) {
        retried = true;
        window.setTimeout(() => speakOnce(false), SPEAK_AFTER_CANCEL_MS);
        return;
      }
      failed = true;
      handlers.onerror?.();
    };
    try {
      resumeEngine(api);
      api.speak(utterance);
    } catch {
      failed = true;
      handlers.onerror?.();
      return;
    }
    window.setTimeout(() => {
      if (generation !== speakGeneration || started || failed) return;
      if (api.speaking || api.pending) {
        nudge(api);
        return;
      }
      if (retried) return;
      retried = true;
      window.setTimeout(() => speakOnce(allowVoice), SPEAK_AFTER_CANCEL_MS);
    }, START_WATCHDOG_MS);
  };

  try {
    const steps = planSpeech(engineOf(api), "line");
    runSpeechPlan(
      api,
      steps,
      () => speakOnce(true),
      (speak) => {
        window.setTimeout(speak, SPEAK_AFTER_CANCEL_MS);
      },
    );
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
