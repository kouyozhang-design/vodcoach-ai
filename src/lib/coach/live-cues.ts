import { normalizeCoachText } from "./bar.ts";
import type { CoachInsight, CoachResponse } from "./types.ts";

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

export function isRepeatCue(insights: CoachInsight[], recentFingerprints: string[]) {
  if (insights.length === 0 || recentFingerprints.length === 0) return false;
  const nextPrint = insightsFingerprint(insights);
  if (recentFingerprints.some((previous) => isNearDuplicate(previous, nextPrint))) return true;
  return insights.some((insight) => {
    const print = cueFingerprint(insight);
    return recentFingerprints.some((previous) => isNearDuplicate(previous, print));
  });
}

export function rememberCues(recentFingerprints: string[], insights: CoachInsight[]) {
  const next = [...recentFingerprints];
  for (const insight of insights) {
    const print = cueFingerprint(insight);
    if (!print) continue;
    const index = next.findIndex((item) => isNearDuplicate(item, print));
    if (index >= 0) next.splice(index, 1);
    next.push(print);
  }
  return next.slice(-LIVE_RECENT_LIMIT);
}

export function recentCueLabels(insights: CoachInsight[]) {
  return insights.map(cueLabel).filter(Boolean).slice(0, LIVE_RECENT_LIMIT);
}

export type LiveCueDecision = {
  speak: boolean;
  reason: "speak" | "model-skip" | "empty" | "repeat";
};

export function decideLiveCue(response: CoachResponse, recentFingerprints: string[]): LiveCueDecision {
  if (response.shouldSpeak === false) return { speak: false, reason: "model-skip" };
  if (response.insights.length === 0) return { speak: false, reason: "empty" };
  if (isRepeatCue(response.insights, recentFingerprints)) return { speak: false, reason: "repeat" };
  return { speak: true, reason: "speak" };
}
