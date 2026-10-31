export const COACH_LANGUAGES = [
  "en",
  "ja",
  "pt",
  "ko",
  "de",
  "fr",
  "es",
  "pl",
  "zh-TW",
  "tr",
  "it",
  "id",
] as const;

export type CoachLanguage = (typeof COACH_LANGUAGES)[number];
export const DEFAULT_COACH_LANGUAGE: CoachLanguage = "ja";
export const COACH_LANGUAGE_STORAGE_KEY = "vodcoach.language";

/** Native names, in picker order. Japanese stays the default even though English is listed first. */
export const LANGUAGE_LABELS: Record<CoachLanguage, string> = {
  en: "English",
  ja: "日本語",
  pt: "Português",
  ko: "한국어",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  pl: "Polski",
  "zh-TW": "繁體中文",
  tr: "Türkçe",
  it: "Italiano",
  id: "Bahasa Indonesia",
};

const LANGUAGE_ENGLISH_NAMES: Record<CoachLanguage, string> = {
  en: "English",
  ja: "Japanese",
  pt: "Portuguese",
  ko: "Korean",
  de: "German",
  fr: "French",
  es: "Spanish",
  pl: "Polish",
  "zh-TW": "Traditional Chinese",
  tr: "Turkish",
  it: "Italian",
  id: "Indonesian",
};

const LANGUAGE_ALIASES: Record<string, CoachLanguage> = {
  en: "en",
  english: "en",
  ja: "ja",
  jp: "ja",
  japanese: "ja",
  日本語: "ja",
  pt: "pt",
  "pt-br": "pt",
  "pt-pt": "pt",
  portuguese: "pt",
  portugues: "pt",
  português: "pt",
  ko: "ko",
  kr: "ko",
  korean: "ko",
  한국어: "ko",
  de: "de",
  german: "de",
  deutsch: "de",
  fr: "fr",
  french: "fr",
  francais: "fr",
  français: "fr",
  es: "es",
  spanish: "es",
  espanol: "es",
  español: "es",
  pl: "pl",
  polish: "pl",
  polski: "pl",
  "zh-tw": "zh-TW",
  "zh-hant": "zh-TW",
  zhtw: "zh-TW",
  "traditional-chinese": "zh-TW",
  繁體中文: "zh-TW",
  tr: "tr",
  turkish: "tr",
  turkce: "tr",
  türkçe: "tr",
  it: "it",
  italian: "it",
  italiano: "it",
  id: "id",
  indonesian: "id",
  "bahasa-indonesia": "id",
  "bahasa indonesia": "id",
};

