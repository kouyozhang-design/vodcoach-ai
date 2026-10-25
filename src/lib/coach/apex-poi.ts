import type { GameId } from "../games.ts";
import type { CoachChunkReport, CoachMode, CoachRequest } from "./types.ts";

/**
 * Compact Apex map/POI facts for coaching context.
 * Season 30 Split 2 ranked pool: World's Edge, Olympus, Broken Moon.
 * Storm Point and E-District stay for VOD/HUD that still names them.
 * Prompt reference only — no fine-tune.
 */

export type ApexMapId = "worlds-edge" | "olympus" | "broken-moon" | "storm-point" | "e-district";

export type ApexPoiRef = {
  mapId: ApexMapId;
  poiId: string;
};

export type ApexLocation = {
  mapId: ApexMapId;
  poiId?: string;
};

type ApexPoi = {
  id: string;
  name: string;
  aliases: string[];
  fact: string;
};

type ApexMap = {
  id: ApexMapId;
  name: string;
  aliases: string[];
  pois: ApexPoi[];
};

export const APEX_MAPS: ApexMap[] = [
  {
    id: "worlds-edge",
    name: "World's Edge",
    aliases: ["world's edge", "worlds edge", "ワールズエッジ", "ワールズ・エッジ"],
    pois: [
      {
        id: "fragment-east",
        name: "Fragment East",
        aliases: ["fragment east", "フラグメント東", "フラグメントイースト", "capitol east"],
        fact: "3棟のレンガ。内部階段は階段。窓枠・屋根縁・Construction Stacksの段は段差。ドアは通り側と横路地。画面外カバー: 西ダンプ、北の車両、スタック陰。中央通りは漏斗。",
      },
      {
        id: "fragment-west",
        name: "Fragment West",
        aliases: ["fragment west", "フラグメント西", "フラグメントウエスト", "construction stacks"],
        fact: "西はConstruction Stacksが戻った縦構造。内部階段は階段。足場とコンテナ縁は段差。ドアは路地と1階開口。画面外カバー: スタック陰、東棟の壁、北車両。",
      },
      {
        id: "fragment",
        name: "Fragment",
        aliases: ["fragment", "フラグメント", "capitol city"],
        fact: "東西の高層と開いた中央。内部階段は階段。窓枠・屋根・スタックは段差。ドアは各棟1階。画面外カバー: 反対棟、ダンプ、車両。中央を裸で渡るな。",
      },
      {
        id: "skyhook",
        name: "Skyhook",
        aliases: ["skyhook", "スカイフック"],
        fact: "北東の都市街区とエレベーター塔。建物内階段は階段。屋根と窓は段差。ドアは通りと中庭。画面外カバー: 隣棟、塔脚、雪側の岩。",
      },
      {
        id: "harvester",
        name: "Harvester",
        aliases: ["harvester", "harvest", "ハーベスター", "ハーベスト"],
        fact: "中央の巨大多層。内部廊下と階段は階段。外周縁と梁は段差。出入口が多い。画面外カバー: 下層開口、外周脚、隣接岩。",
      },
      {
        id: "countdown",
        name: "Countdown",
        aliases: ["countdown", "カウントダウン", "drill site"],
        fact: "サイロと溶岩穴。内部階段は階段。ピット縁は段差。ブラストウォールと床開口あり。画面外カバー: サイロ裏、壁の反対側、北の丘。",
      },
      {
        id: "east-village",
        name: "East Village",
        aliases: ["east village", "イーストビレッジ", "climatizer", "クライマタイザー"],
        fact: "旧Climatizer。岩と木のカバー、ダムへのジップ。建物内階段は階段。岩棚は段差。画面外カバー: ダム側ジップ先、木陰、集落裏の岩。着地側を見てから登れ。",
      },
      {
        id: "war-camp",
        name: "War Camp",
        aliases: ["war camp", "ウォーキャンプ", "survey camp", "サーベイキャンプ"],
        fact: "旧Survey Camp。中央の高台と周囲の小屋。小屋の階段は階段。高台縁は段差。画面外カバー: 外周小屋、高台裏、雪側の岩。中央を取った側が近接を持つ。",
      },
      {
        id: "tree-settlement",
        name: "Tree Settlement",
        aliases: ["tree settlement", "ツリーセトルメント", "the tree", "ツリー"],
        fact: "旧The Tree。層になった足場。連結階段は階段。足場縁は段差。画面外カバー: 下層、幹裏、隣プラットフォーム。登る前に合流点を決めろ。",
      },
      {
        id: "sorting-factory",
        name: "Sorting Factory",
        aliases: ["sorting factory", "ソーティングファクトリー", "lava siphon", "ラヴァサイフォン"],
        fact: "旧Lava Siphon。工場内部の階段は階段。コンベヤと開口縁は段差。中央に列車トンネル、ジップと足場。画面外カバー: トンネル、上層足場、外周タンク。",
      },
      {
        id: "landslide",
        name: "Landslide",
        aliases: ["landslide", "ランドスライド", "big maude", "ビッグモード"],
        fact: "開いた斜面。車両とクレーン。建物内があれば階段、クレーンと車両は段差。Big Maudeはここ。画面外カバー: 車両列、クレーン脚、斜面の岩。",
      },
      {
        id: "launch-site",
        name: "Launch Site",
        aliases: ["launch site", "ローンチサイト"],
        fact: "南の発射台街区。建物内階段は階段。プラットフォーム縁は段差。ドアは格納庫側。画面外カバー: 格納庫、外周壁、隣接岩。",
      },
      {
        id: "lava-fissure",
        name: "Lava Fissure",
        aliases: ["lava fissure", "lava city", "ラヴァフィッシャ", "ラヴァシティ"],
        fact: "溶岩上の足場と数棟。内部階段は階段。足場縁は段差。溶岩はカバーではない。画面外カバー: 西の独立棟、足場裏、岩壁。",
      },
      {
        id: "monument",
        name: "Monument",
        aliases: ["monument", "モニュメント"],
        fact: "大型建造物。内部階段は階段。手すりと屋根は段差。ドアは複数。画面外カバー: 外周柱、隣接建物、高台裏。",
      },
      {
        id: "epicenter",
        name: "Epicenter",
        aliases: ["epicenter", "エピセンター", "the epicenter"],
        fact: "凍ったドリルの目印。ドーム周りは開いている。内部があれば階段、リムは段差。画面外カバー: ドリル脚、外周岩。接近は長い。",
      },
      {
        id: "thermal-station",
        name: "Thermal Station",
        aliases: ["thermal station", "thermal", "サーマルステーション", "サーマル"],
        fact: "配管の工業施設。内部階段は階段。配管とタンク縁は段差。ドアは建屋開口。画面外カバー: タンク裏、配管下、隣接建屋。",
      },
      {
        id: "geyser",
        name: "The Geyser",
        aliases: ["geyser", "the geyser", "ガイザー"],
        fact: "噴出口と周辺の岩・小屋。小屋の階段は階段。岩棚は段差。画面外カバー: 噴出口裏、岩、小屋壁。",
      },
      {
        id: "stacks-city",
        name: "Stacks City",
        aliases: ["stacks city", "スタックスシティ", "stacks", "スタックス"],
        fact: "コンテナ都市。昇降があれば階段、コンテナ縁は段差。画面外カバー: 列の陰、隙間、外周車両。",
      },
      {
        id: "staging",
        name: "Staging",
        aliases: ["staging", "ステージング"],
        fact: "南の集積ヤード。倉庫内階段は階段。コンテナ縁は段差。画面外カバー: 倉庫壁、コンテナ列、外周車両。",
      },
      {
        id: "overlook",
        name: "Overlook",
        aliases: ["overlook", "オーバールック"],
        fact: "東端の足場。昇降は階段、リムは段差。落下あり。画面外カバー: 足場裏、内側の岩。",
      },
    ],
  },
  {
    id: "olympus",
    name: "Olympus",
    aliases: ["olympus", "オリンパス"],
    pois: [
      {
        id: "estates",
        name: "Estates",
        aliases: ["estates", "autumn estates", "エステーツ", "オータムエステーツ"],
        fact: "邸宅群。内部階段は階段。テラスと窓枠は段差。ドアは正面と側面。画面外カバー: 隣邸、庭石、壁裏。",
      },
      {
        id: "hammond-labs",
        name: "Hammond Labs",
        aliases: ["hammond labs", "hammond", "ハモンドラボ", "ハモンド"],
        fact: "実験棟。内部階段は階段。ガラス縁と屋上は段差。ドアはロビーと側面。画面外カバー: 別棟、中庭壁、屋上裏。",
      },
      {
        id: "hydroponics",
        name: "Hydroponics",
        aliases: ["hydroponics", "ハイドロポニクス"],
        fact: "栽培棟。内部階段は階段。プランター縁は段差。ドアは温室開口。画面外カバー: 隣温室、タンク、外周通路。",
      },
      {
        id: "bonsai-plaza",
        name: "Bonsai Plaza",
        aliases: ["bonsai plaza", "bonsai", "ボンサイプラザ", "ボンサイ"],
        fact: "広場と低層。内部階段は階段。プランターと縁石は段差。画面外カバー: 広場脇の壁、隣棟、木陰。",
      },
      {
        id: "gardens",
        name: "Gardens",
        aliases: ["gardens", "golden gardens", "ガーデンズ", "ゴールデンガーデンズ"],
        fact: "庭園と低壁。建物内階段は階段。花壇は段差。画面外カバー: 壁裏、隣棟、高台。",
      },
      {
        id: "icarus",
        name: "Icarus",
        aliases: ["icarus", "the icarus", "イカロス"],
        fact: "墜落船。内部通路の段は階段扱い、船体縁は段差。開口が多い。画面外カバー: 船体裏、翼陰、隣接岩。",
      },
      {
        id: "power-grid",
        name: "Power Grid",
        aliases: ["power grid", "パワーグリッド"],
        fact: "配電施設。内部階段は階段。機器縁は段差。画面外カバー: 変電裏、フェンス、隣棟。",
      },
      {
        id: "turbine",
        name: "Turbine",
        aliases: ["turbine", "central turbine", "タービン"],
        fact: "中央タービン。内部階段は階段。円形縁は段差。画面外カバー: タービン裏、下層、隣接通路。",
      },
      {
        id: "energy-depot",
        name: "Energy Depot",
        aliases: ["energy depot", "energy center", "エナジーデポ", "エナジーセンター"],
        fact: "エネルギー貯蔵。内部階段は階段。タンク縁は段差。画面外カバー: タンク裏、荷役壁、隣棟。",
      },
      {
        id: "oasis",
        name: "Oasis",
        aliases: ["oasis", "velvet oasis", "オアシス"],
        fact: "水辺と低層。内部階段は階段。縁石は段差。画面外カバー: 水際の壁、隣棟、木。",
      },
      {
        id: "phase-driver",
        name: "Phase Driver",
        aliases: ["phase driver", "フェーズドライバー"],
        fact: "位相装置周辺。内部階段は階段。装置縁は段差。画面外カバー: 装置裏、岩、隣接通路。",
      },
      {
        id: "solar-array",
        name: "Solar Array",
        aliases: ["solar array", "ソーラーアレイ"],
        fact: "パネル群。昇降は階段、パネル縁は段差。開いている。画面外カバー: パネル裏、保守棟、端の壁。",
      },
      {
        id: "docks",
        name: "Docks",
        aliases: ["docks", "shipyard", "ドックス", "シップヤード"],
        fact: "波止場。倉庫内階段は階段。桟橋縁は段差。画面外カバー: 倉庫、コンテナ、船体。",
      },
      {
        id: "elysium",
        name: "Elysium",
        aliases: ["elysium", "エリシウム"],
        fact: "居住街区。内部階段は階段。バルコニーは段差。ドアは通り側。画面外カバー: 隣棟、中庭、路地。",
      },
      {
        id: "rift",
        name: "Rift",
        aliases: ["rift aftermath", "the rift", "リフト"],
        fact: "裂け目周辺。建物内階段は階段。縁は段差。画面外カバー: 裂け目裏、残棟、岩。",
      },
      {
        id: "fight-night",
        name: "Fight Night",
        aliases: ["fight night", "pathfinder's fight night", "ファイトナイト"],
        fact: "アリーナ。内部階段は階段。リング縁は段差。画面外カバー: 客席裏、エントランス、外周壁。",
      },
    ],
  },
  {
    id: "broken-moon",
    name: "Broken Moon",
    aliases: ["broken moon", "ブロークンムーン"],
    pois: [
      {
        id: "production-yard",
        name: "Production Yard",
        aliases: ["production yard", "プロダクションヤード"],
        fact: "工場ヤード。内部階段は階段。クレーンとコンテナは段差。画面外カバー: 倉庫、タンク、ヤード壁。",
      },
      {
        id: "core",
        name: "The Core",
        aliases: ["the core", "コア"],
        fact: "中心施設。内部階段は階段。円形縁は段差。ドアは複数。画面外カバー: 下層、外周通路、隣接棟。",
      },
      {
        id: "terraformer",
        name: "Terraformer",
        aliases: ["terraformer", "テラフォーマー"],
        fact: "巨大装置。内部階段は階段。装置縁は段差。画面外カバー: 脚部、外周岩、隣接建屋。",
      },
      {
        id: "dry-gulch",
        name: "Dry Gulch",
        aliases: ["dry gulch", "ドライガルチ"],
        fact: "峡谷。小屋の階段は階段。岩棚は段差。画面外カバー: 峡谷壁、小屋裏、岩。",
      },
      {
        id: "foundry",
        name: "The Foundry",
        aliases: ["foundry", "the foundry", "ファウンドリー"],
        fact: "鋳造所。内部階段は階段。炉縁と梁は段差。画面外カバー: 炉裏、隣棟、外周タンク。",
      },
      {
        id: "breaker-wharf",
        name: "Breaker Wharf",
        aliases: ["breaker wharf", "ブレーカーワーフ"],
        fact: "埠頭。倉庫内階段は階段。岸壁縁は段差。画面外カバー: 倉庫、船体、コンテナ。",
      },
      {
        id: "eternal-gardens",
        name: "Eternal Gardens",
        aliases: ["eternal gardens", "エターナルガーデンズ"],
        fact: "庭園施設。内部階段は階段。花壇と縁は段差。画面外カバー: 壁裏、隣棟、高台。",
      },
      {
        id: "divide",
        name: "The Divide",
        aliases: ["the divide", "divide", "ディバイド"],
        fact: "分断地形。橋や内部は階段、崖縁は段差。画面外カバー: 橋裏、崖下、残棟。",
      },
      {
        id: "atmostation",
        name: "Atmostation",
        aliases: ["atmostation", "atmo station", "アトモステーション"],
        fact: "大気施設。内部階段は階段。装置縁は段差。画面外カバー: 装置裏、隣棟、外周タンク。",
      },
      {
        id: "cultivation",
        name: "Cultivation",
        aliases: ["cultivation", "カルティベーション"],
        fact: "栽培区画。内部階段は階段。プランターは段差。画面外カバー: 温室裏、タンク、隣区画。",
      },
      {
        id: "stasis-array",
        name: "Stasis Array",
        aliases: ["stasis array", "stasis", "スタシスアレイ", "スタシス"],
        fact: "スタシス装置。内部階段は階段。装置縁は段差。画面外カバー: 装置裏、岩、隣棟。",
      },
      {
        id: "alpha-base",
        name: "Alpha Base",
        aliases: ["alpha base", "アルファベース"],
        fact: "基地街区。内部階段は階段。防壁縁は段差。画面外カバー: 防壁裏、隣棟、車両。",
      },
      {
        id: "bionomics",
        name: "Bionomics",
        aliases: ["bionomics", "バイオノミクス"],
        fact: "生体研究棟。内部階段は階段。実験縁は段差。画面外カバー: 別棟、中庭、外周壁。",
      },
      {
        id: "space-port",
        name: "Space Port",
        aliases: ["space port", "スペースポート"],
        fact: "港湾。格納庫内階段は階段。エプロン縁は段差。画面外カバー: 格納庫、船体、コンテナ。",
      },
    ],
  },
  {
    id: "storm-point",
    name: "Storm Point",
    aliases: ["storm point", "ストームポイント"],
    pois: [
      {
        id: "command-center",
        name: "Command Center",
        aliases: ["command center", "コマンドセンター"],
        fact: "司令部。内部階段は階段。屋上縁は段差。画面外カバー: 別棟、防壁、高台裏。",
      },
      {
        id: "lightning-rod",
        name: "Lightning Rod",
        aliases: ["lightning rod", "ライトニングロッド"],
        fact: "避雷塔周辺。塔内階段は階段。岩棚は段差。画面外カバー: 塔脚、岩、下層。",
      },
      {
        id: "barometer",
        name: "Barometer",
        aliases: ["barometer", "バロメーター"],
        fact: "気象施設。内部階段は階段。装置縁は段差。画面外カバー: 装置裏、隣棟、岩。",
      },
      {
        id: "thunder-watch",
        name: "Thunder Watch",
        aliases: ["thunder watch", "サンダーウォッチ"],
        fact: "高台見張り。内部階段は階段。崖縁は段差。画面外カバー: 建物裏、岩、下層。",
      },
      {
        id: "cascade-falls",
        name: "Cascade Falls",
        aliases: ["cascade falls", "cascade", "カスケード"],
        fact: "滝周辺。小屋の階段は階段。岩棚は段差。画面外カバー: 滝裏、岩、小屋。",
      },
      {
        id: "north-pad",
        name: "North Pad",
        aliases: ["north pad", "ノースパッド"],
        fact: "北部パッド。格納庫階段は階段。パッド縁は段差。画面外カバー: 格納庫、岩、車両。",
      },
      {
        id: "checkpoint",
        name: "Checkpoint",
        aliases: ["checkpoint", "チェックポイント"],
        fact: "検問街区。内部階段は階段。防壁は段差。画面外カバー: 壁裏、隣棟、車両。",
      },
      {
        id: "storm-catcher",
        name: "Storm Catcher",
        aliases: ["storm catcher", "ストームキャッチャー"],
        fact: "捕集塔。内部階段は階段。塔縁は段差。画面外カバー: 塔脚、岩、下層建屋。",
      },
    ],
  },
  {
    id: "e-district",
    name: "E-District",
    aliases: ["e-district", "e district", "イーディストリクト", "イー・ディストリクト"],
    pois: [
      {
        id: "boardwalk",
        name: "Boardwalk",
        aliases: ["boardwalk", "ボードウォーク"],
        fact: "遊歩道。店内階段は階段。縁石は段差。画面外カバー: 店内、屋台、隣街区。",
      },
      {
        id: "neon-rain",
        name: "Neon Rain",
        aliases: ["neon rain", "ネオンレイン"],
        fact: "繁華街。内部階段は階段。看板と縁は段差。画面外カバー: 路地、店内、隣棟。",
      },
      {
        id: "shoshi",
        name: "Shoshi",
        aliases: ["shoshi", "ショシ"],
        fact: "市場街区。内部階段は階段。屋台縁は段差。画面外カバー: 屋台裏、路地、隣棟。",
      },
      {
        id: "lotus",
        name: "The Lotus",
        aliases: ["lotus", "the lotus", "ロータス"],
        fact: "中層街区。内部階段は階段。バルコニーは段差。画面外カバー: 中庭、隣棟、路地。",
      },
      {
        id: "stadium",
        name: "Stadium",
        aliases: ["stadium", "スタジアム"],
        fact: "スタジアム。座席階段は階段。壁縁は段差。画面外カバー: 座席裏、トンネル、外周。",
      },
      {
        id: "city-hall",
        name: "City Hall",
        aliases: ["city hall", "シティホール"],
        fact: "庁舎。内部階段は階段。広場縁は段差。画面外カバー: 庁舎裏、隣棟、壁。",
      },
      {
        id: "heights",
        name: "Heights",
        aliases: ["heights", "ハイツ"],
        fact: "高台住宅。内部階段は階段。テラスは段差。画面外カバー: 隣家、路地、擁壁。",
      },
      {
        id: "resort",
        name: "Resort",
        aliases: ["resort", "リゾート"],
        fact: "リゾート棟。内部階段は階段。テラスは段差。画面外カバー: ロビー裏、隣棟、庭壁。",
      },
    ],
  },
];

