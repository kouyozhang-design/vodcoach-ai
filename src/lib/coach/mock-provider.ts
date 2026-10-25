import { resolveCoachLanguage } from "../coach-language.ts";
import { looksLikeSurveyBeacon } from "../live-speech.ts";
import { formatTimestamp, shiftTimestamp } from "../match-plan.ts";
import { resolveApexLocation, serializeApexPoi } from "./apex-poi.ts";
import { fightsFromChunkReports } from "./fight-detail.ts";
import { mergeSimilarInsights, withInsightTab } from "./insight-tabs.ts";
import { isEmptyRotation, summarizeRotationTimeline } from "./rotation.ts";
import { clampChars, defaultCta, TITLE_MAX_CHARS, TSUKKOMI_MAX_CHARS } from "./viral-script.ts";
import type {
  CloseRangeFight,
  CoachChunkReport,
  CoachInsight,
  CoachRequest,
  CoachResponse,
  RotationNote,
  ViralScript,
  VideoCoachProvider,
} from "./types.ts";
import { requestHasClip, resolveCoachMode } from "./types.ts";

class MockVideoCoachProvider implements VideoCoachProvider {
  async analyze(input: CoachRequest): Promise<CoachResponse> {
    const mode = resolveCoachMode(input);
    const delay = mode === "clip" ? 3600 : mode === "live" ? 480 : 320;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (mode === "match-merge") return buildMergeResponse(input);
    if (mode === "match-chunk") return buildMatchChunkResponse(input);
    if (mode === "live") return buildLiveResponse(input);
    return buildCoachResponse(input);
  }
}

function purposeOf(input: CoachRequest, hasVideo: boolean) {
  const concern = input.concern.trim();
  if (concern) return concern;
  if (hasVideo) {
    return `${input.rank}の${input.character}として、クリップの立ち回りとプレイスタイルを次の試合で勝つ形に寄せる`;
  }
  return `${input.rank} ${input.character}の立ち回りを安定させる`;
}

function shortsScript(
  game: CoachRequest["game"],
  english: boolean,
  video_title: string,
  ai_tsukkomi: string,
): ViralScript | undefined {
  if (game !== "apex-legends") return undefined;
  const title = clampChars(video_title, TITLE_MAX_CHARS);
  const tsukkomi = clampChars(ai_tsukkomi, TSUKKOMI_MAX_CHARS);
  if (!title || !tsukkomi) return undefined;
  return { video_title: title, ai_tsukkomi: tsukkomi, cta_text: defaultCta(english ? "en" : "ja") };
}

function clipShorts(input: CoachRequest, hasVideo: boolean, english: boolean): ViralScript | undefined {
  if (input.game !== "apex-legends") return undefined;
  if (hasVideo) {
    return shortsScript(
      input.game,
      english,
      english ? "You peeked the front" : "オフアングル捨てて正面",
      english
        ? "00:12 you dumped the off-angle and took the front peek."
        : "00:12、オフアングル捨てて正面ピーク。権利は敵。",
    );
  }
  const concern = input.concern.trim();
  if (!concern) return undefined;
  const aboutCover = /遮蔽|射線|ダウン|cover|sightline/i.test(concern);
  if (!aboutCover) {
    return shortsScript(input.game, english, concern, concern);
  }
  return shortsScript(
    input.game,
    english,
    english ? "You left the cover" : "遮蔽、自分で離してる",
    english
      ? "Close range, you step off cover and open two lines."
      : "近接で遮蔽を離れて2射線。先に落ちるのはそこ。",
  );
}