export function parseCoachLanguage(value: unknown): CoachLanguage {
  if (typeof value !== "string") return DEFAULT_COACH_LANGUAGE;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_COACH_LANGUAGE;
  const key = trimmed.toLowerCase().replace(/_/g, "-");
  return LANGUAGE_ALIASES[trimmed] ?? LANGUAGE_ALIASES[key] ?? DEFAULT_COACH_LANGUAGE;
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

const ENGLISH_CONSTRAINTS =
  "Write every user-facing string in English: headline, summary, spokenLine, insight title/finding/action, rotation notes, rotationStory, closeRangeFights title/sightlines/knowHow. JSON keys stay English. Tone: sharp and funny. Short sentences. Same pro-team bar. No generic slogans. Name a gun only when the HUD or model is readable. A lip/headglitch is not stairs. An Apex knock is not a kill — finish, reset, or third-party. Name off-screen cover only when using it raises win rate in the fight in front of the player — not every off-screen object, and not only when it is already on camera. When Apex map+POI is identified, treat the supplied POI geometry as fact. If it is not identified, do not invent a layout.";

const JAPANESE_CONSTRAINTS =
  "ユーザー向け文字列はすべて日本語。headline, summary, spokenLine, insight の title/finding/action, rotation, rotationStory, closeRangeFights の title/sightlines/knowHow。JSONキーは英語のまま。口調は辛口で面白い。短文。プロチームの過程と期待値。汎用スローガン禁止。武器名はHUDかモデルが読めたときだけ。段差と階段を取り違えるな。Apexのノックはキルではない。確殺／リセット／漁夫を選べ。画面外カバーは、今の局面で勝率が上がるときだけ出せ。画面に無いから出さない、は禁止。ApexでマップとPOIが特定できたらリファレンスの間取りは事実。特定できなければ間取りを作るな。";

export function languageInstruction(language: CoachLanguage) {
  if (language === "en") return ENGLISH_CONSTRAINTS;
  if (language === "ja") return JAPANESE_CONSTRAINTS;
  const name = LANGUAGE_ENGLISH_NAMES[language];
  const native = LANGUAGE_LABELS[language];
  return `Write every user-facing string in ${name} (${native}, ${language}): headline, summary, spokenLine, insight title/finding/action, rotation notes, rotationStory, closeRangeFights title/sightlines/knowHow. JSON keys stay English. Tone: sharp and funny. Short sentences. Same pro-team bar. No generic slogans. Name a gun only when the HUD or model is readable. A lip/headglitch is not stairs. An Apex knock is not a kill — finish, reset, or third-party. Name off-screen cover only when using it raises win rate in the fight in front of the player — not every off-screen object, and not only when it is already on camera. When Apex map+POI is identified, treat the supplied POI geometry as fact. If it is not identified, do not invent a layout. Do not write those strings in Japanese or English unless ${name} is the selected language.`;
}

export function spokenLanguageLine(language: CoachLanguage) {
  if (language === "en") {
    return "When shouldSpeak=true, write spokenLine as short, sharp English. No tabs. No overlay.";
  }
  if (language === "ja") {
    return "shouldSpeak=true のとき spokenLine に、辛口で短い日本語を書く。タブも通知も出さない。ゲーム内オーバーレイは使いません。";
  }
  const name = LANGUAGE_ENGLISH_NAMES[language];
  const native = LANGUAGE_LABELS[language];
  return `When shouldSpeak=true, write spokenLine in ${name} (${native}, ${language}). TTS locale ${speechLocale(language)}. Short and sharp. No tabs. No overlay. The product is voice only. Do not write spokenLine in Japanese or English.`;
}

export function viralLanguageLine(language: CoachLanguage) {
  if (language === "en") {
    return "Write video_title, ai_tsukkomi, and cta_text in English. ai_tsukkomi is at most 100 characters. video_title is short enough to fill the screen in the first 2 seconds. cta_text is one line.";
  }
  if (language === "ja") {
    return "viralScript の3文字列は日本語。ai_tsukkomi は100文字以内。video_title は最初の2秒で画面いっぱいに出る短さ。cta_text は1行。";
  }
  const name = LANGUAGE_ENGLISH_NAMES[language];
  const native = LANGUAGE_LABELS[language];
  return `Write video_title, ai_tsukkomi, and cta_text in ${name} (${native}, ${language}). ai_tsukkomi is at most 100 characters. video_title is short enough to fill the screen in the first 2 seconds. cta_text is one line. Do not write those three strings in Japanese or English.`;
}

const SPEECH_LOCALES: Record<CoachLanguage, string> = {
  en: "en-US",
  ja: "ja-JP",
  pt: "pt-BR",
  ko: "ko-KR",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  pl: "pl-PL",
  "zh-TW": "zh-TW",
  tr: "tr-TR",
  it: "it-IT",
  id: "id-ID",
};

export function speechLocale(language: CoachLanguage) {
  return SPEECH_LOCALES[language];
}

type FightChrome = {
  heading: string;
  hint: string;
  sightlines: string;
  knowHow: string;
  noMedia: string;
  loading: string;
};

const FIGHT_CHROME: Record<CoachLanguage, FightChrome> = {
  ja: {
    heading: "近距離の撃ち合い",
    hint: "タップすると、そのスクラップだけの細かい斜線管理と戦闘のノウハウを開きます。最初は畳んであります。",
    sightlines: "細かい斜線管理",
    knowHow: "戦闘のノウハウ",
    noMedia: "手元の動画が残っていません。再生できるURLがあれば、そこから静止画を切ります。",
    loading: "このスクラップから切り出し中",
  },
  en: {
    heading: "Close-range scraps",
    hint: "Tap a fight for fine sightlines and in-fight choices. Collapsed so the board stays short.",
    sightlines: "Fine sightline work",
    knowHow: "In-fight know-how",
    noMedia: "No local clip left. Still shots come from the playable URL if we have one.",
    loading: "Grabbing frames from this scrap",
  },
  pt: {
    heading: "Trocas de perto",
    hint: "Toque numa luta para ver as linhas de visão e as escolhas da briga. Começa fechado.",
    sightlines: "Linhas de visão",
    knowHow: "Como jogar a luta",
    noMedia: "O clipe local não ficou. Se houver URL reproduzível, o still sai de lá.",
    loading: "Cortando este scrap",
  },
  ko: {
    heading: "근접 교전",
    hint: "교전을 누르면 그 한 판의 시선 관리와 전투 선택이 열립니다. 처음엔 접혀 있습니다.",
    sightlines: "시선 관리",
    knowHow: "전투 노하우",
    noMedia: "로컬 영상이 없습니다. 재생 URL이 있으면 거기서 스틸을 자릅니다.",
    loading: "이 교전을 자르는 중",
  },
  de: {
    heading: "Nahkämpfe",
    hint: "Tipp einen Fight für Sichtlinien und Entscheidungen. Startet eingeklappt.",
    sightlines: "Sichtlinien",
    knowHow: "Im Fight",
    noMedia: "Kein lokaler Clip mehr. Stills kommen von der abspielbaren URL, falls vorhanden.",
    loading: "Frames aus diesem Scrap",
  },
  fr: {
    heading: "Échanges au corps à corps",
    hint: "Touche un fight pour les lignes de vue et les choix. Fermé au départ.",
    sightlines: "Lignes de vue",
    knowHow: "Savoir du fight",
    noMedia: "Plus de clip local. Les images viennent de l’URL lisible s’il y en a une.",
    loading: "Découpe de cet échange",
  },
  es: {
    heading: "Peleas cuerpo a cuerpo",
    hint: "Toca una pelea para las líneas de visión y las decisiones. Empieza cerrada.",
    sightlines: "Líneas de visión",
    knowHow: "Cómo pelear",
    noMedia: "No queda el clip local. Si hay URL reproducible, el still sale de ahí.",
    loading: "Cortando este scrap",
  },
  pl: {
    heading: "Walki z bliska",
    hint: "Dotknij walki, żeby zobaczyć linie strzału i decyzje. Na start zwinięte.",
    sightlines: "Linie strzału",
    knowHow: "Jak grać walkę",
    noMedia: "Nie ma lokalnego klipu. Jeśli jest URL, kadr bierzemy stamtąd.",
    loading: "Wycinam ten scrap",
  },
  "zh-TW": {
    heading: "近距離交火",
    hint: "點開某一場才看細線與戰鬥選擇。預設收合。",
    sightlines: "視線管理",
    knowHow: "戰鬥取捨",
    noMedia: "手元影片不在了。若有可播放的 URL，靜態畫面從那裡切。",
    loading: "正在切這段交火",
  },
  tr: {
    heading: "Yakın mesafe kapışmalar",
    hint: "Bir kapışmaya dokun: görüş hatları ve dövüş seçimleri. Başta kapalı.",
    sightlines: "Görüş hatları",
    knowHow: "Dövüş bilgisi",
    noMedia: "Yerel klip kalmadı. Oynatılabilir URL varsa kare oradan gelir.",
    loading: "Bu kapışma kesiliyor",
  },
  it: {
    heading: "Scontri ravvicinati",
    hint: "Tocca uno scontro per linee di vista e scelte. Parte chiuso.",
    sightlines: "Linee di vista",
    knowHow: "Come combattere",
    noMedia: "Niente clip locale. Se c’è un URL, lo still esce da lì.",
    loading: "Sto tagliando questo scrap",
  },
  id: {
    heading: "Baku tembak jarak dekat",
    hint: "Ketuk satu fight untuk garis pandang dan pilihan bertarung. Awalnya tertutup.",
    sightlines: "Garis pandang",
    knowHow: "Cara bertarung",
    noMedia: "Klip lokal tidak tersisa. Kalau ada URL yang bisa diputar, still diambil dari situ.",
    loading: "Memotong scrap ini",
  },
};

export function fightChrome(language: CoachLanguage) {
  return FIGHT_CHROME[language];
}

type LiveChrome = {
  speakingNow: string;
  watching: string;
  voiceCoach: string;
  startShare: string;
  stopShare: string;
  gesture: string;
  keepEyesOnGame: string;
  stayQuietMidFight: string;
  onlyPostFight: string;
};

const LIVE_CHROME: Record<CoachLanguage, LiveChrome> = {
  ja: {
    speakingNow: "いま話しています",
    watching: "注視中",
    voiceCoach: "音声コーチ",
    startShare: "画面共有して音声を開始",
    stopShare: "共有を止める",
    gesture: "音声を出すには、下のボタンを押してください。ブラウザは操作なしでは話しません。",
    keepEyesOnGame: "試合から目を離さないでください。声だけ拾えばいいです。",
    stayQuietMidFight: "画面を読んでいます。撃ち合いの最中は、短い一言以外は黙ります。",
    onlyPostFight: "膠着の詰めと、戦闘後のレビューだけ話します。",
  },
  en: {
    speakingNow: "Speaking now",
    watching: "Watching",
    voiceCoach: "Voice coach",
    startShare: "Share screen and start voice",
    stopShare: "Stop sharing",
    gesture: "Click the button below to unlock audio. The browser will not speak without that click.",
    keepEyesOnGame: "Keep your eyes on the match. Just listen.",
    stayQuietMidFight: "Reading the screen. Mid-fight I stay quiet unless it is one short call.",
    onlyPostFight: "I only talk after a scrap or in a standoff close.",
  },
  pt: {
    speakingNow: "Falando agora",
    watching: "Observando",
    voiceCoach: "Coach de voz",
    startShare: "Compartilhar a tela e falar",
    stopShare: "Parar compartilhamento",
    gesture: "Aperte o botão abaixo para liberar o áudio. O navegador não fala sem esse clique.",
    keepEyesOnGame: "Olho na partida. Só escuta.",
    stayQuietMidFight: "Lendo a tela. No meio da luta eu calo, salvo um chamado curto.",
    onlyPostFight: "Só falo depois da troca ou num fechamento travado.",
  },
  ko: {
    speakingNow: "지금 말하는 중",
    watching: "보는 중",
    voiceCoach: "음성 코치",
    startShare: "화면 공유하고 음성 시작",
    stopShare: "공유 중지",
    gesture: "아래 버튼을 눌러야 소리가 납니다. 조작 없이는 브라우저가 말하지 않습니다.",
    keepEyesOnGame: "경기에서 눈을 떼지 마세요. 목소리만 들으면 됩니다.",
    stayQuietMidFight: "화면을 읽는 중. 교전 한가운데는 짧은 한마디만 합니다.",
    onlyPostFight: "교전 후 리뷰와, 멈춰 있는 마무리를 말할 때만 말합니다.",
  },
  de: {
    speakingNow: "Ich rede",
    watching: "Schaue zu",
    voiceCoach: "Sprachcoach",
    startShare: "Bildschirm teilen und sprechen",
    stopShare: "Teilen stoppen",
    gesture: "Unten tippen, sonst bleibt der Browser stumm.",
    keepEyesOnGame: "Augen aufs Match. Nur zuhören.",
    stayQuietMidFight: "Ich lese den Screen. Mitten im Fight nur ein kurzer Call.",
    onlyPostFight: "Ich rede nach dem Scrap oder wenn der Close feststeckt.",
  },
  fr: {
    speakingNow: "Je parle",
    watching: "J’observe",
    voiceCoach: "Coach vocal",
    startShare: "Partager l’écran et parler",
    stopShare: "Arrêter le partage",
    gesture: "Clique le bouton pour débloquer l’audio. Sans ce clic, le navigateur se tait.",
    keepEyesOnGame: "Les yeux sur la partie. Écoute seulement.",
    stayQuietMidFight: "Je lis l’écran. En plein fight, un seul mot court.",
    onlyPostFight: "Je parle après l’échange, ou quand le close est bloqué.",
  },
  es: {
    speakingNow: "Hablando",
    watching: "Mirando",
    voiceCoach: "Coach de voz",
    startShare: "Compartir pantalla y hablar",
    stopShare: "Dejar de compartir",
    gesture: "Pulsa el botón para soltar el audio. Sin ese clic el navegador no habla.",
    keepEyesOnGame: "Ojos en la partida. Solo escucha.",
    stayQuietMidFight: "Leo la pantalla. En plena pelea, como mucho una frase corta.",
    onlyPostFight: "Hablo después del intercambio o si el cierre está trabado.",
  },
  pl: {
    speakingNow: "Mówię",
    watching: "Patrzę",
    voiceCoach: "Coach głosowy",
    startShare: "Udostępnij ekran i mów",
    stopShare: "Zatrzymaj udostępnianie",
    gesture: "Kliknij przycisk, inaczej przeglądarka nie mówi.",
    keepEyesOnGame: "Oczy na meczu. Tylko słuchaj.",
    stayQuietMidFight: "Czytam ekran. W trakcie walki najwyżej jedno krótkie zdanie.",
    onlyPostFight: "Mówię po walce albo gdy domknięcie stoi.",
  },
  "zh-TW": {
    speakingNow: "正在說",
    watching: "看著",
    voiceCoach: "語音教練",
    startShare: "分享畫面並開始語音",
    stopShare: "停止分享",
    gesture: "按下面的按鈕才會出聲。沒有這個動作，瀏覽器不會說。",
    keepEyesOnGame: "眼睛留在比賽上。聽聲音就好。",
    stayQuietMidFight: "正在讀畫面。交火當中只講一句短的。",
    onlyPostFight: "只在交火之後，或僵持要收的時候說話。",
  },
  tr: {
    speakingNow: "Konuşuyorum",
    watching: "İzliyorum",
    voiceCoach: "Sesli koç",
    startShare: "Ekranı paylaş ve konuş",
    stopShare: "Paylaşımı durdur",
    gesture: "Sesi açmak için alttaki düğmeye bas. Tıklamadan tarayıcı konuşmaz.",
    keepEyesOnGame: "Gözün maçta kalsın. Sadece dinle.",
    stayQuietMidFight: "Ekranı okuyorum. Çatışmanın ortasında en fazla kısa bir cümle.",
    onlyPostFight: "Sadece kapışmadan sonra ya da kapanış kilitlenince konuşurum.",
  },
  it: {
    speakingNow: "Sto parlando",
    watching: "Osservo",
    voiceCoach: "Coach vocale",
    startShare: "Condividi lo schermo e parla",
    stopShare: "Ferma la condivisione",
    gesture: "Premi il pulsante per sbloccare l’audio. Senza quel clic il browser tace.",
    keepEyesOnGame: "Occhi sulla partita. Ascolta e basta.",
    stayQuietMidFight: "Leggo lo schermo. A metà fight al massimo una frase corta.",
    onlyPostFight: "Parlo dopo lo scontro, o se la chiusura è bloccata.",
  },
  id: {
    speakingNow: "Sedang bicara",
    watching: "Mengawasi",
    voiceCoach: "Pelatih suara",
    startShare: "Bagikan layar dan mulai suara",
    stopShare: "Hentikan berbagi",
    gesture: "Tekan tombol di bawah untuk membuka suara. Tanpa itu browser tidak bicara.",
    keepEyesOnGame: "Mata tetap di pertandingan. Dengar saja.",
    stayQuietMidFight: "Membaca layar. Di tengah baku tembak paling satu kalimat pendek.",
    onlyPostFight: "Saya bicara setelah fight, atau saat penutupan macet.",
  },
};

export function liveChrome(language: CoachLanguage) {
  return LIVE_CHROME[language];
}

type ViralChrome = {
  heading: string;
  title: string;
  tsukkomi: string;
  copy: string;
  copied: string;
};

const VIRAL_CHROME: Record<CoachLanguage, ViralChrome> = {
  ja: { heading: "バズる台本", title: "タイトル", tsukkomi: "ツッコミ", copy: "台本をコピーする", copied: "コピーした" },
  en: { heading: "Shorts script", title: "Title", tsukkomi: "Roast", copy: "Copy the script", copied: "Copied" },
  pt: { heading: "Roteiro de Shorts", title: "Título", tsukkomi: "Alfinetada", copy: "Copiar o roteiro", copied: "Copiado" },
  ko: { heading: "숏폼 대본", title: "제목", tsukkomi: "한마디", copy: "대본 복사하기", copied: "복사함" },
  de: { heading: "Shorts-Skript", title: "Titel", tsukkomi: "Ansage", copy: "Skript kopieren", copied: "Kopiert" },
  fr: { heading: "Script Shorts", title: "Titre", tsukkomi: "Pique", copy: "Copier le script", copied: "Copié" },
  es: { heading: "Guion de Shorts", title: "Título", tsukkomi: "Pullazo", copy: "Copiar el guion", copied: "Copiado" },
  pl: { heading: "Skrypt Shorts", title: "Tytuł", tsukkomi: "Docinek", copy: "Kopiuj scenariusz", copied: "Skopiowano" },
  "zh-TW": { heading: "短影音台本", title: "標題", tsukkomi: "吐槽", copy: "複製台本", copied: "已複製" },
  tr: { heading: "Shorts metni", title: "Başlık", tsukkomi: "Laf", copy: "Metni kopyala", copied: "Kopyalandı" },
  it: { heading: "Script Shorts", title: "Titolo", tsukkomi: "Stoccata", copy: "Copia il copione", copied: "Copiato" },
  id: { heading: "Naskah Shorts", title: "Judul", tsukkomi: "Sindir", copy: "Salin naskah", copied: "Tersalin" },
};

export function viralChrome(language: CoachLanguage) {
  return VIRAL_CHROME[language];
}

type ShareChrome = { label: string; hint: string };

const SHARE_CHROME: Record<CoachLanguage, ShareChrome> = {
  ja: {
    label: "X（旧Twitter）にシェアする",
    hint: "この指摘の短い要約をXの投稿画面に入れます。",
  },
  en: {
    label: "Share on X (Twitter)",
    hint: "Opens X with a short summary of this advice.",
  },
  pt: {
    label: "Compartilhar no X (Twitter)",
    hint: "Abre o X com um resumo curto deste conselho.",
  },
  ko: {
    label: "X(구 Twitter)에 공유",
    hint: "이 지적의 짧은 요약을 X 작성 창에 넣습니다.",
  },
  de: {
    label: "Auf X (Twitter) teilen",
    hint: "Öffnet X mit einer kurzen Zusammenfassung.",
  },
  fr: {
    label: "Partager sur X (Twitter)",
    hint: "Ouvre X avec un court résumé de ce conseil.",
  },
  es: {
    label: "Compartir en X (Twitter)",
    hint: "Abre X con un resumen corto de este consejo.",
  },
  pl: {
    label: "Udostępnij na X (Twitter)",
    hint: "Otwiera X z krótkim podsumowaniem tej rady.",
  },
  "zh-TW": {
    label: "分享到 X（原 Twitter）",
    hint: "把這則指摘的短摘要放進 X 的發文框。",
  },
  tr: {
    label: "X’te (Twitter) paylaş",
    hint: "Bu öğüdün kısa özetini X yazma ekranına koyar.",
  },
  it: {
    label: "Condividi su X (Twitter)",
    hint: "Apre X con un riassunto breve di questo consiglio.",
  },
  id: {
    label: "Bagikan di X (Twitter)",
    hint: "Membuka X dengan ringkasan pendek saran ini.",
  },
};

export function shareChrome(language: CoachLanguage) {
  return SHARE_CHROME[language];
}

const INSIGHT_TABS: Record<CoachLanguage, Record<"rotation" | "aim" | "abilities" | "endgame" | "other", string>> = {
  ja: { rotation: "立ち回り/回転", aim: "エイム", abilities: "スキル", endgame: "詰め/終盤", other: "その他" },
  en: { rotation: "Pathing / rotate", aim: "Aim", abilities: "Abilities", endgame: "Close / endgame", other: "Other" },
  pt: { rotation: "Rotação", aim: "Mira", abilities: "Habilidades", endgame: "Fechamento", other: "Outros" },
  ko: { rotation: "동선/로테", aim: "에임", abilities: "스킬", endgame: "마무리", other: "기타" },
  de: { rotation: "Rotation", aim: "Aim", abilities: "Fähigkeiten", endgame: "Close / Ende", other: "Sonstiges" },
  fr: { rotation: "Rotation", aim: "Visée", abilities: "Compétences", endgame: "Close / fin", other: "Autre" },
  es: { rotation: "Rotación", aim: "Puntería", abilities: "Habilidades", endgame: "Cierre", other: "Otros" },
  pl: { rotation: "Rotacja", aim: "Celowanie", abilities: "Umiejętności", endgame: "Domknięcie", other: "Inne" },
  "zh-TW": { rotation: "走位/轉點", aim: "瞄準", abilities: "技能", endgame: "收尾", other: "其他" },
  tr: { rotation: "Rotasyon", aim: "Nişan", abilities: "Yetenekler", endgame: "Kapanış", other: "Diğer" },
  it: { rotation: "Rotazione", aim: "Mira", abilities: "Abilità", endgame: "Chiusura", other: "Altro" },
  id: { rotation: "Rotasi", aim: "Aim", abilities: "Skill", endgame: "Penutupan", other: "Lainnya" },
};

const INSIGHT_ALL: Record<CoachLanguage, string> = {
  ja: "すべて",
  en: "All",
  pt: "Tudo",
  ko: "전체",
  de: "Alle",
  fr: "Tout",
  es: "Todo",
  pl: "Wszystko",
  "zh-TW": "全部",
  tr: "Tümü",
  it: "Tutti",
  id: "Semua",
};

const INSIGHT_TYPES: Record<CoachLanguage, string> = {
  ja: "指摘の種類",
  en: "Insight types",
  pt: "Tipos de apontamento",
  ko: "지적 종류",
  de: "Hinweisarten",
  fr: "Types de remarques",
  es: "Tipos de apuntes",
  pl: "Rodzaje uwag",
  "zh-TW": "指摘種類",
  tr: "Not türleri",
  it: "Tipi di nota",
  id: "Jenis catatan",
};

const COACH_ACTION: Record<CoachLanguage, string> = {
  ja: "次の一手",
  en: "Coach action",
  pt: "Próxima jogada",
  ko: "다음 한 수",
  de: "Nächster Zug",
  fr: "Prochain geste",
  es: "Siguiente jugada",
  pl: "Następny ruch",
  "zh-TW": "下一步",
  tr: "Sonraki hamle",
  it: "Mossa successiva",
  id: "Langkah berikut",
};

export function insightTabLabel(
  tab: "rotation" | "aim" | "abilities" | "endgame" | "other",
  language: CoachLanguage,
) {
  return INSIGHT_TABS[language][tab];
}

export function insightAllLabel(language: CoachLanguage) {
  return INSIGHT_ALL[language];
}

export function insightTypesLabel(language: CoachLanguage) {
  return INSIGHT_TYPES[language];
}

export function coachActionLabel(language: CoachLanguage) {
  return COACH_ACTION[language];
}
