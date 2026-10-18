import { formatTimestamp, shiftTimestamp } from "@/lib/match-plan";
import type { CoachInsight, CoachRequest, CoachResponse, VideoCoachProvider } from "./types";
import { requestHasClip, resolveCoachMode } from "./types";

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

function buildCoachResponse(input: CoachRequest): CoachResponse {
  const hasVideo = requestHasClip(input);
  const isApex = input.game === "apex-legends";
  const purpose = purposeOf(input, hasVideo);

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: hasVideo ? "clip" : "notes",
    headline: hasVideo
      ? `${input.character} クリップ診断 · ${input.rank}`
      : `${input.character} コーチング · ${input.rank}`,
    summary: hasVideo
      ? isApex
        ? `${input.rank} ${input.character}のクリップから、立ち回り・撃ち合いの間合い・スキルの順番を整理しました。目的: 「${purpose}」。`
        : `${input.rank} ${input.character}のクリップから、サイトの切り方・ヘッドライン・スキルタイミングを整理しました。目的: 「${purpose}」。`
      : isApex
        ? `${input.rank} ${input.character}向けのノートコーチングです。近接の撃ち合い、遮蔽の使い方、アビリティの順番を次の試合用に落としています。目的: 「${purpose}」。`
        : `${input.rank} ${input.character}向けのノートコーチングです。ヘッドライン、アングルの切り方、サイトタイミングを4項目にしました。目的: 「${purpose}」。`,
    insights: buildInsights(input, hasVideo, isApex, purpose),
  };
}

function buildMatchChunkResponse(input: CoachRequest): CoachResponse {
  const start = input.startOffsetSec ?? 0;
  const end = input.endOffsetSec ?? start + 40;
  const isApex = input.game === "apex-legends";
  const mid = (start + end) / 2;
  const insights: CoachInsight[] = [
    {
      id: "fight-open",
      timestamp: shiftTimestamp(formatTimestamp(start + 4), start, end),
      title: isApex ? "遮蔽を離れて最初の射線を2本開いている" : "チョーク前にクロスヘアがヘッドから落ちる",
      finding: isApex
        ? `${formatTimestamp(start + 4)}付近、${input.character}が岩から離れた瞬間に左右から撃たれています。`
        : `${formatTimestamp(start + 4)}付近、${input.character}のクロスヘアが壁のヘッドラインを外したままスイングしています。`,
      action: isApex
        ? "出る前に岩の左端へ張り直し、見える敵を1人に減らしてからスライドする。"
        : "壁のヘッドラインを目で固定してから、2歩だけスイングして止まる。",
    },
    {
      id: "trade",
      timestamp: shiftTimestamp(formatTimestamp(mid), start, end),
      title: isApex ? "トレード距離が味方から切れている" : "エントリーが孤立してサイトの2アングルを同時に開く",
      finding: `${formatTimestamp(mid)}、${input.rank}帯では味方が撃てない位置まで単独で伸びています。`,
      action: isApex
        ? "味方の射線が通るまでワイドスイングしない。先にコールしてから1歩だけ出す。"
        : "手前の壁でheavenを隠し、味方のフラッシュ後に1アングルだけ切る。",
    },
    {
      id: "util",
      timestamp: shiftTimestamp(formatTimestamp(Math.max(start, end - 8)), start, end),
      title: isApex ? "タクティカルが撃ち合いの後になっている" : "スキルがサイトテイクの窓に間に合っていない",
      finding: `${input.character}のスキルがこの区間の終盤まで残っています。先に置いた側が勝ちます。`,
      action: isApex
        ? "オープンを渡る3秒前にタクティカル。アルティメットはチームがコミットする声と同時。"
        : "突入コールの3秒前にシグネチャー。プラント確保の窓でアルティメットを使う。",
    },
    {
      id: "reset",
      timestamp: shiftTimestamp(formatTimestamp(end - 2), start, end),
      title: "リセットせず次のピークに入っている",
      finding: "ダウン後の情報を待たず、同じ角度をもう一度開いています。",
      action: "一度引き、足音と能力の有無を数えてから別の角度で出直す。",
    },
  ];

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: "match",
    headline: `${input.character} 区間 ${formatTimestamp(start)}–${formatTimestamp(end)}`,
    summary: `${input.rank} ${input.character}のこの時間帯から、撃ち合い・位置・スキルの具体的な場面を拾いました。`,
    insights,
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
  const insights: CoachInsight[] = [];
  for (const report of reports) {
    for (const insight of report.insights ?? []) {
      insights.push({
        ...insight,
        id: insight.id || `scene-${insights.length + 1}`,
      });
      if (insights.length >= 16) break;
    }
    if (insights.length >= 16) break;
  }
  if (insights.length === 0) {
    insights.push(...buildMatchChunkResponse({ ...input, startOffsetSec: 0, endOffsetSec: 40 }).insights);
  }
  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: "match",
    headline: `${input.character} 試合一本診断 · ${input.rank}`,
    summary: `${input.rank}の${input.character}について、試合を時間分割して解析し、タイムスタンプ付きの指摘を1つのレポートにまとめました。${
      input.durationSec ? `対象の長さは約 ${formatTimestamp(input.durationSec)} です。` : ""
    }`,
    insights,
    durationSec: input.durationSec,
  };
}