function mergeShorts(
  input: CoachRequest,
  insights: CoachInsight[],
  fights: CloseRangeFight[],
): ViralScript | undefined {
  if (input.game !== "apex-legends") return undefined;
  const english = resolveCoachLanguage(input) === "en";
  const moment =
    insights.find((insight) => insight.title.trim() && insight.tab !== "rotation") ??
    insights.find((insight) => insight.title.trim());
  const fight = fights[0];
  const rawTitle = (moment?.title || fight?.title || "").trim();
  if (!rawTitle) return undefined;
  const stamp = (moment?.timestamp || fight?.start || "").trim();
  const evidence = `${rawTitle} ${fight?.title ?? ""} ${fight?.sightlines ?? ""}`;
  if (english && /[ぁ-んァ-ン一-龯]/.test(rawTitle)) {
    if (/射線|ピーク|オフアングル|岩|遮蔽/.test(evidence)) {
      return shortsScript(
        input.game,
        true,
        "Two sightlines at once",
        `${stamp ? `${stamp} ` : ""}you opened two sightlines. Cut it to one.`.trim(),
      );
    }
    if (/ゾーン|漁夫|回転/.test(evidence)) {
      return shortsScript(
        input.game,
        true,
        "Zone before the fight",
        `${stamp ? `${stamp} ` : ""}that rotate gives up the zone. Take space first.`.trim(),
      );
    }
    return undefined;
  }
  const when = stamp ? (english ? `${stamp} ` : `${stamp}、`) : "";
  return shortsScript(
    input.game,
    english,
    rawTitle,
    english ? `${when}${rawTitle}. That's the miss.` : `${when}${rawTitle}。そこがミス。`,
  );
}

function buildCoachResponse(input: CoachRequest): CoachResponse {
  const hasVideo = requestHasClip(input);
  const isApex = input.game === "apex-legends";
  const purpose = purposeOf(input, hasVideo);
  const english = resolveCoachLanguage(input) === "en";

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: hasVideo ? "clip" : "notes",
    headline: english
      ? hasVideo
        ? `${input.character} clip · ${input.rank}`
        : `${input.character} notes · ${input.rank}`
      : hasVideo
        ? `${input.character} クリップ診断 · ${input.rank}`
        : `${input.character} コーチング · ${input.rank}`,
    summary: english
      ? `${input.rank} ${input.character}. Process and EV only. Focus: ${purpose}.`
      : hasVideo
        ? isApex
          ? `${input.rank} ${input.character}のクリップから、過程と期待値で見た改善だけを残しました。目的: 「${purpose}」。`
          : `${input.rank} ${input.character}のクリップから、サイトの切り方とスキルの窓を整理しました。目的: 「${purpose}」。`
        : isApex
          ? `${input.rank} ${input.character}向けのノートコーチングです。近接の撃ち合いと遮蔽の使い方を、枠に縛らず具体化しています。目的: 「${purpose}」。`
          : `${input.rank} ${input.character}向けのノートコーチングです。ヘッドラインとアングルの切り方を具体化しています。目的: 「${purpose}」。`,
    insights: buildInsights(input, hasVideo, isApex, purpose, english),
    closeRangeFights: buildClipFights(input, hasVideo, isApex, english),
    mapPoi: serializeApexPoi(explicitApexPoi(input)),
    viralScript: clipShorts(input, hasVideo, english),
  };
}

function explicitApexPoi(input: CoachRequest) {
  const location = resolveApexLocation(input);
  return location?.poiId ? { mapId: location.mapId, poiId: location.poiId } : undefined;
}

function rotationForChunk(input: CoachRequest): RotationNote {
  const start = input.startOffsetSec ?? 0;
  const index = input.chunkIndex ?? 0;
  const isApex = input.game === "apex-legends";
  if (index % 3 === 1) {
    return {
      intent: "zone-cut",
      ring: isApex ? "第2リング残り35秒、チームはゾーン外の尾根" : "Bサイト側。スパイクはA",
      path: isApex ? "Fragment西からHarvester尾根を横断" : "Aメインからミッドへカット",
      thirdPartyTiming: "",
      note: `${formatTimestamp(start)}、西に銃声。ゾーンカットを選んだ。この区間だけでは正誤を断定しない。`,
    };
  }
  if (index % 3 === 2) {
    return {
      intent: "third-party",
      ring: isApex ? "第3リング残り50秒、チームは東のカバー外" : "Aサイト外。リテイク未開始",
      path: isApex ? "尾根から東の撃ち合いへ接近" : "ミッドからAへ回り込み",
      thirdPartyTiming: `${formatTimestamp(start + 12)}に東の撃ち合いへ接近`,
      note: `${formatTimestamp(start + 12)}、撃ち合い開始から約12秒で漁夫を見ている。人数とリングは後段で判定する。`,
    };
  }
  return {
    intent: "zone-first",
    ring: isApex ? "第2リング内側、建物2つを確保" : "Aサイトを先に確保",
    path: isApex ? "ドロップ地点からゾーン内の建物へ" : "Aショートからサイトへ",
    thirdPartyTiming: "",
    note: `${formatTimestamp(start)}、先にスペースを取る動き。銃声は遠い。`,
  };
}

