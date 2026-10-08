import type { Catalogue } from "../catalogue/Catalogue.js";
import { RankResolver } from "../collection/RankResolver.js";
import type {
  Match,
  MatchPlayer,
  Rank,
  RatingStreak,
  Session,
  SessionMatchAcs,
} from "../model/index.js";
import type { RiotCompetitiveUpdate } from "../riot/types.js";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export interface SessionSummaryOptions {
  since?: string;
  puuid?: string;
  catalogue?: Catalogue;
}

function resolvePlayer(match: Match, puuid?: string): MatchPlayer | undefined {
  if (puuid) {
    const byPuuid = match.players.find((p) => p.puuid === puuid);
    if (byPuuid) return byPuuid;
  }
  if (match.self?.team) {
    const byTeam = match.players.find((p) => p.team === match.self?.team);
    if (byTeam) return byTeam;
  }
  return match.players[0];
}

function resolveMatchResult(match: Match, puuid?: string): "win" | "loss" | "draw" {
  if (match.self?.won === true) return "win";
  if (match.self?.won === false) return "loss";

  const allyTeam = match.self?.team
    ? match.teams.find((t) => t.id === match.self?.team)
    : undefined;
  const enemyTeam = match.self?.team
    ? match.teams.find((t) => t.id !== match.self?.team)
    : undefined;

  if (allyTeam && enemyTeam) {
    if (allyTeam.roundsWon > enemyTeam.roundsWon) return "win";
    if (allyTeam.roundsWon < enemyTeam.roundsWon) return "loss";
    return "draw";
  }

  const player = resolvePlayer(match, puuid);
  if (player) {
    const team = match.teams.find((t) => t.id === player.team);
    if (team?.won) return "win";
  }

  if (match.teams.length >= 2) {
    const [t1, t2] = match.teams;
    if (t1 && t2) {
      if (t1.roundsWon > t2.roundsWon) return "win";
      if (t1.roundsWon < t2.roundsWon) return "loss";
      return "draw";
    }
  }

  return "draw";
}

function findMatchGapStart(matches: Match[]): number | null {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  let lastGapStart: number | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevEnd = new Date(prev.startedAt).getTime() + (prev.lengthMs || 0);
    const currStart = new Date(curr.startedAt).getTime();
    if (currStart - prevEnd >= FOUR_HOURS_MS) {
      lastGapStart = currStart;
    }
  }
  return lastGapStart;
}

function findUpdateGapStart(updates: RiotCompetitiveUpdate[]): number | null {
  const sorted = [...updates].sort((a, b) => a.MatchStartTime - b.MatchStartTime);
  let lastGapStart: number | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (curr.MatchStartTime - prev.MatchStartTime >= FOUR_HOURS_MS) {
      lastGapStart = curr.MatchStartTime;
    }
  }
  return lastGapStart;
}

