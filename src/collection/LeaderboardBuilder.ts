import type { Catalogue } from "../catalogue/Catalogue.js";
import type { Leaderboard, LeaderboardEntry, RankCutoff } from "../model/index.js";
import type { RiotLeaderboardResponse } from "../riot/types.js";
import { RankResolver } from "./RankResolver.js";

export class LeaderboardBuilder {
  private readonly rankResolver: RankResolver;

  constructor(catalogue: Catalogue) {
    this.rankResolver = new RankResolver(catalogue);
  }

  build(raw: RiotLeaderboardResponse): Leaderboard {
    const entries: LeaderboardEntry[] = (raw.Players ?? []).map((p) => ({
      rank: p.leaderboardRank,
      puuid: p.puuid,
      gameName: p.gameName,
      tagLine: p.tagLine,
      anonymized: Boolean(p.IsAnonymized),
      banned: Boolean(p.IsBanned),
      rating: p.rankedRating,
      wins: p.numberOfWins,
      tier: this.rankResolver.fromTier(p.competitiveTier, p.rankedRating),
    }));

    const tierThresholds: Record<string, number> = {};
    for (const [tier, detail] of Object.entries(raw.tierDetails ?? {})) {
      tierThresholds[tier] = detail.rankedRatingThreshold;
    }

    return {
      season: raw.SeasonID,
      total: raw.totalPlayers,
      entries,
      tierThresholds,
    };
  }
}

// Radiant is the top 500 past its line, so where the 500th is already past it,
// the price is passing that player.
export function immortalCutoffs(board: {
  tierDetails?: Record<string, { rankedRatingThreshold: number }>;
  Players?: { leaderboardRank: number; rankedRating: number }[];
}): RankCutoff[] | null {
  const line = (tier: number) => board.tierDetails?.[String(tier)]?.rankedRatingThreshold;
  const [immortal2, immortal3, radiant] = [25, 26, 27].map(line);
  if (immortal2 == null || immortal3 == null || radiant == null) return null;
  const last = board.Players?.find((p) => p.leaderboardRank === 500);
  return [
    { tier: 25, rr: immortal2 },
    { tier: 26, rr: immortal3 },
    { tier: 27, rr: Math.max(radiant, (last?.rankedRating ?? -1) + 1) },
  ];
}