const SLICE_MARK = "Apex map fact";
const INDEX_MARK = "Apex POI index";
const ATLAS_MARK = "Apex map atlas";

export function normalizePoiText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　、。・,.!！?？「」『』\-_/\\'’]/g, "");
}

export function parseApexPoiRef(value: unknown): ApexPoiRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const mapRaw = typeof row.map === "string" ? row.map : typeof row.mapId === "string" ? row.mapId : "";
  const poiRaw = typeof row.poi === "string" ? row.poi : typeof row.poiId === "string" ? row.poiId : "";
  return findPoi(mapRaw, poiRaw);
}

export function findPoi(mapRaw: string, poiRaw: string): ApexPoiRef | undefined {
  const map = findMap(mapRaw);
  if (!map || !poiRaw.trim()) return undefined;
  const poiKey = normalizePoiText(poiRaw);
  const poi = map.pois.find((entry) => {
    if (entry.id === poiRaw.trim() || normalizePoiText(entry.id) === poiKey) return true;
    if (normalizePoiText(entry.name) === poiKey) return true;
    return entry.aliases.some((alias) => normalizePoiText(alias) === poiKey);
  });
  return poi ? { mapId: map.id, poiId: poi.id } : undefined;
}

export function findMap(mapRaw: string): ApexMap | undefined {
  const key = normalizePoiText(mapRaw);
  if (!key) return undefined;
  return APEX_MAPS.find((map) => {
    if (map.id === mapRaw.trim() || normalizePoiText(map.id) === key) return true;
    if (normalizePoiText(map.name) === key) return true;
    return map.aliases.some((alias) => normalizePoiText(alias) === key);
  });
}