function buildMatchChunkResponse(input: CoachRequest): CoachResponse {
  const start = input.startOffsetSec ?? 0;
  const end = input.endOffsetSec ?? start + 40;
  const isApex = input.game === "apex-legends";
  const mid = (start + end) / 2;
  const quiet = typeof input.chunkIndex === "number" && input.chunkIndex % 3 === 1;
  const rotation = rotationForChunk(input);
  if (quiet) {
    return {
      analysisId: crypto.randomUUID(),
      game: input.game,
      character: input.character,
      kind: "match",
      headline: `${input.character} 区間 ${formatTimestamp(start)}–${formatTimestamp(end)}`,
      summary: `${input.rank}の${input.character}。この時間帯は回転または情報待ちで、撃ち合いの指摘はありません。回転メモだけ残します。`,
      insights: [],
      rotation,
      durationSec: input.durationSec,
      chunk: {
        startOffsetSec: start,
        endOffsetSec: end,
        index: input.chunkIndex,
        count: input.chunkCount,
      },
    };
  }
  const concern = input.concern.trim() || `${input.rank}の${input.character}の判断`;
  const insights: CoachInsight[] = [
    {
      id: "fight-open",
      tab: "aim",
      timestamp: shiftTimestamp(formatTimestamp(start + 4), start, end),
      title: isApex ? "遮蔽を離れて最初の射線を2本開いている" : "チョーク前にクロスヘアがヘッドから落ちる",
      finding: isApex
        ? `${formatTimestamp(start + 4)}、${input.rank}の${input.character}が岩から離れた瞬間に左右2射線が開いている。悩み「${concern}」は、見えていた人数を1人に削る前に出た判断。`
        : `${formatTimestamp(start + 4)}、${input.rank}の${input.character}のクロスヘアが壁のヘッドラインを外したままスイング。悩み「${concern}」は、止まる前に2アングルを開いた期待値の負け。`,
      action: isApex
        ? "出る前に岩の左端へ張り、見える敵を1人に減らしてからスライドする。死んだことではなく、2射線を同時に開いた選択を直す。"
        : "壁のヘッドラインを目で固定してから、2歩だけスイングして止まる。キル結果ではなく開いたアングル数で評価する。",
    },
    {
      id: "trade",
      tab: "rotation",
      timestamp: shiftTimestamp(formatTimestamp(mid), start, end),
      title: isApex ? "トレード距離が味方から切れている" : "エントリーが孤立してサイトの2アングルを同時に開く",
      finding: `${formatTimestamp(mid)}、${input.rank}帯では味方が撃てない位置まで単独で伸びています。`,
      action: isApex
        ? "味方の射線が通るまでワイドスイングしない。先にコールしてから1歩だけ出す。"
        : "手前の壁でheavenを隠し、味方のフラッシュ後に1アングルだけ切る。",
    },
    {
      id: "util",
      tab: "abilities",
      timestamp: shiftTimestamp(formatTimestamp(Math.max(start, end - 8)), start, end),
      title: isApex ? "タクティカルが撃ち合いの後になっている" : "スキルがサイトテイクの窓に間に合っていない",
      finding: `${input.character}のスキルがこの区間の終盤まで残っています。先に置いた側が勝ちます。`,
      action: isApex
        ? "オープンを渡る3秒前にタクティカル。アルティメットはチームがコミットする声と同時。"
        : "突入コールの3秒前にシグネチャー。プラント確保の窓でアルティメットを使う。",
    },
    {
      id: "close",
      tab: "endgame",
      timestamp: shiftTimestamp(formatTimestamp(end - 2), start, end),
      title: isApex ? "ノックしたあとの確殺を捨てている" : "サイトを取ったあとのクローズが遅い",
      finding: isApex
        ? `${formatTimestamp(end - 2)}、${input.rank}の${input.character}はノックしただけでファイトを終わったつもりになっている。ダウンした体は残っている。確殺せず同じ角度にいるので、漁夫に期待値を渡している。`
        : `${formatTimestamp(end - 2)}、${input.rank}の${input.character}はキル後も同じアングルに残り、サイトの裏を閉じていない。勝ったことではなく、閉じる順番が遅い。`,
      action: isApex
        ? "ノック確認の1秒後に角度を変え、ダウンを確殺するか、銃声と人数でリセット／漁夫を選べ。ノックをキルと言うな。"
        : "キル後は2歩サイト内へ入り、heavenを消してからプラント。勝ったラウンドでもクローズの順番を直す。",
    },
  ];

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: "match",
    headline: `${input.character} 区間 ${formatTimestamp(start)}–${formatTimestamp(end)}`,
    summary: `${input.rank}の${input.character}。この時間帯から、見えていた情報で期待値を落とした局面だけを残しました。勝っていても詰めを見ています。`,
    insights,
    closeRangeFights: buildChunkFights(input, start, isApex),
    mapPoi: serializeApexPoi(explicitApexPoi(input)),
    rotation,
    durationSec: input.durationSec,
    chunk: {
      startOffsetSec: start,
      endOffsetSec: end,
      index: input.chunkIndex,
      count: input.chunkCount,
    },
  };
}

