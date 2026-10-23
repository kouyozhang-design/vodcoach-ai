import { looksLikeSlogan, normalizeCoachText } from "./bar.ts";
import { parseTimestamp, shiftTimestamp } from "../match-plan.ts";
import {
  CLIP_INSIGHT_IDS,
  INSIGHT_TAB_IDS,
  type CoachInsight,
  type CoachMode,
  type CoachRequest,
  type InsightTabId,
} from "./types.ts";

/** Soft ceiling so a 20-chunk merge cannot dump an unreadable wall. Prefer merge-similar over this. */
export const UI_INSIGHT_CAP = 36;

export const MAX_INSIGHTS_BY_MODE: Record<CoachMode, number> = {
  clip: 8,
  "match-chunk": 8,
  "match-merge": UI_INSIGHT_CAP,
  live: 2,
};

export const INSIGHT_TAB_LABELS: Record<InsightTabId, string> = {
  rotation: "立ち回り/回転",
  aim: "エイム",
  abilities: "スキル",
  endgame: "詰め/終盤",
  other: "その他",
};

const TAB_ALIASES: Record<string, InsightTabId> = {
  rotation: "rotation",
  positioning: "rotation",
  rotate: "rotation",
  movement: "rotation",
  pathing: "rotation",
  "立ち回り": "rotation",
  "回転": "rotation",
  aim: "aim",
  peek: "aim",
  crosshair: "aim",
  "エイム": "aim",
  abilities: "abilities",
  util: "abilities",
  utility: "abilities",
  skill: "abilities",
  "スキル": "abilities",
  endgame: "endgame",
  close: "endgame",
  clutch: "endgame",
  reset: "endgame",
  "詰め": "endgame",
  "終盤": "endgame",
  other: "other",
  practice: "other",
  fight: "rotation",
  "fight-open": "aim",
  trade: "rotation",
  "now-peek": "aim",
};

export function parseInsightTab(value: unknown): InsightTabId | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if ((INSIGHT_TAB_IDS as readonly string[]).includes(lower)) return lower as InsightTabId;
  return TAB_ALIASES[trimmed] ?? TAB_ALIASES[lower];
}

export function resolveInsightTab(insight: Pick<CoachInsight, "id" | "tab" | "title">): InsightTabId {
  const fromTab = parseInsightTab(insight.tab);
  if (fromTab) return fromTab;
  const fromId = parseInsightTab(insight.id);
  if (fromId) return fromId;
  const title = insight.title ?? "";
  if (/回転|ローテ|ゾーン|漁夫|射線|立ち回り|アングル|経路/.test(title)) return "rotation";
  if (/エイム|クロスヘア|レティクル|腰撃|バースト/.test(title)) return "aim";
  if (/スキル|タクティカル|アルティメット|ユーティリティ|シグネチャ/.test(title)) return "abilities";
  if (/詰め|終盤|クローズ|リセット|クラッチ/.test(title)) return "endgame";
  if ((CLIP_INSIGHT_IDS as readonly string[]).includes(insight.id)) {
    return insight.id === "aim"
      ? "aim"
      : insight.id === "abilities"
        ? "abilities"
        : insight.id === "practice"
          ? "other"
          : "rotation";
  }
  return "other";
}

export function withInsightTab(insight: CoachInsight): CoachInsight {
  return { ...insight, tab: resolveInsightTab(insight) };
}

export function groupInsightsByTab(insights: CoachInsight[]): Record<InsightTabId, CoachInsight[]> {
  const groups = {
    rotation: [] as CoachInsight[],
    aim: [] as CoachInsight[],
    abilities: [] as CoachInsight[],
    endgame: [] as CoachInsight[],
    other: [] as CoachInsight[],
  };
  for (const insight of insights) {
    groups[resolveInsightTab(insight)].push(withInsightTab(insight));
  }
  return groups;
}

export function usedInsightTabs(insights: CoachInsight[]): InsightTabId[] {
  const groups = groupInsightsByTab(insights);
  return INSIGHT_TAB_IDS.filter((tab) => groups[tab].length > 0);
}

/** Tabs only when the list would be hard to scan. Short clips stay as a flat stack. */
export function shouldShowInsightTabs(insights: CoachInsight[]) {
  if (insights.length <= 4) return false;
  return usedInsightTabs(insights).length >= 2 || insights.length >= 8;
}