export function matchApexLocation(text: string): ApexLocation | undefined {
  const hay = normalizePoiText(text);
  if (!hay) return undefined;

  let bestPoi: { mapId: ApexMapId; poiId: string; len: number } | undefined;
  let bestMap: { mapId: ApexMapId; len: number } | undefined;

  for (const map of APEX_MAPS) {
    for (const alias of [map.name, map.id, ...map.aliases]) {
      const needle = normalizePoiText(alias);
      if (needle.length < 6) continue;
      if (hay.includes(needle) && needle.length > (bestMap?.len ?? 0)) {
        bestMap = { mapId: map.id, len: needle.length };
      }
    }
    for (const poi of map.pois) {
      for (const alias of [poi.name, poi.id, ...poi.aliases]) {
        const needle = normalizePoiText(alias);
        if (needle.length < 5) continue;
        if (hay.includes(needle) && needle.length >= (bestPoi?.len ?? 0)) {
          bestPoi = { mapId: map.id, poiId: poi.id, len: needle.length };
        }
      }
    }
  }

  if (bestPoi) return { mapId: bestPoi.mapId, poiId: bestPoi.poiId };
  if (bestMap) return { mapId: bestMap.mapId };
  return undefined;
}

export function haystackFromRequest(input: Pick<CoachRequest, "concern" | "recentCues" | "chunkReports" | "mapPoi">) {
  const parts = [input.concern ?? ""];
  for (const cue of input.recentCues ?? []) parts.push(cue);
  for (const report of input.chunkReports ?? []) {
    if (report.headline) parts.push(report.headline);
    if (report.summary) parts.push(report.summary);
    if (report.rotation?.ring) parts.push(report.rotation.ring);
    if (report.rotation?.path) parts.push(report.rotation.path);
    if (report.rotation?.note) parts.push(report.rotation.note);
  }
  return parts.join("\n");
}