function resolveEffectiveSince(
  updates: RiotCompetitiveUpdate[],
  matches: Match[],
  now: Date,
  sinceOption?: string,
): number {
  if (sinceOption) {
    return new Date(sinceOption).getTime();
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const gapStart = findMatchGapStart(matches) ?? findUpdateGapStart(updates);
  return gapStart !== null ? Math.max(todayMs, gapStart) : todayMs;
}

function calculateStreak(resultsReversed: Array<"win" | "loss" | "draw">): RatingStreak {
  if (resultsReversed.length === 0) return { kind: null, length: 0 };
  const first = resultsReversed[0];
  if (!first || first === "draw") return { kind: null, length: 0 };
  const kind = first;
  let length = 0;
  for (const r of resultsReversed) {
    if (r === kind) {
      length++;
    } else {
      break;
    }
  }
  return { kind, length };
}

function calculateTilt(resultsChronological: Array<"win" | "loss" | "draw">): boolean {
  const decided = resultsChronological.filter((r) => r === "win" || r === "loss");
  if (decided.length < 3) return false;
  const last3 = decided.slice(-3);
  return last3.every((r) => r === "loss");
}

function resolveMatchAcs(match: Match, puuid?: string): SessionMatchAcs {
  const player = resolvePlayer(match, puuid);
  const stats = player?.stats;
  const rounds = stats?.roundsPlayed && stats.roundsPlayed > 0 ? stats.roundsPlayed : 1;
  const score = stats?.score ?? 0;
  const acs = rounds > 0 ? Math.round(score / rounds) : score;
  return {
    id: match.id,
    matchId: match.id,
    acs,
    map: match.map.name ?? match.map.uuid ?? null,
    agent: player?.agent?.name ?? null,
  };
}

function createFallbackRank(tier: number, rating: number): Rank {
  if (tier === 0) {
    return { tier: 0, name: "Unranked", division: null, icon: null, rating };
  }
  return {
    tier,
    name: `Tier ${tier}`,
    division: null,
    icon: null,
    rating,
  };
}

function resolveRankObject(
  tier: number,
  rating: number,
  resolver?: RankResolver,
): Rank {
  return resolver ? resolver.fromTier(tier, rating) : createFallbackRank(tier, rating);
}

function resolveSessionRanks(
  updates: RiotCompetitiveUpdate[],
  allUpdates: RiotCompetitiveUpdate[],
  catalogue?: Catalogue,
): { rankStart: Rank | null; rankNow: Rank | null } {
  const resolver = catalogue ? new RankResolver(catalogue) : undefined;
  if (updates.length > 0) {
    const sorted = [...updates].sort((a, b) => a.MatchStartTime - b.MatchStartTime);
    const oldest = sorted[0]!;
    const newest = sorted[sorted.length - 1]!;
    return {
      rankStart: resolveRankObject(oldest.TierBeforeUpdate, oldest.RankedRatingBeforeUpdate, resolver),
      rankNow: resolveRankObject(newest.TierAfterUpdate, newest.RankedRatingAfterUpdate, resolver),
    };
  }
  if (allUpdates.length > 0) {
    const sorted = [...allUpdates].sort((a, b) => a.MatchStartTime - b.MatchStartTime);
    const latest = sorted[sorted.length - 1]!;
    const rank = resolveRankObject(latest.TierAfterUpdate, latest.RankedRatingAfterUpdate, resolver);
    return { rankStart: rank, rankNow: rank };
  }
  return { rankStart: null, rankNow: null };
}

export function sessionSummary(
  updates: RiotCompetitiveUpdate[] = [],
  matches: Match[] = [],
  now: Date = new Date(),
  options: SessionSummaryOptions = {},
): Session {
  const effectiveSince = resolveEffectiveSince(updates, matches, now, options.since);
  const sessionMatches = matches
    .filter((m) => new Date(m.startedAt).getTime() >= effectiveSince)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  const matchIds = new Set(sessionMatches.map((m) => m.id));
  const sessionUpdates = updates.filter(
    (u) => matchIds.has(u.MatchID) || u.MatchStartTime >= effectiveSince,
  );

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const matchResults: Array<"win" | "loss" | "draw"> = [];

  for (const m of sessionMatches) {
    const result = resolveMatchResult(m, options.puuid);
    matchResults.push(result);
    if (result === "win") wins++;
    else if (result === "loss") losses++;
    else draws++;
  }

  const rrNet = sessionUpdates.reduce((sum, u) => sum + u.RankedRatingEarned, 0);
  const totalGames = sessionMatches.length;
  const rrPerGame = totalGames > 0 ? Math.round((rrNet / totalGames) * 10) / 10 : 0;

  const streak = calculateStreak([...matchResults].reverse());
  const tilt = calculateTilt(matchResults);

  const { rankStart, rankNow } = resolveSessionRanks(sessionUpdates, updates, options.catalogue);

  const acsEntries = sessionMatches
    .map((m) => resolveMatchAcs(m, options.puuid))
    .sort((a, b) => b.acs - a.acs);

  const bestMatch = acsEntries.length > 0 ? acsEntries[0]! : null;
  const worstMatch = acsEntries.length > 0 ? acsEntries[acsEntries.length - 1]! : null;

  return {
    since: new Date(effectiveSince).toISOString(),
    matches: totalGames,
    wins,
    losses,
    draws,
    rrNet,
    rrPerGame,
    streak,
    rankStart,
    rankNow,
    bestMatch,
    worstMatch,
    tilt,
  };
}
