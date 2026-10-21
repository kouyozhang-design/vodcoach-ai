import { formatTimestamp } from "../match-plan.ts";
import { COACHING_BAR } from "./bar.ts";
import { requestHasClip, type CoachMode, type CoachRequest } from "./types.ts";

export function playerContext(input: Pick<CoachRequest, "game" | "rank" | "character" | "concern">) {
  return {
    game: input.game,
    rank: input.rank,
    character: input.character,
    concern: input.concern.trim() || "（未記入。ランクとキャラと画面の根拠から推測）",
  };
}

export function profileLines(input: Pick<CoachRequest, "game" | "rank" | "character" | "concern">) {
  const profile = playerContext(input);
  return [
    `ゲーム: ${profile.game}`,
    `ランク: ${profile.rank}`,
    `キャラクター: ${profile.character}`,
    `悩み・目的: ${profile.concern}`,
  ];
}

export function systemPrompt(mode: CoachMode) {
  if (mode === "live") {
    return `${COACHING_BAR}
あなたはFPSのライブコーチです。日本語で指定JSONだけを返します。
今見えているゲーム画面（共有フレーム）だけを根拠に、直後の1手を評価します。
shouldSpeak は、今この瞬間に反証可能な指摘があるときだけ true。メニュー・黒画面・移動のみ・前回と同じ局面・勝敗だけの変化なら false。
false のときは insights を空配列にし、skipReason に短い理由を書く。true のときは insights 1〜2件。枠を埋めない。
id は自由（fight, peek, util, rotate など）。timestamp は "now" か経過 mm:ss。
ゲーム内HUDへ重ねる前提の指示は書かない。recentCues と同じ内容は繰り返さない。
JSON形状:
{"shouldSpeak":boolean,"skipReason":string,"headline":string,"summary":string,"insights":[{"id":string,"timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  if (mode === "match-chunk") {
    return `${COACHING_BAR}
あなたはFPSの試合VODコーチです。日本語で指定JSONだけを返します。
渡された時間帯だけを見る。本当に期待値を落としている局面だけを 0〜6 件出す。回転・移動・デスカムだけの区間は insights を空配列のままにする。0件でよい。
aim / positioning / abilities / practice の4枠に縛らない。枠を埋めるための指摘は禁止。
timestamp は試合全体の mm:ss（チャンク先頭からの相対ではなく絶対時間）。
JPEGは補助。動画セグメントがあるときは動画を優先。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":string,"timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  if (mode === "match-merge") {
    return `${COACHING_BAR}
あなたはFPSの試合レポート編集者です。日本語で指定JSONだけを返します。
区間レポートを1本の試合レポートにまとめる。重複とスローガンと結果論だけを削り、タイムスタンプ付きの具体的な局面だけを残す。0件でもよい。8件に満たなくても埋めない。
4枠（aim/positioning/abilities/practice）に圧縮しない。timestamp は mm:ss のまま。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":string,"timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  return `${COACHING_BAR}
あなたはFPSの動画／ノートコーチです。日本語で、指定JSONだけを返します。
insights は必ず4件で id は aim, positioning, abilities, practice の順。
各 insight は、その選手のゲーム／ランク／キャラ／悩みと、映像または状況の根拠を結び、過程と期待値で書く。
勝敗やキルデスだけで褒めたり責めたりしない。汎用スローガンは禁止。
クリップ動画があるときは映像の時間帯に触れる。JPEGではなく渡された動画そのものを見る。
ノートのみのときは、悩み文をその選手の試合で起きる判断ミスとして具体化する。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":"aim"|"positioning"|"abilities"|"practice","timestamp":string,"title":string,"finding":string,"action":string}]}`;
}

export function buildUserText(input: CoachRequest, mode: CoachMode, hasVideo: boolean, hasFrames: boolean) {
  const lines = profileLines(input);
  lines.push("コーチングは過程と期待値で評価し、結果だけで判断しない。この選手の設定と画面／映像の根拠を必ず使う。");

  if (mode === "live") {
    lines.push("ライブ画面共有のフレームです。今この瞬間に本当に指摘すべきなら shouldSpeak=true。そうでなければ false で注視する。ゲーム内オーバーレイは使いません。");
    if (hasFrames) lines.push(`静止画 ${input.frames?.length ?? 0} 枚を添付しています。`);
    const recent = input.recentCues?.map((cue) => cue.trim()).filter(Boolean) ?? [];
    if (recent.length > 0) {
      lines.push("直近に出した指摘（近い繰り返しは shouldSpeak=false）:");
      for (const cue of recent.slice(0, 6)) lines.push(`- ${cue}`);
    }
    return lines.join("\n");
  }

  if (mode === "match-merge") {
    const reports = input.chunkReports ?? [];
    lines.push("以下は試合を時間分割して解析した区間レポートです。1本の試合レポートに統合してください。空の区間は空のまま扱い、埋めない。");
    if (input.durationSec) lines.push(`試合の長さ: ${formatTimestamp(input.durationSec)}`);
    reports.forEach((report, index) => {
      const start = report.startOffsetSec ?? 0;
      const end = report.endOffsetSec ?? start;
      lines.push(`--- 区間 ${index + 1} ${formatTimestamp(start)}–${formatTimestamp(end)} ---`);
      if (report.headline) lines.push(`見出し: ${report.headline}`);
      if (report.summary) lines.push(`要約: ${report.summary}`);
      const insights = report.insights ?? [];
      if (insights.length === 0) {
        lines.push("- （この区間に指摘すべき局面なし）");
        return;
      }
      for (const insight of insights) {
        lines.push(
          `- [${insight.timestamp || "?"}] ${insight.title}: ${insight.finding} / 行動: ${insight.action}`,
        );
      }
    });
    return lines.join("\n");
  }

  if (mode === "match-chunk") {
    const start = input.startOffsetSec ?? 0;
    const end = input.endOffsetSec ?? start;
    lines.push(
      `試合VODの区間 ${formatTimestamp(start)}–${formatTimestamp(end)} です。timestamp はこの試合時刻で書いてください。局面がなければ insights は空配列。`,
    );
    if (typeof input.chunkIndex === "number" && typeof input.chunkCount === "number") {
      lines.push(`区間 ${input.chunkIndex + 1}/${input.chunkCount}`);
    }
    if (input.durationSec) lines.push(`試合全体の長さ: ${formatTimestamp(input.durationSec)}`);
    if (hasVideo) lines.push("クリップはクラウド上のHTTPS URLです。指定オフセットの動画を優先してください。");
    if (hasFrames) lines.push("同じ区間のJPEGを補助として添付しています。");
    return lines.join("\n");
  }

  lines.push(
    hasVideo
      ? "クリップ動画を添付しています。動画ファイルそのものを見てコーチングしてください。"
      : "動画なし。ノートコーチングです。悩み文を、そのランクとそのキャラの判断として具体化してください。",
  );
  if (input.videoUrl && hasVideo) {
    lines.push("クリップはクラウド上のHTTPS URLから参照しています。");
  }
  if (!hasVideo && requestHasClip(input)) {
    lines.push("静止画フレームは使わず、ノート情報だけでコーチングしてください。");
  }
  return lines.join("\n");
}