export function resolveApexLocation(
  input: Pick<CoachRequest, "game" | "concern" | "recentCues" | "chunkReports" | "mapPoi">,
): ApexLocation | undefined {
  if (input.game !== "apex-legends") return undefined;
  const explicit = parseApexPoiRef(input.mapPoi);
  if (explicit) return explicit;
  for (const report of input.chunkReports ?? []) {
    const fromChunk = parseApexPoiRef(report.mapPoi);
    if (fromChunk) return fromChunk;
  }
  return matchApexLocation(haystackFromRequest(input));
}

const LIVE_INDEX_MAPS: ApexMapId[] = ["worlds-edge", "olympus", "broken-moon"];

export function formatApexPoiIndex(mapId?: ApexMapId) {
  const maps = mapId
    ? APEX_MAPS.filter((map) => map.id === mapId)
    : APEX_MAPS.filter((map) => LIVE_INDEX_MAPS.includes(map.id));
  const lines = [
    `${INDEX_MARK} (ids only). HUD/minimap/地名が読めたら mapPoi {map,poi} に id。幾何は書くな。読めなければ空。`,
  ];
  for (const map of maps) {
    lines.push(`${map.id}:${map.pois.map((poi) => poi.id).join(",")}`);
  }
  return lines.join("\n");
}