function buildMergeResponse(input: CoachRequest): CoachResponse {
  const reports = input.chunkReports ?? [];
  const collected = reports.flatMap((report) => (report.insights ?? []).map(withInsightTab));
  const rotationInsight = matchRotationInsight(input, reports);
  const withClose = ensureHigherEvClose(input, collected);
  const insights = mergeSimilarInsights(
    rotationInsight ? [rotationInsight, ...withClose] : withClose,
  );
  const rotationStory = matchRotationStory(input, reports);
  const fights = fightsFromChunkReports(reports);
  const viralScript = mergeShorts(input, insights, fights);

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: "match",
    headline: `${input.character} 試合一本診断 · ${input.rank}`,
    summary:
      insights.length === 0 && !rotationStory
        ? `${input.rank}の${input.character}。分割した区間に指摘すべき局面はありませんでした。枠は埋めていません。`
        : `${input.rank}の${input.character}について、過程と期待値で見たタイムスタンプ付きの指摘だけを1つのレポートにまとめました。回転は試合全体で判定しています。${
            input.durationSec ? `対象の長さは約 ${formatTimestamp(input.durationSec)} です。` : ""
          }`,
    insights,
    closeRangeFights: fights,
    mapPoi: serializeApexPoi(explicitApexPoi(input)),
    viralScript,
    rotationStory: rotationStory || undefined,
    durationSec: input.durationSec,
  };
}

function matchRotationStory(input: CoachRequest, reports: CoachChunkReport[]) {
  const timeline = summarizeRotationTimeline(reports);
  if (!timeline) return "";
  const who = `${input.rank}の${input.character}`;
  const filled = reports.filter((report) => !isEmptyRotation(report.rotation));
  const cut = filled.find((report) => report.rotation?.intent === "zone-cut");
  const third = filled.find((report) => report.rotation?.intent === "third-party");
  const first = filled.find((report) => report.rotation?.intent === "zone-first");
  const path = filled
    .map((report) => report.rotation?.path)
    .filter(Boolean)
    .join(" → ");

  if (first && cut) {
    const when = formatTimestamp(cut.startOffsetSec ?? 0);
    return `${who}は序盤ゾーンファーストでスペースを取ったあと、${when}付近でゾーンカットに切り替えた。試合全体のリングと銃声から見ると、先にゾーン内のカバーを確保してから漁夫を見る方が期待値が高い。経路: ${path}。`;
  }
  if (third) {
    const when = third.rotation?.thirdPartyTiming || formatTimestamp(third.startOffsetSec ?? 0);
    return `${who}は${when}で漁夫に寄っている。試合全体では、ゾーンを先に踏んでから第三者を見る方が、人数と残り時間に対して高い。経路: ${path}。`;
  }
  return `${who}の回転は試合全体でゾーンファーストに近い。経路: ${path}。無理に直す点はない。`;
}

