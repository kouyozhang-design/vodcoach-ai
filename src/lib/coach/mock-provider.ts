import type { CoachInsight, CoachRequest, CoachResponse, VideoCoachProvider } from "./types";

class MockVideoCoachProvider implements VideoCoachProvider {
  async analyze(input: CoachRequest): Promise<CoachResponse> {
    // Simulates provider latency. Replace this class with a GPT-4o or Gemini adapter.
    await new Promise((resolve) => setTimeout(resolve, 3600));
    return buildCoachResponse(input);
  }
}

function buildCoachResponse(input: CoachRequest): CoachResponse {
  const hasVideo = Boolean(input.video);
  const isApex = input.game === "apex-legends";
  const concern = input.concern.trim();

  return {
    analysisId: crypto.randomUUID(),
    game: input.game,
    character: input.character,
    headline: hasVideo
      ? `${input.character} VOD review · ${input.rank}`
      : `${input.character} coaching plan · ${input.rank}`,
    summary: hasVideo
      ? isApex
        ? `Clip review for ${input.rank} ${input.character}: your mechanics are ready for the next rank. The biggest gain is keeping your crosshair and cover plan stable while you sequence utility around your squad. Focus: “${concern}”.`
        : `Clip review for ${input.rank} ${input.character}: first-shot discipline is solid. The next gain comes from holding head level through movement, isolating one angle, and pairing utility with the team’s site timing. Focus: “${concern}”.`
      : isApex
        ? `${input.rank} ${input.character}向けのノートコーチングです。動画なしでも、近接の撃ち合い・遮蔽の使い方・アビリティの順番を次の試合で試せる形に落としています。悩み: “${concern}”。`
        : `${input.rank} ${input.character}向けのノートコーチングです。動画なしでも、ヘッドラインの維持、アングルの切り方、サイトタイミングに合わせたスキルを4項目に整理しました。悩み: “${concern}”。`,
    insights: buildInsights(input, hasVideo, isApex, concern),
  };
}

function buildInsights(
  input: CoachRequest,
  hasVideo: boolean,
  isApex: boolean,
  concern: string,
): CoachInsight[] {
  if (hasVideo) {
    return [
      {
        id: "aim",
        timestamp: "00:12",
        title: isApex ? "Your crosshair drops during the slide" : "Your crosshair drops before contact",
        finding: isApex
          ? `At 12 seconds in the clip, you look toward the floor before the close-range re-peek as ${input.character}. That adds a visible correction before your first shot — matching “${concern}”.`
          : `At 12 seconds in the clip, your crosshair falls below head level while ${input.character} enters the choke. You must correct vertically before the first burst — matching “${concern}”.`,
        action: isApex
          ? "Keep the reticle at chest height through the slide, then make one small vertical correction after the animation ends."
          : "Trace the head-height line on the wall before you strafe out, then stop fully for a two-bullet burst.",
      },
      {
        id: "positioning",
        timestamp: "00:18",
        title: isApex ? "You expose two enemy sightlines" : "The swing opens two defender angles",
        finding: isApex
          ? "The wide swing clears the rock and doorway together, so both opponents can damage you while your squad sees only one."
          : "Your path exposes heaven and back site at once, while your closest teammate can only trade the back-site duel.",
        action: isApex
          ? "Hug the left edge, isolate the doorway first, and move only after your teammate takes the rock angle."
          : "Use the near wall to hide heaven, clear back site with your teammate, then reopen the vertical angle.",
      },
      {
        id: "abilities",
        timestamp: "00:24",
        title: isApex ? "Utility arrives after the advantage" : "Utility misses the entry timing",
        finding: isApex
          ? `Your ${input.character} tactical is held until armor is already broken, and the ultimate never shapes the fight.`
          : `${input.character}’s signature is used after the first duel begins, and the ultimate is held through the best site-take window.`,
        action: isApex
          ? "Use tactical before crossing the open lane; call the ultimate three seconds before the squad commits so everyone can play its timing."
          : "Call utility three seconds before entry, layer it with the initiator, and spend the ultimate when it secures the plant—not only for kills.",
      },
      {
        id: "practice",
        title: "18-minute improvement circuit",
        finding: `Built from the uploaded clip and your goal: “${concern}”`,
        action: isApex
          ? "6m hip-fire tracking while strafing · 6m cover peeks with a one-target rule · 6m tactical-to-ultimate sequencing with spoken calls."
          : "6m head-height pathing in a custom map · 6m stop-and-burst range reps · 6m utility-to-entry timing with one spoken call.",
      },
    ];
  }

  return [
    {
      id: "aim",
      title: isApex ? `${input.rank}帯でクロスヘアが落ちる` : `${input.rank}帯でヘッドラインを外す`,
      finding: isApex
        ? `${input.character}の近接では、スライドやストレイフ中にレティクルが足元へ落ちやすいです。悩みの「${concern}」は、最初の弾を撃つ前の修正時間として現れます。`
        : `${input.character}でエントリーするとき、移動中にクロスヘアがヘッドの高さから外れます。「${concern}」は、最初のバースト前の縦修正として現れます。`,
      action: isApex
        ? "遮蔽を出る前に胸の高さへレティクルを置き、スライド後は一度だけ小さく上げてから撃つ。"
        : "壁のヘッドラインを目でなぞってからストレイフし、完全に止まって2発だけ撃つ。",
    },
    {
      id: "positioning",
      title: isApex ? "遮蔽を離れて2本の射線を晒す" : "スイングで2アングルを同時に開く",
      finding: isApex
        ? `${input.rank}の近接では、岩やドアから離れすぎると敵2人に同時に撃たれます。${input.character}でも、味方は片方しかトレードできません。`
        : `${input.rank}のサイトでは、広いスイングがheavenとバックサイトを同時に開きます。${input.character}の味方がトレードできるのは片方だけです。`,
      action: isApex
        ? "左端に張り、ドア側を先に切り、味方が岩側を取ってから動く。"
        : "手前の壁でheavenを隠し、味方とバックサイトを掃いてから縦アングルを開き直す。",
    },
    {
      id: "abilities",
      title: isApex ? "スキルが有利を作る前に終わる" : "スキルがエントリーに間に合わない",
      finding: isApex
        ? `${input.character}のタクティカルをアーマーが割れてから使うと、アルティメットも交戦を形作れません。${input.rank}では先にスキルを置いた側が勝ちます。`
        : `${input.character}のシグネチャーが撃ち合い開始後だと、アルティメットが一番おいしいサイトテイクの窓を逃します。`,
      action: isApex
        ? "オープンを渡る前にタクティカルを使い、チームがコミットする3秒前にアルティメットを宣言する。"
        : "突入3秒前にスキルをコールし、イニシエーターと重ね、キルのためではなくプラント確保のためにアルティメットを使う。",
    },
    {
      id: "practice",
      title: "18分の改善サーキット",
      finding: `動画なしのノートプラン。入力された悩みに合わせています: “${concern}”`,
      action: isApex
        ? "6分 ストレイフしながらの腰撃ちトラッキング · 6分 遮蔽ピークは1ターゲット · 6分 タクティカル→アルティメットを声に出してつなぐ。"
        : "6分 カスタムでのヘッドハイト移動 · 6分 止まってバースト · 6分 スキルからエントリーまでを一声で合わせる。",
    },
  ];
}

export const videoCoachProvider: VideoCoachProvider = new MockVideoCoachProvider();