export function formatApexPoiSlice(ref: ApexPoiRef) {
  const map = APEX_MAPS.find((entry) => entry.id === ref.mapId);
  const poi = map?.pois.find((entry) => entry.id === ref.poiId);
  if (!map || !poi) return "";
  return [
    `${SLICE_MARK} (identified). この間取りは事実。画面外カバーもこのリストなら事実。`,
    `map=${map.id} poi=${poi.id} ${poi.name}`,
    poi.fact,
  ].join("\n");
}

export function formatApexMapSlices(mapId: ApexMapId) {
  const map = APEX_MAPS.find((entry) => entry.id === mapId);
  if (!map) return "";
  const lines = [
    `${ATLAS_MARK} map=${map.id}. HUDが地名を示したらそのPOIだけを事実にせよ。他マップを混ぜるな。`,
  ];
  for (const poi of map.pois) {
    lines.push(`${poi.id}: ${poi.fact}`);
  }
  return lines.join("\n");
}

export function formatApexAtlas() {
  const lines = [
    `${ATLAS_MARK}. HUD/minimap/地名で map+POI が読めた行だけ事実。読めなければ間取りを作るな。mapPoi に id を返せ。`,
  ];
  for (const map of APEX_MAPS) {
    lines.push(`# ${map.id}`);
    for (const poi of map.pois) {
      lines.push(`${poi.id}: ${poi.fact}`);
    }
  }
  return lines.join("\n");
}