function buildLiveResponse(input: CoachRequest): CoachResponse {
  const isApex = input.game === "apex-legends";
  const black = (input.frames?.length ?? 0) === 0;
  if (black) {
    return {
      analysisId: crypto.randomUUID(),
      game: input.game,
      character: input.character,
      kind: "live",
      headline: "画面を待っています",
      summary:
        "共有フレームが届いていません。ゲームウィンドウを選び、チート対策で黒画面になっていないか確認してください。",
      insights: [
        {
          id: "wait",
          timestamp: "now",
          title: "キャプチャ待ち",
          finding: "ライブコーチはブラウザの画面共有に依存します。ゲーム内HUDへは何も重ねません。",
          action: "ボーダーレスまたはウィンドウ表示にして、ゲームの画面を共有し直してください。",
        },
      ],
    };
  }
  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    kind: "live",
    headline: `${input.character} ライブ · ${input.rank}`,
    summary: isApex
      ? "今の画面では射線が広がりすぎています。次の数秒は遮蔽に戻してから1人だけ見てください。"
      : "今の画面では2アングルが同時に開いています。壁に戻してから1ラインだけ切ってください。",
    insights: [
      {
        id: "now-peek",
        timestamp: "now",
        title: isApex ? "今すぐ岩の左端へ戻る" : "今すぐオフアングルへ戻る",
        finding: isApex
          ? `${input.character}のレティクルがオープンを向いたまま、味方がトレードできない位置にいます。`
          : `${input.character}のクロスヘアが広いスイングの途中で、heaven側が残っています。`,
        action: isApex
          ? "スライドを止めて岩に張り、見える敵が1人になってから腰撃ち。"
          : "2歩下がって壁でheavenを隠し、止まって2発だけ撃つ。",
      },
      {
        id: "now-util",
        timestamp: "now",
        title: "スキルを先に置く",
        finding: `${input.character}のスキルが見えていません。このランクでは先に置いた側が勝ちます。`,
        action: isApex
          ? "次の移動の前にタクティカル。アルティメットはチームがコミットしてから。"
          : "次のピークの前にシグネチャー。サイトを取る窓でのみアルティメット。",
      },
      {
        id: "now-info",
        timestamp: "now",
        title: "情報を数えてから出る",
        finding: "ミニマップと音を待たず、同じ角度を開き直そうとしています。",
        action: "1秒止まって足音と人数を数えてから、別の角度で出す。",
      },
    ],
  };
}