export function similarInsight(left: CoachInsight, right: CoachInsight) {
  if (resolveInsightTab(left) !== resolveInsightTab(right)) return false;
  const titleA = normalizeCoachText(left.title);
  const titleB = normalizeCoachText(right.title);
  const findingA = normalizeCoachText(left.finding);
  const findingB = normalizeCoachText(right.finding);
  const titlesClose =
    Boolean(titleA) &&
    Boolean(titleB) &&
    (titleA === titleB || titleA.includes(titleB) || titleB.includes(titleA));
  const findingsClose =
    Boolean(findingA) &&
    Boolean(findingB) &&
    (findingA === findingB ||
      (findingA.length >= 16 && findingB.includes(findingA.slice(0, 16))) ||
      (findingB.length >= 16 && findingA.includes(findingB.slice(0, 16))));
  const timeA = parseTimestamp(left.timestamp);
  const timeB = parseTimestamp(right.timestamp);
  const farApart = timeA != null && timeB != null && Math.abs(timeA - timeB) > 120;
  const rotation = resolveInsightTab(left) === "rotation";
  if (farApart && !rotation && !titlesClose) return false;
  if (left.id && right.id && left.id === right.id && !farApart) return true;
  return titlesClose && (findingsClose || rotation || !farApart);
}

function richerInsight(left: CoachInsight, right: CoachInsight): CoachInsight {
  const leftLen = left.finding.length + left.action.length;
  const rightLen = right.finding.length + right.action.length;
  const winner = rightLen > leftLen ? right : left;
  const other = winner === left ? right : left;
  const timestamp = winner.timestamp || other.timestamp;
  return withInsightTab({
    ...winner,
    timestamp,
    title: winner.title.length >= other.title.length ? winner.title : other.title,
  });
}

function capPriority(insight: CoachInsight) {
  const tab = resolveInsightTab(insight);
  const tabRank = tab === "rotation" ? 4 : tab === "endgame" ? 3 : tab === "aim" ? 2 : tab === "abilities" ? 1 : 0;
  return tabRank * 1000 + insight.finding.length + insight.action.length;
}

/**
 * Collapse repeated lessons. Cap only to keep the board readable — never pad up to it.
 */
export function mergeSimilarInsights(insights: CoachInsight[], cap = UI_INSIGHT_CAP): CoachInsight[] {
  const kept: CoachInsight[] = [];
  for (const insight of insights) {
    if (!insight.title && !insight.finding) continue;
    const next = withInsightTab(insight);
    const index = kept.findIndex((existing) => similarInsight(existing, next));
    if (index === -1) kept.push(next);
    else kept[index] = richerInsight(kept[index], next);
  }
  if (kept.length <= cap) return kept;
  return [...kept].sort((a, b) => capPriority(b) - capPriority(a)).slice(0, cap);
}

function stringify(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function insightsFromParsed(
  parsed: Record<string, unknown>,
  input: CoachRequest,
  mode: CoachMode,
): CoachInsight[] {
  const insightsRaw = Array.isArray(parsed.insights) ? parsed.insights : [];
  const start = input.startOffsetSec ?? 0;
  const end = input.endOffsetSec ?? start;
  const max = MAX_INSIGHTS_BY_MODE[mode];
  const insights: CoachInsight[] = [];
  for (let index = 0; index < insightsRaw.length; index += 1) {
    const row = insightsRaw[index];
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const title = stringify(record.title);
    const finding = stringify(record.finding);
    const action = stringify(record.action);
    if (!title && !finding) continue;
    if (looksLikeSlogan(`${title}${finding}${action}`)) continue;
    let timestamp = stringify(record.timestamp) || undefined;
    if (mode === "match-chunk") timestamp = shiftTimestamp(timestamp, start, end);
    if (mode === "live" && !timestamp) timestamp = "now";
    insights.push(
      withInsightTab({
        id: stringify(record.id) || `scene-${index + 1}`,
        tab: parseInsightTab(record.tab),
        timestamp,
        title: title || `局面 ${index + 1}`,
        finding: finding || `${input.rank}の${input.character}について、この局面の根拠が足りません。`,
        action: action || "見えていた人数と射程から、取る／切るを1つ選ぶ。",
      }),
    );
  }
  if (mode === "live") return insights.slice(0, max);
  return mergeSimilarInsights(insights, max);
}
