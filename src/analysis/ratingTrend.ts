import type { Rank, RatingTrend } from "../model/index.js";
import type { RiotCompetitiveUpdate } from "../riot/types.js";
import { calculateRankAverages } from "../collection/RankFit.js";

export function calculateStreak(updates: RiotCompetitiveUpdate[]): RatingTrend["streak"] {
  if (updates.length === 0) return { kind: null, length: 0 };
  const firstEarned = updates[0]!.RankedRatingEarned;
  if (firstEarned === 0) return { kind: null, length: 0 };
  const kind = firstEarned > 0 ? "win" : "loss";
  let length = 0;
  for (const u of updates) {
    if (
      (kind === "win" && u.RankedRatingEarned > 0) ||
      (kind === "loss" && u.RankedRatingEarned < 0)
    ) {
      length++;
    } else {
      break;
    }
  }
  return { kind, length };
}

function calculateNet(updates: RiotCompetitiveUpdate[]): RatingTrend["net"] {
  const sum = (items: RiotCompetitiveUpdate[]) =>
    items.reduce((acc, u) => acc + u.RankedRatingEarned, 0);
  return {
    last5: sum(updates.slice(0, 5)),
    last10: sum(updates.slice(0, 10)),
    last20: sum(updates.slice(0, 20)),
  };
}

function calculateTargets(
  currentRating: number,
  tier: number,
  averages: { averageGain: number | null; averageLoss: number | null },
): { toNextRank: RatingTrend["toNextRank"]; toDemotion: RatingTrend["toDemotion"] } {
  const isRadiant = tier >= 27;
  const ratingToNext = isRadiant ? 0 : Math.max(0, 100 - currentRating);
  const winsAtCurrentPace =
    !isRadiant && averages.averageGain && averages.averageGain > 0
      ? Math.ceil(ratingToNext / averages.averageGain)
      : null;

  const isUnranked = tier === 0;
  const ratingToDemote = isUnranked ? 0 : currentRating;
  // A loss stops at 0 RR, and only a loss taken at 0 RR demotes.
  const lossesAtCurrentPace =
    !isUnranked && averages.averageLoss && averages.averageLoss > 0
      ? Math.ceil(currentRating / averages.averageLoss) + 1
      : null;

  return {
    toNextRank: { rating: ratingToNext, winsAtCurrentPace },
    toDemotion: { rating: ratingToDemote, lossesAtCurrentPace },
  };
}

export function ratingTrend(
  updates: RiotCompetitiveUpdate[],
  currentRank: Rank | null = null,
): RatingTrend {
  const streak = calculateStreak(updates);
  const net = calculateNet(updates);
  const { averageGain, averageLoss, gains } = calculateRankAverages(updates);
  const totalGames = updates.length;
  const winRate = totalGames === 0 ? 0 : Math.round((gains.length / totalGames) * 100) / 100;

  const currentRating = currentRank?.rating ?? updates[0]?.RankedRatingAfterUpdate ?? 0;
  const tier = currentRank?.tier ?? updates[0]?.TierAfterUpdate ?? 0;
  const { toNextRank, toDemotion } = calculateTargets(currentRating, tier, {
    averageGain,
    averageLoss,
  });

  const pace: RatingTrend["pace"] =
    net.last10 > 0 ? "climbing" : net.last10 < 0 ? "falling" : "holding";

  return {
    streak,
    net,
    winRate,
    perGame: { averageGain, averageLoss },
    toNextRank,
    toDemotion,
    pace,
  };
}