function matchRotationInsight(input: CoachRequest, reports: CoachChunkReport[]): CoachInsight | undefined {
  const story = matchRotationStory(input, reports);
  if (!story) return undefined;
  if (/無理に直す点はない/.test(story)) return undefined;
  const cut = reports.find((report) => report.rotation?.intent === "zone-cut");
  const third = reports.find((report) => report.rotation?.intent === "third-party");
  const at = cut ?? third;
  return {
    id: "match-rotation",
    tab: "rotation",
    timestamp: formatTimestamp(at?.startOffsetSec ?? 0),
    title: cut
      ? "ゾーンカットが早い。先にゾーンを取ってから漁夫を見る"
      : "漁夫がゾーン確保より先になっている",
    finding: story,
    action:
      "次のリングが確定してから尾根や通路を切る。銃声が聞こえても、ゾーン外の漁夫は人数と残り時間を数えてから入る。",
  };
}

function ensureHigherEvClose(input: CoachRequest, insights: CoachInsight[]): CoachInsight[] {
  if (insights.some((insight) => insight.tab === "endgame")) return insights;
  const lastFight = [...insights].reverse().find((insight) => insight.tab !== "rotation");
  if (!lastFight) return insights;
  const isApex = input.game === "apex-legends";
  const timestamp = lastFight.timestamp;
  return [
    ...insights,
    {
      id: "match-close",
      tab: "endgame",
      timestamp,
      title: isApex ? "勝ち切れても詰めの期待値を上げられる" : "ラウンドに勝ってもクローズの順番を上げられる",
      finding: isApex
        ? `${timestamp || "終盤"}、${input.rank}の${input.character}は撃ち合いに勝ったあとも同じ角度に残っている。勝利ではなく、第三者に隙を渡している。`
        : `${timestamp || "終盤"}、${input.rank}の${input.character}はキル後も同じアングルに残り、裏を閉じていない。勝ったことではなく閉じる順番。`,
      action: isApex
        ? "ダウン確認の1秒後に角度を変え、残りをカバー側へ追い込む。"
        : "キル後はサイト内へ入り、heavenを消してからプラント。",
    },
  ];
}

