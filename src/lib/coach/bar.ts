/** Shared coaching standard for notes, clip, match-chunk, match-merge, and live. */

export const COACHING_BAR = `プロチーム相当。これより緩くしない。
- その瞬間に見えていた情報（射程、ユーティリティ、人数、位置、ローテ残り時間、味方の状態、ミニマップ）で判断を評価する。
- 勝った／死んだ／キルデスという結果だけで褒めたり責めたりしない。結果は補強証拠に限る。
- 期待値と高確率の選択を優先する。ファイトを取る／切る、アビリティ経済、スペース、情報。
- 指摘は具体的で反証可能。何が見えていたか、より良い選択肢は何か、なぜその方が期待値が高いか。
- 汎用スローガンは禁止（「エイムを意識」「ポジションを取ろう」「情報を取ろう」「落ち着いて」など）。
- ゲーム／ランク／キャラ／悩みと、画面または映像の根拠を必ず結びつける。その選手向けでない指摘は出さない。
- 本当に指摘すべき局面だけ出す。枠を埋めるための指摘は出さない。件数は固定しない。
- スクワッドの回転は試合全体で評価する。ゾーンファースト／ゾーンカット／漁夫（第三者）のどれが、そのときのリング・人数・銃声から期待値が高いか。40秒区間の正誤をそのまま並べない。
- 勝っても、より高い期待値の詰め／クローズがあれば出す。勝利やキルを理由に省略しない。
- 似た指摘は1つにまとめる。件数を増やすための埋め草は禁止。
- 認識はフレームに無いことを埋めない。武器の固有名はHUDか銃モデルが実際に読めたときだけ。読めなければ種（AR、SMG、ショットガン）か「手元の銃」。推測のR-301やヴァンダルは禁止。
- 段差（小さな高低差、リップ、ヘッドグリッチ）と階段を取り違えない。段しか見えないのに階段と書くな。
- フレーム外のカバー・ドア・アングルがより良い手なら、今見えていなくても提案する。画面に無いから出さない、は禁止。映像が明らかに別の間取りを示しているときだけ、それに反する配置を作るな。
- Apexのノックダウンはキルではない。ダウンした体は確殺（thirst）するまで残る。ノックをファイト終了にするな。見えていた人数・銃声・リングで、確殺／リセット／漁夫のどれが期待値かを選べ。`;

/** VOD / match only. Live stays a short spoken line. */
export const FIGHT_EXPLAIN = `近距離の解説は、最初に「解説ができた」厚みまで戻す。
- closeRangeFights.sightlines: その時刻に見えていた斜線、オフアングル、段差／カバー、誰がピークを持つか。画面外のカバーやドアが期待値なら、見えていなくても提案する。
- closeRangeFights.knowHow: 誰を撃つか、ユーティリティの前後、インファイトの選択、ノック後の確殺／リセット／漁夫。
- insights は同じ局面の高信号カード。何が見えていたか、より良い1手、なぜ期待値かを具体的に。斜線の全文は expander に残す。短いスローガン1行で終わらせるな。`;

export const BANNED_SLOGANS = [
  "エイムを意識",
  "エイムを鍛え",
  "ポジションを取ろう",
  "ポジショニングを意識",
  "情報を取ろう",
  "情報を意識",
  "落ち着いて",
  "コミュニケーションを取ろう",
  "もっと練習",
] as const;

export function normalizeCoachText(value: string) {
  return value.toLowerCase().replace(/[\s　、。・,.!！?？「」『』]/g, "");
}

export function looksLikeSlogan(text: string) {
  const normalized = normalizeCoachText(text);
  if (!normalized) return false;
  return BANNED_SLOGANS.some((slogan) => {
    const needle = normalizeCoachText(slogan);
    return normalized === needle || (normalized.includes(needle) && normalized.length <= needle.length + 10);
  });
}
