import { languageInstruction, parseCoachLanguage, type CoachLanguage } from "../coach-language.ts";
import { COACHING_BAR } from "./bar.ts";
import type { CloseRangeFight, CoachInsight, CoachResponse, RotationNote, ViralScript } from "./types.ts";

export type ChatTurn = {
  role: "user" | "coach";
  text: string;
};

export type AnalysisChatSubject = {
  analysisId: string;
  game: string;
  rank: string;
  character: string;
  concern: string;
  headline: string;
  summary: string;
  rotationStory?: string;
  insights: CoachInsight[];
  closeRangeFights?: CloseRangeFight[];
  rotation?: RotationNote;
  viralScript?: ViralScript;
  kind?: string;
};

const MAX_TURNS = 8;
const MAX_TURN_CHARS = 800;

function clip(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function subjectFromShown(
  result: CoachResponse,
  extra: { rank: string; concern: string },
): AnalysisChatSubject {
  return {
    analysisId: result.analysisId,
    game: result.game,
    rank: extra.rank,
    character: result.character,
    concern: extra.concern,
    headline: result.headline,
    summary: result.summary,
    rotationStory: result.rotationStory,
    insights: result.insights,
    closeRangeFights: result.closeRangeFights,
    rotation: result.rotation,
    viralScript: result.viralScript,
    kind: result.kind,
  };
}

export function analysisJsonForPrompt(subject: AnalysisChatSubject) {
  return JSON.stringify({
    analysisId: clip(subject.analysisId, 80),
    game: clip(subject.game, 40),
    rank: clip(subject.rank, 80),
    character: clip(subject.character, 80),
    concern: clip(subject.concern, 240),
    kind: subject.kind ? clip(subject.kind, 20) : undefined,
    headline: clip(subject.headline, 400),
    summary: clip(subject.summary, 4000),
    rotationStory: subject.rotationStory ? clip(subject.rotationStory, 4000) : undefined,
    rotation: subject.rotation,
    insights: subject.insights.slice(0, 36).map((insight) => ({
      id: clip(insight.id, 80),
      tab: insight.tab,
      timestamp: insight.timestamp ? clip(insight.timestamp, 32) : undefined,
      title: clip(insight.title, 400),
      finding: clip(insight.finding, 2000),
      action: clip(insight.action, 2000),
    })),
    closeRangeFights: subject.closeRangeFights?.slice(0, 12).map((fight) => ({
      id: clip(fight.id, 80),
      start: clip(fight.start, 32),
      end: clip(fight.end, 32),
      title: clip(fight.title, 400),
      sightlines: clip(fight.sightlines, 2000),
      knowHow: clip(fight.knowHow, 2000),
    })),
    viralScript: subject.viralScript
      ? {
          video_title: clip(subject.viralScript.video_title, 200),
          ai_tsukkomi: clip(subject.viralScript.ai_tsukkomi, 200),
          cta_text: clip(subject.viralScript.cta_text, 200),
        }
      : undefined,
  });
}

export function analysisChatSystemPrompt(language: CoachLanguage, analysisJson: string) {
  return `${COACHING_BAR}
あなたはこの1本のVODについてだけ答える辛口コーチです。下の解析JSONが、この試合の保存済み事実です。JSONに無いキル、武器名、角度、時刻、間取りを足すな。勝敗だけで褒めたり責めたりしない。汎用スローガンは禁止。過程と期待値で、見えていた情報とより良い1手を言え。別の試合の話にずらすな。映像の再解析はしない。コーチングの水準は下げない。
返事は1〜4文。講義するな。口調は辛口で面白い。
${languageInstruction(language)}
reply に返事の本文だけを書く。
解析JSON:
${analysisJson}`;
}

export function chatContents(messages: ChatTurn[]) {
  const turns = messages
    .filter((turn) => turn.text.trim() && (turn.role === "user" || turn.role === "coach"))
    .slice(-MAX_TURNS);
  while (turns[0]?.role === "coach") turns.shift();
  return turns.map((turn) => ({
    role: turn.role === "coach" ? "model" : "user",
    parts: [{ text: clip(turn.text, MAX_TURN_CHARS) }],
  }));
}

export function replyFromModel(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const reply = (parsed as { reply?: unknown }).reply;
  if (typeof reply !== "string") return null;
  const text = reply.trim();
  if (!text) return null;
  return text.slice(0, 2000);
}

/** Used only when Gemini is mock or has no key. The words come from the saved analysis. */
export function groundedFallbackReply(subject: AnalysisChatSubject) {
  const insight = subject.insights.find((item) => item.finding.trim() || item.action.trim());
  if (insight) return [subject.headline, insight.finding, insight.action].filter(Boolean).join(" ");
  return [subject.headline, subject.summary].filter(Boolean).join(" ");
}

export function parseChatRequest(value: unknown): { subject: AnalysisChatSubject; language: CoachLanguage; messages: ChatTurn[] } | { error: string } {
  if (!value || typeof value !== "object") return { error: "bad" };
  const body = value as Record<string, unknown>;
  const analysis = body.analysis;
  if (!analysis || typeof analysis !== "object") return { error: "bad" };
  const row = analysis as Record<string, unknown>;
  if (typeof row.analysisId !== "string" || typeof row.headline !== "string" || typeof row.summary !== "string") {
    return { error: "bad" };
  }
  if (!Array.isArray(row.insights)) return { error: "bad" };
  const insights: CoachInsight[] = row.insights.slice(0, 36).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const insight = item as Record<string, unknown>;
    return [{
      id: typeof insight.id === "string" ? insight.id.slice(0, 80) : "insight",
      title: typeof insight.title === "string" ? insight.title.slice(0, 400) : "",
      finding: typeof insight.finding === "string" ? insight.finding.slice(0, 2000) : "",
      action: typeof insight.action === "string" ? insight.action.slice(0, 2000) : "",
      timestamp: typeof insight.timestamp === "string" ? insight.timestamp.slice(0, 32) : undefined,
      tab: insight.tab === "rotation" || insight.tab === "aim" || insight.tab === "abilities" || insight.tab === "endgame" || insight.tab === "other"
        ? insight.tab
        : undefined,
    }];
  });
  const subject: AnalysisChatSubject = {
    analysisId: row.analysisId.slice(0, 80),
    game: typeof row.game === "string" ? row.game.slice(0, 40) : "",
    rank: typeof row.rank === "string" ? row.rank.slice(0, 80) : "",
    character: typeof row.character === "string" ? row.character.slice(0, 80) : "",
    concern: typeof row.concern === "string" ? row.concern.slice(0, 240) : "",
    headline: row.headline.slice(0, 400),
    summary: row.summary.slice(0, 4000),
    insights,
  };
  if (typeof row.rotationStory === "string" && row.rotationStory.trim()) subject.rotationStory = row.rotationStory.slice(0, 4000);
  if (typeof row.kind === "string") subject.kind = row.kind.slice(0, 20);
  if (!Array.isArray(body.messages) || body.messages.length === 0) return { error: "bad" };
  const messages: ChatTurn[] = body.messages.slice(-MAX_TURNS).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const turn = item as Record<string, unknown>;
    if ((turn.role !== "user" && turn.role !== "coach") || typeof turn.text !== "string") return [];
    const text = turn.text.trim().slice(0, MAX_TURN_CHARS);
    if (!text) return [];
    return [{ role: turn.role, text }];
  });
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") return { error: "bad" };
  return { subject, language: parseCoachLanguage(body.language), messages };
}
