import type { PerformanceGrade, PerformanceTrend, PlayerPerformance } from "../model/index.js";
import type { RiotPlayerScores } from "../riot/types.js";

const TRENDS: readonly PerformanceTrend[] = ["double_up", "up", "neutral", "down", "double_down"];
const GRADES: readonly PerformanceGrade[] = ["pass", "merit", "distinction"];

const oneOf = <T extends string>(known: readonly T[], value: unknown, fallback: T): T =>
  known.find((word) => word === value) ?? fallback;

const whole = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;

// Riot ships the score under placeholder names (TempValueF is the overall score) and may rename
// them; a word this does not know reads as neutral rather than costing the rest of the breakdown.
export function playerPerformance(
  scores: RiotPlayerScores | null | undefined,
): PlayerPerformance | null {
  const score = scores?.TempValueF;
  if (!scores || typeof score !== "number" || !Number.isFinite(score)) return null;
  const ratings = scores.TempValueL;
  const combat = ratings?.TempValueP;
  const support = ratings?.TempValueQ;
  const trend = (value: string | undefined) => oneOf(TRENDS, value, "neutral");
  return {
    score: Math.round(score),
    combat: whole(scores.TempValueG),
    support: whole(scores.TempValueH),
    grade: oneOf(GRADES, ratings?.TempValueO, "pass"),
    combatTrend: trend(ratings?.TempValueM),
    supportTrend: trend(ratings?.TempValueN),
    combatBreakdown: {
      damage: trend(combat?.damage),
      killImpact: trend(combat?.killImpact),
      deathImpact: trend(combat?.deathImpact),
      trades: trend(combat?.trades),
    },
    supportBreakdown: {
      assists: trend(support?.assists),
      plants: trend(support?.plants),
      defuses: trend(support?.defuses),
      utilityUsage: trend(support?.utilityUsage),
    },
  };
}

const puuidOrNull = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;

export function matchMvps(
  details:
    | { matchMvp?: string | null; teams?: ({ mvp?: string | null } | null)[] | null }
    | null
    | undefined,
): { mvp: string | null; teamMvps: string[] } {
  return {
    mvp: puuidOrNull(details?.matchMvp),
    teamMvps: (details?.teams ?? [])
      .map((team) => puuidOrNull(team?.mvp))
      .filter((puuid): puuid is string => puuid !== null),
  };
}