function buildLiveResponse(input: CoachRequest): CoachResponse {
  const isApex = input.game === "apex-legends";
  const english = resolveCoachLanguage(input) === "en";
  const black = (input.frames?.length ?? 0) === 0;
  const concern = input.concern.trim() || `${input.rank}の${input.character}の今の判断`;
  if (black) {
    return {
      analysisId: crypto.randomUUID(),
      game: input.game,
      character: input.character,
      kind: "live",
      shouldSpeak: false,
      skipReason: "フレームなし",
      spokenLine: "",
      headline: "注視中",
      summary:
        "共有フレームが届いていません。ゲームウィンドウを選び、チート対策で黒画面になっていないか確認してください。",
      insights: [],
    };
  }
  if (looksLikeSurveyBeacon(concern) && (input.recentCues?.length ?? 0) === 0) {
    return {
      analysisId: crypto.randomUUID(),
      game: input.game,
      character: input.character,
      kind: "live",
      shouldSpeak: true,
      speakMoment: "post-fight",
      usedScan: true,
      nextMove: "third-party",
      spokenLine: english
        ? `${input.rank} ${input.character}, scan shows two squads west. Ring 4, 40 seconds left. Third-party now. Do not dive the front fight.`
        : `${input.rank}の${input.character}、スキャンで西に2隊。第4リング残り40秒。今は漁夫。正面の撃ち合いに飛び込むな。`,
      headline: english ? `${input.character} live · ${input.rank}` : `${input.character} ライブ · ${input.rank}`,
      summary: english
        ? `${input.rank} ${input.character}. Next move uses the survey-beacon scan, zone, and time. Focus: ${concern}.`
        : `${input.rank}の${input.character}。調査ビーコンの敵位置とアンチ残りを使った次の一手。悩み「${concern}」。`,
      insights: [
        {
          id: "scan-next",
          tab: "rotation",
          timestamp: "now",
          title: "スキャンの西2隊を見て漁夫する",
          finding: `調査ビーコンで西に2隊。第4リング残り40秒。正面の撃ち合いに入ると第3の的。`,
          action: "西の撃ち合いが落ちてから入る。ゾーン内側の岩で待つ。",
        },
      ],
      mapPoi: serializeApexPoi(explicitApexPoi(input)),
    };
  }
  if ((input.recentCues?.length ?? 0) > 0) {
    return {
      analysisId: crypto.randomUUID(),
      game: input.game,
      character: input.character,
      kind: "live",
      shouldSpeak: false,
      skipReason: "同じ局面の繰り返し",
      spokenLine: "",
      headline: `${input.character} 注視中 · ${input.rank}`,
      summary: `${input.rank}の${input.character}。直近と同じ判断局面なので話しません。`,
      insights: [],
    };
  }
  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: "live",
    shouldSpeak: true,
    speakMoment: isApex ? "mid-range" : "standoff",
    usedScan: false,
    nextMove: "disengage",
    spokenLine: english
      ? isApex
        ? `${input.rank} ${input.character}, two sightlines at mid-range. Space inside the ring. Cut and go to the rock. Pushing is third-party bait.`
        : `${input.rank} ${input.character}, you swung with heaven still open. Back to the wall. Close only after one angle.`
      : isApex
        ? `${input.rank}の${input.character}、中距離で2射線開いてる。アンチ内にスペースある。今は切って岩へ。押しは漁夫の的。`
        : `${input.rank}の${input.character}、heaven残したままスイングしてる。今は壁へ戻れ。詰めはアングル1本にしてから。`,
    headline: english ? `${input.character} live · ${input.rank}` : `${input.character} ライブ · ${input.rank}`,
    summary: english
      ? isApex
        ? `${input.rank} ${input.character}. Mid-range standoff. Two sightlines, space inside zone, so disengage has the EV. Focus: ${concern}.`
        : `${input.rank} ${input.character}. Standoff. Heaven is still open, so one angle off the wall has the EV. Focus: ${concern}.`
      : isApex
        ? `${input.rank}の${input.character}。中距離の膠着。射線が2本、ゾーン内に逃げ場があるので離脱の方が期待値が高い。悩み「${concern}」。`
        : `${input.rank}の${input.character}。膠着。heavenが残っているので壁に戻して1アングルだけ切る方が期待値が高い。悩み「${concern}」。`,
    insights: [
      {
        id: "now-peek",
        tab: "endgame",
        timestamp: "now",
        title: isApex ? "中距離は切って岩へ戻す" : "壁へ戻して1アングルだけ切る",
        finding: isApex
          ? `${input.character}のレティクルがオープンを向いたまま、味方のトレード射程の外。第3の射線が右に残る。ゾーン内に遮蔽がある。`
          : `${input.character}のクロスヘアが広いスイングの途中で heaven が残っている。見えている情報では1ラインだけ切る方が高い。`,
        action: isApex
          ? "スライドを止めて岩に張り、見える敵が1人になってから腰撃ち。拡張は他隊の射線が消えてから。"
          : "2歩下がって壁でheavenを隠し、止まって2発だけ撃つ。キル結果ではなく開いたアングル数で評価する。",
      },
    ],
    mapPoi: serializeApexPoi(explicitApexPoi(input)),
  };
}

