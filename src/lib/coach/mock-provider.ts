import type { CoachInsight, CoachRequest, CoachResponse, VideoCoachProvider } from "./types";
import { requestHasClip } from "./types";

class MockVideoCoachProvider implements VideoCoachProvider {
  async analyze(input: CoachRequest): Promise<CoachResponse> {
    await new Promise((resolve) => setTimeout(resolve, 3600));
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
