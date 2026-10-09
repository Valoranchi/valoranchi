import fs from "node:fs";
import path from "node:path";
import prettier from "prettier";
import { createGenerator } from "ts-json-schema-generator";

const types = [
  "OwnedItems",
  "Loadout",
  "Wallet",
  "Player",
  "Friend",
  "FriendRequest",
  "BlockedPlayer",
  "Conversation",
  "Message",
  "Store",
  "MatchSummary",
  "Match",
  "Mmr",
  "RankChange",
  "LiveMatch",
  "Party",
  "AccountXp",
  "ContractProgress",
  "Mission",
  "Penalty",
  "Favourite",
  "LeaderboardEntry",
  "Leaderboard",
  "Offer",
  "Order",
  "GameSession",
  "Session",
  "Content",
  "QueueConfig",
  "Premier",
  "PartyInvite",
  "PartyRequest",
  "CustomGameSettings",
  "CustomGameConfigs",
  "PlayerSettings",
  "ClientInfo",
  "Participant",
  "RatingTrend",
  "PerformanceSummary",
  "PlayerAssessment",
  "LoadoutDiff",
  "CollectionValue",
  "StoreHistory",
  "MatchSyncResult",
  "OfficialAccount",
  "OfficialProfile",
  "Wishlist",
  "WishlistHit",
  "WishlistCheck",
];

const schemaDir = path.resolve("schema");

if (!fs.existsSync(schemaDir)) {
  fs.mkdirSync(schemaDir, { recursive: true });
}

const prettierConfig = JSON.parse(fs.readFileSync(".prettierrc", "utf-8"));

for (const type of types) {
  const config = {
    path: "src/model/index.ts",
    tsconfig: "tsconfig.json",
    type,
    expose: "all",
    topRef: true,
    jsDoc: "none",
  };

  const schema = createGenerator(config).createSchema(type);
  const rawJson = JSON.stringify(schema, null, 2);
  const formatted = await prettier.format(rawJson, { parser: "json", ...prettierConfig });
  const outFile = path.join(schemaDir, `${type}.json`);
  fs.writeFileSync(outFile, formatted, "utf-8");
  console.log(`Generated ${outFile}`);
}
