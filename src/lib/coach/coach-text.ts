import { parseCoachLanguage, type CoachLanguage } from "../coach-language.ts";
import type { CoachResponse, ViralScript } from "./types.ts";

export type CoachTextBundle = {
  headline: string;
  summary: string;
  rotationStory?: string;
  spokenLine?: string;
  insights: Array<{ id: string; title: string; finding: string; action: string }>;
  closeRangeFights?: Array<{ id: string; title: string; sightlines: string; knowHow: string }>;
  viralScript?: ViralScript;
};

export function bundleFromResult(result: Pick<
  CoachResponse,
  "headline" | "summary" | "rotationStory" | "spokenLine" | "insights" | "closeRangeFights" | "viralScript"
>): CoachTextBundle {
  return {
    headline: result.headline,
    summary: result.summary,
    rotationStory: result.rotationStory,
    spokenLine: result.spokenLine,
    insights: result.insights.map((insight) => ({
      id: insight.id,
      title: insight.title,
      finding: insight.finding,
      action: insight.action,
    })),
    closeRangeFights: result.closeRangeFights?.map((fight) => ({
      id: fight.id,
      title: fight.title,
      sightlines: fight.sightlines,
      knowHow: fight.knowHow,
    })),
    viralScript: result.viralScript
      ? {
          video_title: result.viralScript.video_title,
          ai_tsukkomi: result.viralScript.ai_tsukkomi,
          cta_text: result.viralScript.cta_text,
        }
      : undefined,
  };
}

function textOr(next: string | undefined, previous: string) {
  const trimmed = next?.trim() ?? "";
  return trimmed || previous;
}

/** Overlay translated strings. Ids, timestamps, tabs, and fight windows stay on the source result. */
export function applyBundle(result: CoachResponse, bundle: CoachTextBundle): CoachResponse {
  const insights = result.insights.map((insight, index) => {
    const next = bundle.insights.find((item) => item.id === insight.id) ?? bundle.insights[index];
    if (!next) return insight;
    return {
      ...insight,
      title: textOr(next.title, insight.title),
      finding: textOr(next.finding, insight.finding),
      action: textOr(next.action, insight.action),
    };
  });
  const fights = result.closeRangeFights?.map((fight, index) => {
    const next = bundle.closeRangeFights?.find((item) => item.id === fight.id) ?? bundle.closeRangeFights?.[index];
    if (!next) return fight;
    return {
      ...fight,
      title: textOr(next.title, fight.title),
      sightlines: textOr(next.sightlines, fight.sightlines),
      knowHow: textOr(next.knowHow, fight.knowHow),
    };
  });
  const viral = result.viralScript
    ? {
        video_title: textOr(bundle.viralScript?.video_title, result.viralScript.video_title),
        ai_tsukkomi: textOr(bundle.viralScript?.ai_tsukkomi, result.viralScript.ai_tsukkomi),
        cta_text: textOr(bundle.viralScript?.cta_text, result.viralScript.cta_text),
      }
    : undefined;
  return {
    ...result,
    headline: textOr(bundle.headline, result.headline),
    summary: textOr(bundle.summary, result.summary),
    rotationStory: bundle.rotationStory?.trim() || result.rotationStory,
    spokenLine: bundle.spokenLine === undefined ? result.spokenLine : textOr(bundle.spokenLine, result.spokenLine ?? ""),
    insights,
    closeRangeFights: fights,
    viralScript: viral,
  };
}

export function alignBundle(source: CoachTextBundle, translated: CoachTextBundle): CoachTextBundle {
  return {
    headline: textOr(translated.headline, source.headline),
    summary: textOr(translated.summary, source.summary),
    rotationStory: translated.rotationStory?.trim() || source.rotationStory,
    spokenLine: translated.spokenLine === undefined ? source.spokenLine : textOr(translated.spokenLine, source.spokenLine ?? ""),
    insights: source.insights.map((insight, index) => {
      const next = translated.insights.find((item) => item.id === insight.id) ?? translated.insights[index];
      return {
        id: insight.id,
        title: textOr(next?.title, insight.title),
        finding: textOr(next?.finding, insight.finding),
        action: textOr(next?.action, insight.action),
      };
    }),
    closeRangeFights: source.closeRangeFights?.map((fight, index) => {
      const next = translated.closeRangeFights?.find((item) => item.id === fight.id) ?? translated.closeRangeFights?.[index];
      return {
        id: fight.id,
        title: textOr(next?.title, fight.title),
        sightlines: textOr(next?.sightlines, fight.sightlines),
        knowHow: textOr(next?.knowHow, fight.knowHow),
      };
    }),
    viralScript: source.viralScript
      ? {
          video_title: textOr(translated.viralScript?.video_title, source.viralScript.video_title),
          ai_tsukkomi: textOr(translated.viralScript?.ai_tsukkomi, source.viralScript.ai_tsukkomi),
          cta_text: textOr(translated.viralScript?.cta_text, source.viralScript.cta_text),
        }
      : undefined,
  };
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function bundleFromUnknown(value: unknown): CoachTextBundle | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.headline !== "string" || typeof row.summary !== "string") return null;
  if (!Array.isArray(row.insights)) return null;
  const insights = row.insights.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const insight = item as Record<string, unknown>;
    return [{
      id: stringField(insight.id),
      title: stringField(insight.title),
      finding: stringField(insight.finding),
      action: stringField(insight.action),
    }];
  });
  const fights = Array.isArray(row.closeRangeFights)
    ? row.closeRangeFights.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const fight = item as Record<string, unknown>;
        return [{
          id: stringField(fight.id),
          title: stringField(fight.title),
          sightlines: stringField(fight.sightlines),
          knowHow: stringField(fight.knowHow),
        }];
      })
    : undefined;
  let viralScript: ViralScript | undefined;
  if (row.viralScript && typeof row.viralScript === "object") {
    const viral = row.viralScript as Record<string, unknown>;
    const video_title = stringField(viral.video_title);
    const ai_tsukkomi = stringField(viral.ai_tsukkomi);
    const cta_text = stringField(viral.cta_text);
    if (video_title || ai_tsukkomi || cta_text) {
      viralScript = { video_title, ai_tsukkomi, cta_text };
    }
  }
  return {
    headline: row.headline.trim(),
    summary: row.summary.trim(),
    rotationStory: stringField(row.rotationStory) || undefined,
    spokenLine: typeof row.spokenLine === "string" ? row.spokenLine.trim() : undefined,
    insights,
    closeRangeFights: fights && fights.length > 0 ? fights : undefined,
    viralScript,
  };
}

export type TranslateRequest = {
  language: CoachLanguage;
  sourceLanguage?: CoachLanguage;
  bundle: CoachTextBundle;
};

/** Rejects anything that would re-send a video or frames. */
export function parseTranslateRequest(body: unknown): TranslateRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "JSONの形式が正しくありません。" };
  const row = body as Record<string, unknown>;
  if ("videoUrl" in row || "frames" in row || "video" in row || "file" in row) {
    return { error: "翻訳は既存の文章だけを受け取ります。動画は送りません。" };
  }
  const bundle = bundleFromUnknown(row.bundle ?? row.text ?? row.result);
  if (!bundle) return { error: "訳す文章がありません。" };
  return {
    language: parseCoachLanguage(row.language),
    sourceLanguage: row.sourceLanguage == null ? undefined : parseCoachLanguage(row.sourceLanguage),
    bundle,
  };
}