export function apexMapContext(
  input: Pick<CoachRequest, "game" | "concern" | "recentCues" | "chunkReports" | "mapPoi">,
  mode: CoachMode,
) {
  if (input.game !== "apex-legends") return "";
  const location = resolveApexLocation(input);
  if (location?.poiId) {
    return formatApexPoiSlice({ mapId: location.mapId, poiId: location.poiId });
  }
  if (mode === "live") {
    return formatApexPoiIndex(location?.mapId);
  }
  if (location?.mapId) return formatApexMapSlices(location.mapId);
  return formatApexAtlas();
}

export function serializeApexPoi(ref: ApexPoiRef | undefined) {
  if (!ref) return undefined;
  return { map: ref.mapId, poi: ref.poiId };
}

export function pickApexPoiFromParsed(
  parsed: Record<string, unknown>,
  input: Pick<CoachRequest, "game" | "concern" | "recentCues" | "chunkReports" | "mapPoi">,
): ApexPoiRef | undefined {
  if (input.game !== "apex-legends") return undefined;
  const fromModel = parseApexPoiRef(parsed.mapPoi);
  if (fromModel) return fromModel;
  const location = resolveApexLocation(input);
  if (location?.poiId) return { mapId: location.mapId, poiId: location.poiId };
  return undefined;
}

export function locationFromReports(reports: CoachChunkReport[] | undefined) {
  for (const report of reports ?? []) {
    const ref = parseApexPoiRef(report.mapPoi);
    if (ref) return ref;
  }
  return undefined;
}

export function approxPromptTokens(text: string) {
  return Math.ceil([...text].length / 3);
}

export function isApexGame(game: GameId) {
  return game === "apex-legends";
}
