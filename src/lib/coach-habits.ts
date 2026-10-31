import type { CoachLanguage } from "./coach-language.ts";

/** Coaching fields only. The player's own concern is not a habit. */
export type HabitText = {
  headline?: string;
  summary?: string;
  rotationStory?: string;
  insights?: ReadonlyArray<{ title?: string; finding?: string; action?: string }>;
  closeRangeFights?: ReadonlyArray<{ title?: string; sightlines?: string; knowHow?: string }>;
  viralScript?: { video_title?: string; ai_tsukkomi?: string; cta_text?: string };
};

export type HabitSource = {
  sourceLanguage: CoachLanguage;
  result: HabitText;
  translations?: Partial<Record<CoachLanguage, HabitText>>;
};

type Marker = { text: string; word: boolean };

/** Longer phrases first so "habits" wins over "habit". */
const MARKERS: readonly Marker[] = [
  { text: "angewohnheit", word: true },
  { text: "gewohnheit", word: true },
  { text: "habitudes", word: true },
  { text: "habitude", word: true },
  { text: "abitudini", word: true },
  { text: "abitudine", word: true },
  { text: "alışkanlık", word: true },
  { text: "aliskanlik", word: true },
  { text: "kebiasaan", word: true },
  { text: "hábitos", word: true },
  { text: "hábito", word: true },
  { text: "habitos", word: true },
  { text: "habito", word: true },
  { text: "nawyki", word: true },
  { text: "nawyk", word: true },
  { text: "habits", word: true },
  { text: "habit", word: true },
  { text: "習慣", word: false },
  { text: "습관", word: false },
  { text: "癖", word: false },
];

const MAX_LINE = 72;

function pieces(value: unknown, into: string[]) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed) into.push(trimmed);
}

function textOf(source: HabitText | undefined) {
  if (!source) return "";
  const parts: string[] = [];
  pieces(source.headline, parts);
  pieces(source.summary, parts);
  pieces(source.rotationStory, parts);
  for (const insight of source.insights ?? []) {
    pieces(insight.title, parts);
    pieces(insight.finding, parts);
    pieces(insight.action, parts);
  }
  for (const fight of source.closeRangeFights ?? []) {
    pieces(fight.title, parts);
    pieces(fight.sightlines, parts);
    pieces(fight.knowHow, parts);
  }
  pieces(source.viralScript?.video_title, parts);
  pieces(source.viralScript?.ai_tsukkomi, parts);
  pieces(source.viralScript?.cta_text, parts);
  return parts.join("\n");
}

function isLetter(char: string) {
  return Boolean(char) && /\p{L}/u.test(char);
}

function bounded(text: string, index: number, length: number) {
  return !isLetter(text[index - 1] ?? "") && !isLetter(text[index + length] ?? "");
}

function markerAt(clause: string): { index: number; length: number } | null {
  const lower = clause.toLowerCase();
  let best: { index: number; length: number } | null = null;
  for (const marker of MARKERS) {
    const needle = marker.text.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(needle, from);
      if (index < 0) break;
      from = index + needle.length;
      if (marker.word && !bounded(clause, index, needle.length)) continue;
      if (!best || needle.length > best.length || (needle.length === best.length && index < best.index)) {
        best = { index, length: needle.length };
      }
      break;
    }
  }
  return best;
}

function windowAround(text: string, index: number, markerLength: number) {
  if (text.length <= MAX_LINE) return text.trim();
  const markerEnd = Math.min(text.length, index + markerLength);
  const end = Math.min(text.length, Math.max(index - 24 + MAX_LINE, markerEnd));
  const start = Math.max(0, end - MAX_LINE);
  return text.slice(start, end).trim();
}

/** A short clause copied from `text`. Nothing is renamed into a habit. */
export function habitLineFromText(text: string): string | null {
  const chunks = text
    .split(/[\n\r。！？!?；;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  let best: string | null = null;
  for (const chunk of chunks.length > 0 ? chunks : [text.trim()]) {
    const marker = markerAt(chunk);
    if (!marker) continue;
    const markerText = chunk.slice(marker.index, marker.index + marker.length);
    const line = windowAround(chunk, marker.index, marker.length);
    const at = line.indexOf(markerText);
    if (at < 0 || !chunk.includes(line)) continue;
    const rest = `${line.slice(0, at)}${line.slice(at + markerText.length)}`.replace(/[^\p{L}\p{N}]/gu, "");
    if (rest.length < 2) continue;
    if (!best || line.length < best.length) best = line;
  }
  return best;
}

function lineFromRecord(record: HabitSource, language: CoachLanguage) {
  const translated = textOf(record.translations?.[language]);
  const source = textOf(record.result);
  const layers = translated && translated !== source ? [translated, source] : [source || translated];
  for (const text of layers) {
    if (!text) continue;
    const line = habitLineFromText(text);
    if (line && text.includes(line)) return line;
  }
  return null;
}

/**
 * One habit line, and only when some saved coaching sentence already says so.
 * The same phrase across more analyses wins. Ties keep the shorter sentence.
 */
export function habitLineFromRecords(records: readonly HabitSource[], language: CoachLanguage): string | null {
  const counts = new Map<string, { line: string; count: number }>();
  for (const record of records) {
    const line = lineFromRecord(record, language);
    if (!line) continue;
    const key = line.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { line, count: 1 });
  }
  let best: { line: string; count: number } | null = null;
  for (const item of counts.values()) {
    if (!best || item.count > best.count || (item.count === best.count && item.line.length < best.line.length)) {
      best = item;
    }
  }
  return best?.line ?? null;
}
