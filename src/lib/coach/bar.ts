/** Shared coaching standard for notes, clip, match-chunk, match-merge, and live. */

export const COACHING_BAR = `プロチーム相当。これより緩くしない。
- その瞬間に見えていた情報（射程、ユーティリティ、人数、位置、ローテ残り時間、味方の状態、ミニマップ）で判断を評価する。
- 勝った／死んだ／キルデスという結果だけで褒めたり責めたりしない。結果は補強証拠に限る。
- 期待値と高確率の選択を優先する。ファイトを取る／切る、アビリティ経済、スペース、情報。
- 指摘は具体的で反証可能。何が見えていたか、より良い選択肢は何か、なぜその方が期待値が高いか。
- 汎用スローガンは禁止（「エイムを意識」「ポジションを取ろう」「情報を取ろう」「落ち着いて」など）。
- ゲーム／ランク／キャラ／悩みと、画面または映像の根拠を必ず結びつける。その選手向けでない指摘は出さない。
- 本当に指摘すべき局面だけ出す。枠を埋めるための指摘は出さない。`;

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
