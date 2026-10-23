import { normalizeCoachText } from "./bar.ts";
import { spokenLineForCue } from "../live-speech.ts";
import type { CoachInsight, CoachResponse, LiveSpeakMoment } from "./types.ts";

export const LIVE_RECENT_LIMIT = 4;

export function cueFingerprint(insight: Pick<CoachInsight, "title" | "finding" | "action">) {
  return normalizeCoachText(`${insight.title}${insight.finding}${insight.action}`);
}

export function cueLabel(insight: Pick<CoachInsight, "title" | "finding">) {
  return `${insight.title}: ${insight.finding}`.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function insightsFingerprint(insights: CoachInsight[]) {
  return insights.map(cueFingerprint).filter(Boolean).join("|");
}

function tokenSet(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s　、。・,.!！?？/／]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

export function isNearDuplicate(left: string, right: string) {
  const a = normalizeCoachText(left);
  const b = normalizeCoachText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const A = tokenSet(left);
  const B = tokenSet(right);
  if (A.size === 0 || B.size === 0) return false;
  let overlap = 0;
  for (const token of A) {
    if (B.has(token)) overlap += 1;
  }
  return overlap / Math.min(A.size, B.size) >= 0.72;
}

export function isRepeatCue(insights: CoachInsight[], recentFingerprints: string[], spokenLine = "") {
  const prints: string[] = [];
  if (spokenLine) prints.push(normalizeCoachText(spokenLine));
  prints.push(insightsFingerprint(insights));
  for (const insight of insights) prints.push(cueFingerprint(insight));
  const next = prints.filter(Boolean);
  if (next.length === 0 || recentFingerprints.length === 0) return false;
  return next.some((print) => recentFingerprints.some((previous) => isNearDuplicate(previous, print)));
}

export function rememberCues(
  recentFingerprints: string[],
  insights: CoachInsight[],
  spokenLine = "",
) {
  const next = [...recentFingerprints];
  const extras = [spokenLine ? normalizeCoachText(spokenLine) : "", ...insights.map(cueFingerprint)].filter(Boolean);
  for (const print of extras) {
    const index = next.findIndex((item) => isNearDuplicate(item, print));
    if (index >= 0) next.splice(index, 1);
    next.push(print);
  }
  return next.slice(-LIVE_RECENT_LIMIT);
}

export function recentCueLabels(insights: CoachInsight[], spokenLine = "") {
  const labels = spokenLine ? [spokenLine.replace(/\s+/g, " ").trim().slice(0, 160)] : [];
  for (const insight of insights) {
    const label = cueLabel(insight);
    if (label) labels.push(label);
  }
  return labels.filter(Boolean).slice(0, LIVE_RECENT_LIMIT);
}

export type LiveCueDecision = {
  speak: boolean;
  reason: "speak" | "model-skip" | "empty" | "repeat" | "lecture";
  spokenLine?: string;
  speakMoment?: LiveSpeakMoment;
};

export function decideLiveCue(response: CoachResponse, recentFingerprints: string[]): LiveCueDecision {
  if (response.shouldSpeak === false) return { speak: false, reason: "model-skip" };
  const spokenLine = spokenLineForCue(response);
  const hasInsight = response.insights.length > 0;
  if (!spokenLine && !hasInsight) return { speak: false, reason: "empty" };
  if (!spokenLine && hasInsight && response.speakMoment === "mid-fight") {
    return { speak: false, reason: "lecture" };
  }
  if (!spokenLine) return { speak: false, reason: "empty" };
  if (isRepeatCue(response.insights, recentFingerprints, spokenLine)) {
    return { speak: false, reason: "repeat" };
  }
  return {
    speak: true,
    reason: "speak",
    spokenLine,
    speakMoment: response.speakMoment,
  };
}
