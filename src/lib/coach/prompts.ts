import { languageInstruction, resolveCoachLanguage } from "../coach-language.ts";
import { formatTimestamp } from "../match-plan.ts";
import { COACHING_BAR } from "./bar.ts";
import { formatRotationLine } from "./rotation.ts";
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

export function systemPrompt(mode: CoachMode, language = resolveCoachLanguage({})) {
  const langLine = languageInstruction(language);
  if (mode === "live") {
    return `${COACHING_BAR}
あなたはFPSのライブ音声コーチです。指定JSONだけを返します。プレイヤーは試合中で、タブも通知も見ません。製品は声です。
${langLine}
spokenLine は Web Speech が読む本文。短文。句点で切る。1〜3文。辛口で面白い。プロチームの過程と期待値。その選手のゲーム／ランク／キャラ／悩みと画面根拠を刺す。汎用スローガン禁止。
shouldSpeak を true にしていいのは次だけ。
1) post-fight: スクラップが終わった直後のレビュー。何が見えていて、次の1手がなぜ期待値か。
2) standoff: 両者が止まっている膠着。詰め方を説明する。
3) mid-range: 中距離の押し拡張 vs 離脱。キャラ性能、ゾーン（アンチ）、他パーティの射線を必ず材料にする。過程と期待値で1つ選ぶ。
mid-fight（撃ち合いの最中）は、1文で終わり、長い講義にならないと確信できるときだけ。確信がなければ false。撃ちながらの長話は禁止。
調査ビーコン／recon／スキャンをファイト前に使っていたら usedScan=true。そのとき spokenLine はスキャン結果を必ず使う。既知の敵位置＋今のゾーン（アンチ）＋残り時間を言い、次の一手を rotate / hold / third-party / disengage / setup から1つ選ぶ。スキャンを無視した一般論は禁止。
メニュー・黒画面・移動のみ・前回と同じ局面・勝敗だけの変化は false。
false のときは insights を空配列、spokenLine を空文字、skipReason に短い理由。true のときは spokenLine 必須、insights は0〜1件（内部用。UIには出さない）。
speakMoment は post-fight | standoff | mid-range | mid-fight。nextMove は rotate | hold | third-party | disengage | setup。
id は自由。tab は rotation | aim | abilities | endgame | other。timestamp は "now"。
ゲーム内HUDへ重ねる前提の指示は書かない。recentCues と同じ内容は繰り返さない。種類タブや通知スタックは使わない。
JSON形状:
{"shouldSpeak":boolean,"skipReason":string,"speakMoment":"post-fight"|"standoff"|"mid-range"|"mid-fight","usedScan":boolean,"nextMove":"rotate"|"hold"|"third-party"|"disengage"|"setup","spokenLine":string,"headline":string,"summary":string,"insights":[{"id":string,"tab":"rotation"|"aim"|"abilities"|"endgame"|"other","timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  if (mode === "match-chunk") {
    return `${COACHING_BAR}
あなたはFPSの試合VODコーチです。指定JSONだけを返します。
${langLine}
渡された時間帯だけを見る。insights は本当に期待値を落としている局面だけ。局面がなければ空配列。0件でよい。件数は固定しない（目安 0〜8）。枠を埋めない。
id は自由。tab は rotation | aim | abilities | endgame | other。aim / positioning / abilities / practice の4枠に縛らない。
撃ち合いが無くても、勝っていても、より高い期待値の詰めがあれば tab=endgame で出す。類似は1件にまとめる。
回転の正誤はこの40秒だけでは断定しない。事実を rotation に残し、試合全体の判定はマージに任せる。
rotation は insights が空でも必ず埋める。デスカムや移動だけの区間でも、リング／経路／漁夫のタイミングが分かれば書く。分からなければ intent=unknown と短い note。
- intent: zone-first（先にゾーンまたはスペースを取る） / zone-cut（通路を切って移動） / third-party（漁夫。他隊の撃ち合い後に入る） / unknown
- ring: Apexはリング番号・残り時間・チーム位置。VALORANTはサイトと回転先。
- path: スクワッドの経路
- thirdPartyTiming: 第三者が入った／入れたタイミング。無ければ空文字
- note: 見えていたリング・人数・銃声の事実。この区間の勝敗で褒めたり責めたりしない
timestamp は試合全体の mm:ss（チャンク先頭からの相対ではなく絶対時間）。
JPEGは補助。動画セグメントがあるときは動画を優先。
JSON形状:
{"headline":string,"summary":string,"rotation":{"intent":"zone-first"|"zone-cut"|"third-party"|"unknown","ring":string,"path":string,"thirdPartyTiming":string,"note":string},"insights":[{"id":string,"tab":"rotation"|"aim"|"abilities"|"endgame"|"other","timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  if (mode === "match-merge") {
    return `${COACHING_BAR}
あなたはFPSの試合レポート編集者です。指定JSONだけを返します。
${langLine}
区間レポートを1本の試合レポートにまとめる。重複とスローガンと結果論だけを削り、タイムスタンプ付きの具体的な局面だけを残す。0件でもよい。枠を埋めない。
回転は試合全体で判定する。各40秒の正誤をそのまま並べない。
全区間の rotation（ring, path, thirdPartyTiming, intent, note）を時系列で読み、スクワッドがゾーンファースト／ゾーンカット／漁夫のどれをいつ選び、それは試合全体のリングと人数と銃声から正しかったかを1つの物語にする。
rotationStory に試合全体の回転評価を書く（具体的な時刻と経路）。回転の改善点は tab=rotation の insight にする。正しければ回転カードを無理に作らない。
insights は 1カード = 1つの実在する改善。4枠（aim/positioning/abilities/practice）に圧縮しない。類似はマージ。
勝っていても、より高い期待値の詰め／クローズがあれば tab=endgame で出す。キルや勝利を理由に省略しない。
件数の上限はUI破綻防止のみ（おおよそ36）。埋め草で増やさない。質を優先。
timestamp は mm:ss のまま。tab は rotation | aim | abilities | endgame | other。
JSON形状:
{"headline":string,"summary":string,"rotationStory":string,"insights":[{"id":string,"tab":"rotation"|"aim"|"abilities"|"endgame"|"other","timestamp":string,"title":string,"finding":string,"action":string}]}`;
  }
  return `${COACHING_BAR}
あなたはFPSの動画／ノートコーチです。指定JSONだけを返します。
${langLine}
insights は本当に改善すべき点だけ。件数は固定しない。短いクリップは1〜3件でよい。長いクリップでも枠を埋めない。
id は自由。tab は rotation | aim | abilities | endgame | other。4枠（aim/positioning/abilities/practice）に圧縮しない。
練習メニューは実在する改善に紐づくときだけ tab=other に出す。スローガンのサーキットで埋めない。
各 insight は、その選手のゲーム／ランク／キャラ／悩みと、映像または状況の根拠を結び、過程と期待値で書く。
勝っても、より高い期待値の詰め／クローズがあれば tab=endgame で出す。
勝敗やキルデスだけで褒めたり責めたりしない。汎用スローガンは禁止。
クリップ動画があるときは映像の時間帯に触れる。JPEGではなく渡された動画そのものを見る。
ノートのみのときは、悩み文をその選手の試合で起きる判断ミスとして具体化する。
JSON形状:
{"headline":string,"summary":string,"insights":[{"id":string,"tab":"rotation"|"aim"|"abilities"|"endgame"|"other","timestamp":string,"title":string,"finding":string,"action":string}]}`;
}

export function buildUserText(input: CoachRequest, mode: CoachMode, hasVideo: boolean, hasFrames: boolean) {
  const language = resolveCoachLanguage(input);
  const lines = profileLines(input);
  lines.push(languageInstruction(language));
  lines.push("コーチングは過程と期待値で評価し、結果だけで判断しない。この選手の設定と画面／映像の根拠を必ず使う。");

  if (mode === "live") {
    lines.push("ライブ画面共有のフレームです。製品は声。戦闘後レビュー、膠着の詰め、中距離の押し／離脱だけ話す。撃ち合い中の長話はしない。");
    lines.push("調査ビーコンやreconをファイト前に使っていたら、スキャンの敵位置とアンチと残り時間を spokenLine に入れて次の一手を言え。");
    lines.push(
      language === "en"
        ? "When shouldSpeak=true, write spokenLine as short, sharp English. No tabs. No overlay."
        : "shouldSpeak=true のとき spokenLine に、辛口で短い日本語を書く。タブも通知も出さない。ゲーム内オーバーレイは使いません。",
    );
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
    lines.push("以下は試合を時間分割して解析した区間レポートです。1本の試合レポートに統合してください。空の区間の撃ち合いは空のまま扱い、埋めない。");
    lines.push("回転は全区間の rotation を時系列で読み、試合全体でゾーンファースト／ゾーンカット／漁夫の正誤を判定する。40秒ごとの感想を並べない。");
    lines.push("勝っていても、より高い期待値の詰めがあれば残す。類似はマージ。");
    if (input.durationSec) lines.push(`試合の長さ: ${formatTimestamp(input.durationSec)}`);
    reports.forEach((report, index) => {
      const start = report.startOffsetSec ?? 0;
      const end = report.endOffsetSec ?? start;
      lines.push(`--- 区間 ${index + 1} ${formatTimestamp(start)}–${formatTimestamp(end)} ---`);
      if (report.headline) lines.push(`見出し: ${report.headline}`);
      if (report.summary) lines.push(`要約: ${report.summary}`);
      const rotationLine = formatRotationLine(report.rotation);
      if (rotationLine) lines.push(rotationLine);
      else lines.push("回転: （この区間の回転メモなし）");
      const insights = report.insights ?? [];
      if (insights.length === 0) {
        lines.push("- （この区間に撃ち合いの指摘なし。回転メモは上を使う）");
        return;
      }
      for (const insight of insights) {
        const tab = insight.tab ? ` tab=${insight.tab}` : "";
        lines.push(
          `- [${insight.timestamp || "?"}]${tab} ${insight.title}: ${insight.finding} / 行動: ${insight.action}`,
        );
      }
    });
    return lines.join("\n");
  }

  if (mode === "match-chunk") {
    const start = input.startOffsetSec ?? 0;
    const end = input.endOffsetSec ?? start;
    lines.push(
      `試合VODの区間 ${formatTimestamp(start)}–${formatTimestamp(end)} です。timestamp はこの試合時刻で書いてください。撃ち合いがなければ insights は空配列。rotation は空にしない。`,
    );
    lines.push("この区間の回転の正誤は断定せず、リング・経路・漁夫タイミングの事実を rotation に残す。試合全体の判定は後段のマージが行う。");
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
