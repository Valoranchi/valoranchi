export const RATING_STATS = ["winRate", "kd", "acs", "adr", "kast", "place"] as const;
export type RatingStat = (typeof RATING_STATS)[number];
export type Quantiles = readonly number[];
export type RatingBenchmarks = Record<RatingStat, Quantiles>;
export type RatingGrade = "D" | "C" | "B" | "A" | "S";
export type PlayerRatingStats = Partial<Record<RatingStat, number>>;
export type PlayerRating = {
  score: number;
  grade: RatingGrade;
  stats: Partial<Record<RatingStat, { value: number; percentile: number; grade: RatingGrade }>>;
};

export const RATING_WEIGHTS: Record<RatingStat, number> = {
  winRate: 0.2,
  kd: 0.2,
  acs: 0.2,
  adr: 0.15,
  kast: 0.15,
  place: 0.1,
};

const STEPS = 20;
const GRADE_FLOORS: readonly (readonly [number, RatingGrade])[] = [
  [900, "S"],
  [700, "A"],
  [400, "B"],
  [200, "C"],
];

export function quantiles(values: readonly number[]): Quantiles {
  if (values.length === 0) throw new RangeError("quantiles needs at least one value");
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const position = (i * (sorted.length - 1)) / STEPS;
    const below = Math.floor(position);
    const above = Math.ceil(position);
    return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
  });
}

function shareBelow(q: Quantiles, value: number): number {
  const last = q.length - 1;
  if (value < q[0]) return 0;
  if (value >= q[last]) return 1;
  let i = last - 1;
  while (q[i] > value) i--;
  return (i + (value - q[i]) / (q[i + 1] - q[i])) / last;
}

// A lower place is better, so the players it beats are the ones above it.
export function percentileOf(stat: RatingStat, q: Quantiles, value: number): number {
  const share = shareBelow(q, value);
  return stat === "place" ? 1 - share : share;
}

export function ratingGrade(score: number): RatingGrade {
  return GRADE_FLOORS.find(([floor]) => score >= floor)?.[1] ?? "D";
}

export function playerRating(
  stats: PlayerRatingStats,
  benchmarks: RatingBenchmarks,
): PlayerRating | null {
  const rated: PlayerRating["stats"] = {};
  let weighted = 0;
  let weights = 0;
  for (const stat of RATING_STATS) {
    const value = stats[stat];
    const cuts = benchmarks[stat];
    // Benchmarks arrive over the network; a stat without cuts is left out like a missing one.
    if (typeof value !== "number" || !Number.isFinite(value) || !cuts?.length) continue;
    const percentile = percentileOf(stat, cuts, value);
    rated[stat] = { value, percentile, grade: ratingGrade(percentile * 1000) };
    weighted += percentile * RATING_WEIGHTS[stat];
    weights += RATING_WEIGHTS[stat];
  }
  if (weights === 0) return null;
  const score = Math.round((weighted / weights) * 1000);
  return { score, grade: ratingGrade(score), stats: rated };
}

export function matchRating(performance: number): { score: number; grade: RatingGrade } {
  const score = Number.isFinite(performance)
    ? Math.round(Math.min(1000, Math.max(0, performance * 2)))
    : 0;
  return { score, grade: ratingGrade(score) };
}

export function scoreboardPlaces(
  players: readonly { puuid: string; performance?: number | null; score: number }[],
): Map<string, number> {
  const byPerformance = players.every(
    (p) => typeof p.performance === "number" && Number.isFinite(p.performance),
  );
  const key = (p: (typeof players)[number]) => (byPerformance ? (p.performance ?? 0) : p.score);
  return new Map([...players].sort((a, b) => key(b) - key(a)).map((p, i) => [p.puuid, i + 1]));
}