function buildClipFights(
  input: CoachRequest,
  hasVideo: boolean,
  isApex: boolean,
  english: boolean,
): CloseRangeFight[] {
  if (!hasVideo) return [];
  const who = english ? `${input.rank} ${input.character}` : `${input.rank}の${input.character}`;
  if (english) {
    return [
      {
        id: "scrap-1",
        start: "00:10",
        end: "00:18",
        title: isApex ? "Front door peek instead of the off-angle" : "Swings heaven with the off-angle empty",
        sightlines: `${who} at 00:12. Off-angle sits on the right rock lip (a step, not stairs). You take the front peek. Enemy owns that peek. Cover is one step left. Teammates can trade only the left line. Name off-screen cover only when it raises win rate in this fight.`,
        knowHow: "Reset to one body visible. Utility before the swing. Shoot door first, then the cover player. A knock is not a kill — thirst, reset, or third-party. Gun stays unnamed unless the HUD is readable.",
      },
    ];
  }
  return [
    {
      id: "scrap-1",
      start: "00:10",
      end: "00:18",
      title: isApex ? "岩右のオフアングルを捨てて正面ピーク" : "オフアングルを空にしてheavenを開く",
      sightlines: `00:12、${who}。岩の右は段差（リップ）で階段ではない。オフアングルがあるのに正面を開いている。ピークの権利は正面の敵。カバーは左へ1歩。味方がトレードできるのは左の1本だけ。画面外カバーは、今の局面で勝率が上がるときだけ。`,
      knowHow: "見える体を1人に削ってから出せ。タクティカルはスイング前。撃つ順はドア→カバー側。ノックはキルではない。確殺／リセット／漁夫を選べ。HUDが読めていない銃の固有名は書くな。",
    },
  ];
}

function buildChunkFights(input: CoachRequest, start: number, isApex: boolean): CloseRangeFight[] {
  const who = `${input.rank}の${input.character}`;
  const from = formatTimestamp(start + 4);
  const to = formatTimestamp(start + 12);
  return [
    {
      id: `scrap-${from}`,
      start: from,
      end: to,
      title: isApex ? "段差を捨てて2本の斜線を同時に開く" : "壁を離れて2アングルを同時に開く",
      sightlines: `${from}、${who}が段差（リップ）を離れた瞬間に左右が開く。階段ではない。ピークは奥の敵。オフアングルは左端に残っているのに使っていない。`,
      knowHow: "左端の段差へ張り、見える敵を1人にしてからスライド。ユーティリティは出す3秒前。撃つ順はピークを持っている側から。ノックしたら確殺かリセットか漁夫を選べ。キル扱いするな。",
    },
  ];
}

