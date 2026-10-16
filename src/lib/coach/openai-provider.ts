import {
  requestHasClip,
  type CoachInsight,
  type CoachRequest,
  type CoachResponse,
  type VideoCoachProvider,
} from "./types";

const INSIGHT_IDS = ["aim", "positioning", "abilities", "practice"] as const;

class OpenAIVideoCoachProvider implements VideoCoachProvider {
  async analyze(input: CoachRequest): Promise<CoachResponse> {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      throw new Error("AIコーチに接続できませんでした。");
    }

    const hasClip = requestHasClip(input);
    const userText = buildUserText(input, hasClip);
    const content: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
    for (const frame of input.frames ?? []) {
      content.push({
        type: "image_url",
        image_url: { url: frame.dataUrl, detail: "low" },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("AIコーチに接続できませんでした。");
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) throw new Error("AIコーチの応答を解析できませんでした。");
    return toCoachResponse(JSON.parse(raw) as Record<string, unknown>, input);
  }
}

const SYSTEM_PROMPT = `あなたはFPSの動画コーチです。日本語で、指定JSONだけを返します。
insights は必ず4件で id は aim, positioning, abilities, practice の順。
各 insight は title / finding / action を具体的に。クリップフレームがあるときは時間帯に触れる。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":"aim"|"positioning"|"abilities"|"practice","timestamp":string,"title":string,"finding":string,"action":string}]}`;

function buildUserText(input: CoachRequest, hasClip: boolean) {
  const lines = [
    `ゲーム: ${input.game}`,
    `ランク: ${input.rank}`,
    `キャラクター: ${input.character}`,
    `悩み・目的: ${input.concern || "（未記入。ランクとキャラから推測）"}`,
    hasClip ? "クライアントが動画から抽出したJPEGフレームを添付しています。" : "動画なし。ノートコーチングです。",
  ];
  if (input.videoUrl) lines.push("クリップの保存URLがあります（中身はフレームを優先して見てください）。");
  if (input.frames?.length) {
    lines.push(`フレーム時刻(秒): ${input.frames.map((frame) => frame.timestamp.toFixed(2)).join(", ")}`);
  }
  return lines.join("\n");
}

function toCoachResponse(parsed: Record<string, unknown>, input: CoachRequest): CoachResponse {
  const insightsRaw = Array.isArray(parsed.insights) ? parsed.insights : [];
  const insights: CoachInsight[] = INSIGHT_IDS.map((id, index) => {
    const row = (insightsRaw[index] ?? {}) as Record<string, unknown>;
    return {
      id,
      timestamp: stringify(row.timestamp) || undefined,
      title: stringify(row.title) || fallbackTitle(id),
      finding: stringify(row.finding) || "この項目の具体的な観察は得られませんでした。",
      action: stringify(row.action) || "次の試合で一つだけ意識して繰り返してください。",
    };
  });

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    headline: stringify(parsed.headline) || `${input.character} コーチング · ${input.rank}`,
    summary: stringify(parsed.summary) || `${input.rank}の${input.character}向けの改善ポイントです。`,
    insights,
  };
}

function stringify(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackTitle(id: CoachInsight["id"]) {
  if (id === "aim") return "エイム";
  if (id === "positioning") return "立ち回り";
  if (id === "abilities") return "スキル";
  return "練習";
}

export const openaiCoachProvider: VideoCoachProvider = new OpenAIVideoCoachProvider();
