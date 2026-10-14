export const gameIds = ["apex-legends", "valorant"] as const;
export type GameId = (typeof gameIds)[number];

export type GameConfig = {
  id: GameId;
  name: string;
  shortName: string;
  characterLabel: "Legend" | "Agent";
  ranks: readonly string[];
  characters: readonly string[];
  defaultRank: string;
  defaultCharacter: string;
  defaultConcern: string;
  uploadHint: string;
};

export const gameConfigs: Record<GameId, GameConfig> = {
  "apex-legends": {
    id: "apex-legends",
    name: "Apex Legends",
    shortName: "Apex",
    characterLabel: "Legend",
    ranks: ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Apex Predator"],
    characters: [
      "Alter", "Ash", "Ballistic", "Bangalore", "Bloodhound", "Catalyst", "Caustic",
      "Conduit", "Crypto", "Fuse", "Gibraltar", "Horizon", "Lifeline", "Loba",
      "Mad Maggie", "Mirage", "Newcastle", "Octane", "Pathfinder", "Rampart",
      "Revenant", "Seer", "Sparrow", "Valkyrie", "Vantage", "Wattson", "Wraith",
    ],
    defaultRank: "Gold",
    defaultCharacter: "Wraith",
    defaultConcern: "近距離戦でエイムが下がり、遮蔽から離れすぎて先にダウンしてしまいます。",
    uploadHint: "撃ち合いが含まれる30〜90秒のクリップがおすすめ",
  },
  valorant: {
    id: "valorant",
    name: "VALORANT",
    shortName: "VALORANT",
    characterLabel: "Agent",
    ranks: ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"],
    characters: [
      "Astra", "Breach", "Brimstone", "Chamber", "Clove", "Cypher", "Deadlock",
      "Fade", "Gekko", "Harbor", "Iso", "Jett", "KAY/O", "Killjoy", "Neon",
      "Omen", "Phoenix", "Raze", "Reyna", "Sage", "Skye", "Sova", "Tejo",
      "Viper", "Vyse", "Waylay", "Yoru",
    ],
    defaultRank: "Gold",
    defaultCharacter: "Jett",
    defaultConcern: "サイト進入時にクロスヘアがずれ、味方と同時にピークできず最初に倒されます。",
    uploadHint: "ラウンド全体または交戦前後30〜90秒のクリップがおすすめ",
  },
};

export function isGameId(value: string): value is GameId {
  return gameIds.includes(value as GameId);
}