function buildInsights(
  input: CoachRequest,
  hasVideo: boolean,
  isApex: boolean,
  purpose: string,
  english = false,
): CoachInsight[] {
  const who = english ? `${input.rank} ${input.character}` : `${input.rank}の${input.character}`;
  if (english) {
    return [
      {
        id: "crosshair-drop",
        tab: "aim",
        timestamp: hasVideo ? "00:12" : undefined,
        title: isApex ? "The first shot window collapses" : "Crosshair drops before the burst",
        finding: `${who}. Purpose "${purpose}". The first correction after the slide costs the duel.`,
        action: "Pin the reticle at chest height, then one small lift after you stop.",
      },
      {
        id: "two-angles",
        tab: "rotation",
        timestamp: hasVideo ? "00:18" : undefined,
        title: "You open two sightlines at once",
        finding: `${who} swings wide enough that teammates can only trade one angle.`,
        action: "Hold the left edge, cut one angle, then move after the trade.",
      },
    ];
  }
  if (hasVideo) {
    return [
      {
        id: "crosshair-drop",
        tab: "aim",
        timestamp: "00:12",
        title: isApex ? "撃ちの間合いが先に崩れる" : "最初のバースト前にクロスヘアが落ちる",
        finding: isApex
          ? `クリップ12秒付近、${who}のスライド後にレティクルが足元へ落ちています。目的「${purpose}」に対して、最初の弾の修正時間が負けの原因です。`
          : `クリップ12秒付近、${who}がチョークに入るときにヘッドラインを外しています。目的「${purpose}」なら、止まる前の縦修正をなくします。`,
        action: isApex
          ? "スライド中は胸の高さでレティクルを固定し、着地後に一度だけ小さく上げてから撃つ。"
          : "壁のヘッドラインを目でなぞってからストレイフし、完全に止まって2発だけ撃つ。",
      },
      {
        id: "two-angles",
        tab: "rotation",
        timestamp: "00:18",
        title: isApex ? "立ち回りで射線を2本同時に開いている" : "スイングで2アングルを同時に開いている",
        finding: isApex
          ? `${who}のワイドスイングが岩とドアを同時にクリアしており、味方がトレードできるのは片方だけです。立ち回りを1アングルに削ります。`
          : `${who}の経路がheavenとバックサイトを同時に開いています。プレイスタイルを「切ってから取る」に寄せます。`,
        action: isApex
          ? "左端に張り、ドア側を先に切り、味方が岩を取ってから動く。"
          : "手前の壁でheavenを隠し、味方とバックサイトを掃いてから縦を開き直す。",
      },
      {
        id: "util-window",
        tab: "abilities",
        timestamp: "00:24",
        title: isApex ? "スキルが立ち回りに乗っていない" : "スキルがエントリーのプレイスタイルに遅れる",
        finding: isApex
          ? `${input.character}のタクティカルがアーマー割れ後になっており、アルティメットも交戦を形作れていません。${input.rank}では先にスキルを置いた側が勝ちます。`
          : `${input.character}のシグネチャーが撃ち合い開始後です。アルティメットがサイトテイクの窓を逃しています。`,
        action: isApex
          ? "オープンを渡る前にタクティカル。チームがコミットする3秒前にアルティメットを宣言する。"
          : "突入3秒前にスキルをコールし、イニシエーターと重ね、プラント確保のためにアルティメットを使う。",
      },
    ];
  }

  return [
    {
      id: "crosshair-drop",
      tab: "aim",
      title: isApex ? `${input.rank}帯でクロスヘアが落ちる` : `${input.rank}帯でヘッドラインを外す`,
      finding: isApex
        ? `${input.character}の近接では、スライドやストレイフ中にレティクルが足元へ落ちやすいです。目的「${purpose}」は、最初の弾の前の修正時間として現れます。`
        : `${input.character}でエントリーするとき、移動中にクロスヘアがヘッドの高さから外れます。目的「${purpose}」は、最初のバースト前の縦修正として現れます。`,
      action: isApex
        ? "遮蔽を出る前に胸の高さへレティクルを置き、スライド後は一度だけ小さく上げてから撃つ。"
        : "壁のヘッドラインを目でなぞってからストレイフし、完全に止まって2発だけ撃つ。",
    },
    {
      id: "two-angles",
      tab: "rotation",
      title: isApex ? "立ち回りで遮蔽を離れて2本の射線を晒す" : "立ち回りで2アングルを同時に開く",
      finding: isApex
        ? `${input.rank}の近接では、岩やドアから離れすぎると敵2人に同時に撃たれます。${input.character}でも、味方は片方しかトレードできません。`
        : `${input.rank}のサイトでは、広いスイングがheavenとバックサイトを同時に開きます。${input.character}の味方がトレードできるのは片方だけです。`,
      action: isApex
        ? "左端に張り、ドア側を先に切り、味方が岩側を取ってから動く。"
        : "手前の壁でheavenを隠し、味方とバックサイトを掃いてから縦アングルを開き直す。",
    },
    {
      id: "util-window",
      tab: "abilities",
      title: isApex ? "プレイスタイルより先にスキルが終わる" : "プレイスタイルよりスキルが遅い",
      finding: isApex
        ? `${input.character}のタクティカルをアーマーが割れてから使うと、アルティメットも交戦を形作れません。${input.rank}では先にスキルを置いた側が勝ちます。`
        : `${input.character}のシグネチャーが撃ち合い開始後だと、アルティメットが一番おいしいサイトテイクの窓を逃します。`,
      action: isApex
        ? "オープンを渡る前にタクティカルを使い、チームがコミットする3秒前にアルティメットを宣言する。"
        : "突入3秒前にスキルをコールし、イニシエーターと重ね、プラント確保のためにアルティメットを使う。",
    },
  ];
}

export const videoCoachProvider: VideoCoachProvider = new MockVideoCoachProvider();
