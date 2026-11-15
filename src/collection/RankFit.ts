import type { Rank, RankFit } from "../model/index.js";
import type { RiotCompetitiveUpdate } from "../riot/types.js";

export interface TierResolver {
  fromTier(tier: number): Rank;
}

const MIN_WINS = 3;
const TIERS_PER_RANK = 3;
const RADIANT_TIER = 27;

function ranksAbove(averageGain: number): RankFit["ranksAbove"] {
  if (averageGain > 30) return 2;
  if (averageGain >= 26) return 1;
  if (averageGain >= 13) return 0;
  return -1;
}

function verdictFor(ranks: RankFit["ranksAbove"]): RankFit["verdict"] {
  if (ranks === -1) return "above";
  if (ranks === 0) return "fit";
  return "below";
}

function expectedTier(current: number, ranks: number): number {
  return Math.min(RADIANT_TIER, Math.max(TIERS_PER_RANK, current + ranks * TIERS_PER_RANK));
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function calculateRankAverages(updates: RiotCompetitiveUpdate[]): {
  averageGain: number | null;
  averageLoss: number | null;
  gains: number[];
  losses: number[];
} {
  const earned = updates
    .filter((update) => update.TierAfterUpdate > 0)
    .map((update) => update.RankedRatingEarned);
  const gains = earned.filter((value) => value > 0);
  const losses = earned.filter((value) => value < 0).map((value) => -value);
  return {
    averageGain: average(gains),
    averageLoss: average(losses),
    gains,
    losses,
  };
}

export function rankFit(
  current: Rank | null,
  updates: RiotCompetitiveUpdate[],
  resolver: TierResolver,
): RankFit {
  const { averageGain, averageLoss, gains } = calculateRankAverages(updates);
  const empty = { averageGain, averageLoss, sample: gains.length };
  if (!current || current.tier === 0 || averageGain === null || gains.length < MIN_WINS) {
    return { verdict: null, ranksAbove: 0, expected: null, ...empty };
  }
  const ranks = ranksAbove(averageGain);
  const tier = expectedTier(current.tier, ranks);
  return {
    verdict: verdictFor(ranks),
    ranksAbove: ranks,
    expected: tier === current.tier ? current : resolver.fromTier(tier),
    ...empty,
  };
}
