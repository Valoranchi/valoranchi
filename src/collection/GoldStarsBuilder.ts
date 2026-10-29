import type { GoldStar, GoldStarKey, GoldStars } from "../model/index.js";
import type {
  RiotGoldStarPlayerResponse,
  RiotGoldStarSeason,
  RiotGoldStarsResponse,
} from "../riot/types.js";

const LIFETIME_SEASON_ID = "00000000-0000-0000-0000-000000000000";

const KNOWN: Readonly<Record<string, { key: GoldStarKey; name: string }>> = {
  "745b27f0-4bc2-13a4-4ee7-77be323155c2": { key: "mvp", name: "MVP" },
  "4815a8a2-4649-9bfe-afd2-38ae9cc22898": { key: "masterful", name: "Masterful" },
  "1c926cba-48cb-8aeb-c68d-a1ba2d012784": { key: "topFrag", name: "Top Frag" },
  "244cf4ab-4c27-cc59-3323-c985858d6ddb": { key: "aces", name: "Aces" },
  "0497d585-42ad-61a7-42bc-189571f40e2c": { key: "clutches", name: "Clutches" },
  "1b13755f-4d5a-2c9e-6a39-bea7e6c53e7f": { key: "kills", name: "Kills" },
  "6dc31cfd-41da-895f-9246-a8b63558cdb8": { key: "damage", name: "Damage" },
  "3bc0563a-4fe9-a15c-0078-23a3408d64b5": { key: "trades", name: "Trades" },
  "e43f9acb-448c-4aa1-1591-6db72c0b8dae": { key: "assists", name: "Assists" },
  "2c8b6129-4384-230d-c7e5-cda12019533c": { key: "headshots", name: "Headshots" },
  "bfe96c47-44d0-e473-585d-749146d2d05e": { key: "firstBloods", name: "First Bloods" },
  "352a3ac8-4b2c-db6a-1f36-c0a67b428e65": { key: "spikePlants", name: "Spike Plants" },
};

export class GoldStarsBuilder {
  static build(definitions: RiotGoldStarsResponse, player: RiotGoldStarPlayerResponse): GoldStars {
    const seasons = Object.values(player.tempS ?? {});
    const lifetime = seasons.find((season) => season.tempS === LIFETIME_SEASON_ID);
    const progress = (season: RiotGoldStarSeason | undefined): GoldStar[] =>
      definitions.map((definition) => {
        const earned = season?.tempA?.[definition.id];
        return {
          id: definition.id,
          key: KNOWN[definition.id]?.key ?? null,
          name: KNOWN[definition.id]?.name ?? null,
          threshold: definition.tempT,
          count: earned?.tempC ?? 0,
          best: earned?.tempB ?? null,
        };
      });

    return {
      lifetime: progress(lifetime),
      seasons: seasons
        .filter((season) => season.tempS !== LIFETIME_SEASON_ID)
        .map((season) => ({ seasonId: season.tempS, goldStars: progress(season) })),
      recentMatches: (player.tempM ?? []).map((match) => ({
        matchId: match.id,
        playedAt: new Date(match.tempG).toISOString(),
        players: Object.entries(match.tempP ?? {}).map(([puuid, entry]) => ({
          puuid,
          values: Object.values(entry.tempA ?? {}).map((value) => ({
            id: value.id,
            value: value.tempV,
          })),
        })),
      })),
    };
  }
}
