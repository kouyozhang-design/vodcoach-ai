export const COACH_LANGUAGES = ["ja", "en"] as const;
export type CoachLanguage = (typeof COACH_LANGUAGES)[number];
export const DEFAULT_COACH_LANGUAGE: CoachLanguage = "ja";
export const COACH_LANGUAGE_STORAGE_KEY = "vodcoach.language";

export function parseCoachLanguage(value: unknown): CoachLanguage {
  if (typeof value !== "string") return DEFAULT_COACH_LANGUAGE;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "en" || trimmed === "english") return "en";
  if (trimmed === "ja" || trimmed === "jp" || trimmed === "japanese" || trimmed === "日本語") {
    return "ja";
  }
  return DEFAULT_COACH_LANGUAGE;
}

export function readStoredLanguage(): CoachLanguage {
  if (typeof window === "undefined") return DEFAULT_COACH_LANGUAGE;
  try {
    return parseCoachLanguage(window.localStorage.getItem(COACH_LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_COACH_LANGUAGE;
  }
}

export function writeStoredLanguage(language: CoachLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COACH_LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveCoachLanguage(input: { language?: unknown }): CoachLanguage {
  return parseCoachLanguage(input.language);
}

export function languageInstruction(language: CoachLanguage) {
  if (language === "en") {
    return "Write every user-facing string in English: headline, summary, spokenLine, insight title/finding/action, rotation notes, rotationStory, closeRangeFights title/sightlines/knowHow. JSON keys stay English. Tone: sharp and funny. Short sentences. Same pro-team bar. No generic slogans. Name a gun only when the HUD or model is readable. A lip/headglitch is not stairs. An Apex knock is not a kill — finish, reset, or third-party. Name off-screen cover only when using it raises win rate in the fight in front of the player — not every off-screen object, and not only when it is already on camera. When Apex map+POI is identified, treat the supplied POI geometry as fact. If it is not identified, do not invent a layout.";
  }
  return "ユーザー向け文字列はすべて日本語。headline, summary, spokenLine, insight の title/finding/action, rotation, rotationStory, closeRangeFights の title/sightlines/knowHow。JSONキーは英語のまま。口調は辛口で面白い。短文。プロチームの過程と期待値。汎用スローガン禁止。武器名はHUDかモデルが読めたときだけ。段差と階段を取り違えるな。Apexのノックはキルではない。確殺／リセット／漁夫を選べ。画面外カバーは、今の局面で勝率が上がるときだけ出せ。画面に無いから出さない、は禁止。ApexでマップとPOIが特定できたらリファレンスの間取りは事実。特定できなければ間取りを作るな。";
}

export function fightChrome(language: CoachLanguage) {
  if (language === "en") {
    return {
      heading: "Close-range scraps",
      hint: "Tap a fight for fine sightlines and in-fight choices. Collapsed so the board stays short.",
      sightlines: "Fine sightline work",
      knowHow: "In-fight know-how",
      noMedia: "No local clip left. Still shots come from the playable URL if we have one.",
      loading: "Grabbing frames from this scrap",
    };
  }
  return {
    heading: "近距離の撃ち合い",
    hint: "タップすると、そのスクラップだけの細かい斜線管理と戦闘のノウハウを開きます。最初は畳んであります。",
    sightlines: "細かい斜線管理",
    knowHow: "戦闘のノウハウ",
    noMedia: "手元の動画が残っていません。再生できるURLがあれば、そこから静止画を切ります。",
    loading: "このスクラップから切り出し中",
  };
}

export function speechLocale(language: CoachLanguage) {
  return language === "en" ? "en-US" : "ja-JP";
}

export function insightTabLabel(
  tab: "rotation" | "aim" | "abilities" | "endgame" | "other",
  language: CoachLanguage,
) {
  if (language === "en") {
    const labels = {
      rotation: "Pathing / rotate",
      aim: "Aim",
      abilities: "Abilities",
      endgame: "Close / endgame",
      other: "Other",
    };
    return labels[tab];
  }
  const labels = {
    rotation: "立ち回り/回転",
    aim: "エイム",
    abilities: "スキル",
    endgame: "詰め/終盤",
    other: "その他",
  };
  return labels[tab];
}

export function liveChrome(language: CoachLanguage) {
  if (language === "en") {
    return {
      speakingNow: "Speaking now",
      watching: "Watching",
      voiceCoach: "Voice coach",
      startShare: "Share screen and start voice",
      stopShare: "Stop sharing",
      gesture: "Click the button below to unlock audio. The browser will not speak without that click.",
      keepEyesOnGame: "Keep your eyes on the match. Just listen.",
      stayQuietMidFight: "Reading the screen. Mid-fight I stay quiet unless it is one short call.",
      onlyPostFight: "I only talk after a scrap or in a standoff close.",
    };
  }
  return {
    speakingNow: "いま話しています",
    watching: "注視中",
    voiceCoach: "音声コーチ",
    startShare: "画面共有して音声を開始",
    stopShare: "共有を止める",
    gesture: "音声を出すには、下のボタンを押してください。ブラウザは操作なしでは話しません。",
    keepEyesOnGame: "試合から目を離さないでください。声だけ拾えばいいです。",
    stayQuietMidFight: "画面を読んでいます。撃ち合いの最中は、短い一言以外は黙ります。",
    onlyPostFight: "膠着の詰めと、戦闘後のレビューだけ話します。",
  };
}

export function viralChrome(language: CoachLanguage) {
  if (language === "en") {
    return {
      heading: "Shorts script",
      copy: "Copy",
      copied: "Copied",
    };
  }
  return {
    heading: "バズる台本",
    copy: "コピー",
    copied: "コピーした",
  };
}

export function shareChrome(language: CoachLanguage) {
  if (language === "en") {
    return {
      label: "Share on X (Twitter)",
      hint: "Opens X with a short summary of this advice.",
    };
  }
  return {
    label: "X（旧Twitter）にシェアする",
    hint: "この指摘の短い要約をXの投稿画面に入れます。",
  };
}
