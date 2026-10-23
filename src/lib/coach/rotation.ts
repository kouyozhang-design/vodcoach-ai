import { formatTimestamp } from "../match-plan.ts";
import type { CoachChunkReport, RotationIntent, RotationNote } from "./types.ts";

const INTENT_LABELS: Record<RotationIntent, string> = {
  "zone-first": "ゾーンファースト",
  "zone-cut": "ゾーンカット",
  "third-party": "漁夫",
  unknown: "不明",
};

export function parseRotationIntent(value: unknown): RotationIntent | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "zone-first" || trimmed === "zone_first" || trimmed === "zonefirst") return "zone-first";
  if (trimmed === "zone-cut" || trimmed === "zone_cut" || trimmed === "zonecut") return "zone-cut";
  if (
    trimmed === "third-party" ||
    trimmed === "third_party" ||
    trimmed === "thirdparty" ||
    trimmed === "漁夫"
  ) {
    return "third-party";
  }
  if (trimmed === "unknown" || trimmed === "不明") return "unknown";
  return undefined;
}

function stringify(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseRotation(value: unknown): RotationNote | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const note: RotationNote = {
    intent: parseRotationIntent(row.intent) ?? "unknown",
    ring: stringify(row.ring) || undefined,
    path: stringify(row.path) || undefined,
    thirdPartyTiming: stringify(row.thirdPartyTiming) || stringify(row.third_party_timing) || undefined,
    note: stringify(row.note) || undefined,
  };
  return isEmptyRotation(note) ? undefined : note;
}

export function isEmptyRotation(note: RotationNote | undefined | null): boolean {
  if (!note) return true;
  const intent = note.intent && note.intent !== "unknown";
  return !intent && !note.ring && !note.path && !note.thirdPartyTiming && !note.note;
}

export function rotationIntentLabel(intent: RotationIntent | undefined) {
  return INTENT_LABELS[intent ?? "unknown"];
}

export function formatRotationLine(note: RotationNote | undefined) {
  if (isEmptyRotation(note) || !note) return "";
  return [
    `回転: ${rotationIntentLabel(note.intent)}`,
    `リング/位置: ${note.ring || "—"}`,
    `経路: ${note.path || "—"}`,
    `漁夫タイミング: ${note.thirdPartyTiming || "—"}`,
    `メモ: ${note.note || "—"}`,
  ].join(" / ");
}

export function collectRotationNotes(reports: CoachChunkReport[]) {
  return reports.flatMap((report) => {
    if (isEmptyRotation(report.rotation) || !report.rotation) return [];
    return [
      {
        startOffsetSec: report.startOffsetSec ?? 0,
        endOffsetSec: report.endOffsetSec ?? report.startOffsetSec ?? 0,
        rotation: report.rotation,
      },
    ];
  });
}

export function summarizeRotationTimeline(reports: CoachChunkReport[]) {
  const rows = collectRotationNotes(reports);
  if (rows.length === 0) return "";
  return rows
    .map((row) => {
      const window = `${formatTimestamp(row.startOffsetSec)}–${formatTimestamp(row.endOffsetSec)}`;
      return `${window} ${formatRotationLine(row.rotation)}`;
    })
    .join("\n");
}