function buildInsights(
  input: CoachRequest,
  hasVideo: boolean,
  isApex: boolean,
  purpose: string,
): CoachInsight[] {
  const who = `${input.rank}の${input.character}`;
  if (hasVideo) {
    return [
      {
        id: "aim",
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
        id: "positioning",
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
        id: "abilities",
        timestamp: "00:24",
        title: isApex ? "スキルが立ち回りに乗っていない" : "スキルがエントリーのプレイスタイルに遅れる",
        finding: isApex
          ? `${input.character}のタクティカルがアーマー割れ後になっており、アルティメットも交戦を形作れていません。${input.rank}では先にスキルを置いた側が勝ちます。`
          : `${input.character}のシグネチャーが撃ち合い開始後です。アルティメットがサイトテイクの窓を逃しています。`,
        action: isApex
          ? "オープンを渡る前にタクティカル。チームがコミットする3秒前にアルティメットを宣言する。"
          : "突入3秒前にスキルをコールし、イニシエーターと重ね、プラント確保のためにアルティメットを使う。",
      },
      {
        id: "practice",
        title: "目的に合わせた18分サーキット",
        finding: `クリップ診断の練習メニュー。目的: 「${purpose}」`,
        action: isApex
          ? "6分 ストレイフ腰撃ち · 6分 遮蔽ピークは1ターゲット（立ち回り） · 6分 タクティカル→アルティメットを声に出してつなぐ。"
          : "6分 ヘッドハイト移動 · 6分 止まってバースト · 6分 スキルからエントリーまでを一声で合わせる。",
      },
    ];
  }

  return [
    {
      id: "aim",
      title: isApex ? `${input.rank}帯でクロスヘアが落ちる` : `${input.rank}帯でヘッドラインを外す`,
      finding: isApex
        ? `${input.character}の近接では、スライドやストレイフ中にレティクルが足元へ落ちやすいです。目的「${purpose}」は、最初の弾の前の修正時間として現れます。`
        : `${input.character}でエントリーするとき、移動中にクロスヘアがヘッドの高さから外れます。目的「${purpose}」は、最初のバースト前の縦修正として現れます。`,
      action: isApex
        ? "遮蔽を出る前に胸の高さへレティクルを置き、スライド後は一度だけ小さく上げてから撃つ。"
        : "壁のヘッドラインを目でなぞってからストレイフし、完全に止まって2発だけ撃つ。",
    },
    {
      id: "positioning",
      title: isApex ? "立ち回りで遮蔽を離れて2本の射線を晒す" : "立ち回りで2アングルを同時に開く",
      finding: isApex
        ? `${input.rank}の近接では、岩やドアから離れすぎると敵2人に同時に撃たれます。${input.character}でも、味方は片方しかトレードできません。`
        : `${input.rank}のサイトでは、広いスイングがheavenとバックサイトを同時に開きます。${input.character}の味方がトレードできるのは片方だけです。`,
      action: isApex
        ? "左端に張り、ドア側を先に切り、味方が岩側を取ってから動く。"
        : "手前の壁でheavenを隠し、味方とバックサイトを掃いてから縦アングルを開き直す。",
    },
    {
      id: "abilities",
      title: isApex ? "プレイスタイルより先にスキルが終わる" : "プレイスタイルよりスキルが遅い",
      finding: isApex
        ? `${input.character}のタクティカルをアーマーが割れてから使うと、アルティメットも交戦を形作れません。${input.rank}では先にスキルを置いた側が勝ちます。`
        : `${input.character}のシグネチャーが撃ち合い開始後だと、アルティメットが一番おいしいサイトテイクの窓を逃します。`,
      action: isApex
        ? "オープンを渡る前にタクティカルを使い、チームがコミットする3秒前にアルティメットを宣言する。"
        : "突入3秒前にスキルをコールし、イニシエーターと重ね、プラント確保のためにアルティメットを使う。",
    },
    {
      id: "practice",
      title: "目的に合わせた18分サーキット",
      finding: `ノートプラン。目的: 「${purpose}」`,
      action: isApex
        ? "6分 ストレイフ腰撃ち · 6分 遮蔽ピークは1ターゲット · 6分 タクティカル→アルティメットを声に出してつなぐ。"
        : "6分 ヘッドハイト移動 · 6分 止まってバースト · 6分 スキルからエントリーまでを一声で合わせる。",
    },
  ];
}

export const videoCoachProvider: VideoCoachProvider = new MockVideoCoachProvider();
