import type { Catalogue } from "../catalogue/Catalogue.js";
import type {
  Match,
  MatchPlayer,
  MatchRound,
  MatchSummary,
  PerformanceGrade,
  PerformanceTrend,
  PlayerPerformance,
} from "../model/index.js";
import type {
  RiotDamage,
  RiotMatchDetailsResponse,
  RiotMatchPlayer,
  RiotMatchTeam,
  RiotPlayerScores,
  RiotRoundPlayerStats,
  RiotRoundResult,
} from "../riot/types.js";
import {
  RankResolver,
  resolveAgent,
  resolveCard,
  resolveMap,
  resolveSeasonName,
  resolveTitle,
} from "./RankResolver.js";

const PERFORMANCE_TRENDS: readonly PerformanceTrend[] = [
  "double_up",
  "up",
  "neutral",
  "down",
  "double_down",
];

const PERFORMANCE_GRADES: readonly PerformanceGrade[] = ["pass", "merit", "distinction"];

function toTrend(value: string | undefined): PerformanceTrend {
  return PERFORMANCE_TRENDS.find((trend) => trend === value) ?? "neutral";
}

function toGrade(value: string | undefined): PerformanceGrade {
  return PERFORMANCE_GRADES.find((grade) => grade === value) ?? "pass";
}

export class MatchBuilder {
  private readonly details: RiotMatchDetailsResponse;
  private readonly catalogue: Catalogue;
  private readonly selfPuuid: string;
  private readonly rankResolver: RankResolver;

  constructor(details: RiotMatchDetailsResponse, catalogue: Catalogue, selfPuuid: string) {
    this.details = details;
    this.catalogue = catalogue;
    this.selfPuuid = selfPuuid;
    this.rankResolver = new RankResolver(catalogue);
  }

  static toSummary(details: RiotMatchDetailsResponse, catalogue: Catalogue): MatchSummary {
    const info = details.matchInfo;
    return {
      id: info.matchId,
      startedAt: new Date(info.gameStartMillis).toISOString(),
      queue: info.queueID,
      map: resolveMap(catalogue, info.mapId),
    };
  }

  build(): Match {
    const info = this.details.matchInfo;
    const roundResults = this.details.roundResults ?? [];
    return {
      id: info.matchId,
      startedAt: new Date(info.gameStartMillis).toISOString(),
      lengthMs: info.gameLengthMillis,
      completed: info.isCompleted,
      queue: info.queueID,
      ranked: info.isRanked,
      custom: info.provisioningFlowID === "CustomGame" || Boolean(info.customGameName),
      customName: info.customGameName ?? null,
      map: resolveMap(this.catalogue, info.mapId),
      mode: info.gameMode ?? "",
      season: {
        uuid: info.seasonId ?? "",
        name: resolveSeasonName(this.catalogue, info.seasonId),
      },
      teams: this.buildTeams(this.details.teams),
      mvp: this.details.matchMvp || null,
      players: this.buildPlayers(this.details.players, roundResults),
      rounds: this.buildRounds(roundResults),
      self: this.buildSelf(this.details.players, this.details.teams),
      replayRecorded: Boolean(info.isReplayRecorded),
    };
  }

  private buildTeams(teams: RiotMatchTeam[] | null): Match["teams"] {
    if (!teams) return [];
    return teams.map((t) => ({
      id: t.teamId,
      won: t.won,
      roundsWon: t.roundsWon,
      roundsPlayed: t.roundsPlayed,
      mvp: t.mvp || null,
    }));
  }

  private buildPlayers(players: RiotMatchPlayer[], roundResults: RiotRoundResult[]): MatchPlayer[] {
    return players
      .filter((p) => p.stats !== null && p.stats !== undefined)
      .map((p) => this.buildPlayer(p, roundResults));
  }

  private buildPlayer(player: RiotMatchPlayer, roundResults: RiotRoundResult[]): MatchPlayer {
    return {
      puuid: player.subject,
      gameName: player.gameName,
      tagLine: player.tagLine,
      team: player.teamId,
      partyId: player.partyId ?? null,
      agent: resolveAgent(this.catalogue, player.characterId),
      rank: this.rankResolver.fromTier(player.competitiveTier),
      accountLevel: player.accountLevel ?? 0,
      card: resolveCard(this.catalogue, player.playerCard),
      title: resolveTitle(this.catalogue, player.playerTitle),
      stats: this.computePlayerStats(player, roundResults),
      performance: this.buildPerformance(player.scores),
    };
  }

  private buildPerformance(scores: RiotPlayerScores | null | undefined): PlayerPerformance | null {
    if (scores?.TempValueF === undefined) return null;
    const ratings = scores.TempValueL;
    const combat = ratings?.TempValueP;
    const support = ratings?.TempValueQ;
    return {
      score: Math.round(scores.TempValueF),
      combat: Math.round(scores.TempValueG ?? 0),
      support: Math.round(scores.TempValueH ?? 0),
      grade: toGrade(ratings?.TempValueO),
      combatTrend: toTrend(ratings?.TempValueM),
      supportTrend: toTrend(ratings?.TempValueN),
      combatBreakdown: {
        damage: toTrend(combat?.damage),
        killImpact: toTrend(combat?.killImpact),
        deathImpact: toTrend(combat?.deathImpact),
        trades: toTrend(combat?.trades),
      },
      supportBreakdown: {
        assists: toTrend(support?.assists),
        plants: toTrend(support?.plants),
        defuses: toTrend(support?.defuses),
        utilityUsage: toTrend(support?.utilityUsage),
      },
    };
  }

  private computePlayerStats(
    player: RiotMatchPlayer,
    roundResults: RiotRoundResult[],
  ): MatchPlayer["stats"] {
    let headshots = 0;
    let bodyshots = 0;
    let legshots = 0;
    let damage = 0;
    let firstBloods = 0;
    let plants = 0;
    let defuses = 0;

    for (const round of roundResults) {
      if (round.bombPlanter === player.subject) plants++;
      if (round.bombDefuser === player.subject) defuses++;
      const counts = this.scanRoundForPlayer(player.subject, round.playerStats ?? []);
      headshots += counts.headshots;
      bodyshots += counts.bodyshots;
      legshots += counts.legshots;
      damage += counts.damage;
      if (counts.earliestKiller === player.subject) firstBloods++;
    }

    const s = player.stats;
    return {
      score: s?.score ?? 0,
      kills: s?.kills ?? 0,
      deaths: s?.deaths ?? 0,
      assists: s?.assists ?? 0,
      roundsPlayed: s?.roundsPlayed ?? 0,
      headshots,
      bodyshots,
      legshots,
      damage,
      firstBloods,
      plants,
      defuses,
      abilityCasts: {
        c: s?.abilityCasts?.grenadeCasts ?? 0,
        q: s?.abilityCasts?.ability1Casts ?? 0,
        e: s?.abilityCasts?.ability2Casts ?? 0,
        x: s?.abilityCasts?.ultimateCasts ?? 0,
      },
    };
  }

  private scanRoundForPlayer(
    puuid: string,
    playerStats: RiotRoundPlayerStats[],
  ): {
    headshots: number;
    bodyshots: number;
    legshots: number;
    damage: number;
    earliestKiller: string | null;
  } {
    let headshots = 0;
    let bodyshots = 0;
    let legshots = 0;
    let damage = 0;
    let earliestTime = Infinity;
    let earliestKiller: string | null = null;

    for (const rps of playerStats) {
      if (rps.subject === puuid && rps.damage) {
        const sum = this.sumDamage(rps.damage);
        headshots += sum.headshots;
        bodyshots += sum.bodyshots;
        legshots += sum.legshots;
        damage += sum.damage;
      }
      for (const k of rps.kills ?? []) {
        if (k.roundTime < earliestTime) {
          earliestTime = k.roundTime;
          earliestKiller = k.killer;
        }
      }
    }
    return { headshots, bodyshots, legshots, damage, earliestKiller };
  }

  private sumDamage(damages: RiotDamage[]): {
    headshots: number;
    bodyshots: number;
    legshots: number;
    damage: number;
  } {
    let headshots = 0;
    let bodyshots = 0;
    let legshots = 0;
    let damage = 0;
    for (const d of damages) {
      headshots += d.headshots ?? 0;
      bodyshots += d.bodyshots ?? 0;
      legshots += d.legshots ?? 0;
      damage += d.damage ?? 0;
    }
    return { headshots, bodyshots, legshots, damage };
  }

  private buildRounds(roundResults: RiotRoundResult[]): MatchRound[] {
    return roundResults.map((r) => ({
      number: r.roundNum,
      winner: r.winningTeam,
      result: r.roundResult,
      ceremony: r.roundCeremony ?? null,
      site: r.plantSite ?? null,
      planter: r.bombPlanter ?? null,
      defuser: r.bombDefuser ?? null,
      plantedAt: r.plantRoundTime ?? null,
      defusedAt: r.defuseRoundTime ?? null,
      kills: this.buildKills(r.playerStats ?? []),
    }));
  }

  private buildKills(playerStats: RiotRoundPlayerStats[]): MatchRound["kills"] {
    const kills: MatchRound["kills"] = [];
    for (const rps of playerStats) {
      for (const k of rps.kills ?? []) {
        const kind = k.finishingDamage?.damageType ?? "Unknown";
        const uuid = k.finishingDamage?.damageItem ?? "";
        const weaponEntity = kind === "Weapon" ? this.catalogue.getWeapon(uuid) : undefined;
        kills.push({
          at: k.gameTime ?? 0,
          roundTime: k.roundTime,
          killer: k.killer,
          victim: k.victim,
          assistants: k.assistants ?? [],
          weapon: {
            uuid,
            name: weaponEntity?.displayName ?? null,
            kind,
          },
          location: k.victimLocation ? { x: k.victimLocation.x, y: k.victimLocation.y } : null,
        });
      }
    }
    return kills.sort((a, b) => a.roundTime - b.roundTime);
  }

  private buildSelf(
    players: RiotMatchPlayer[],
    teams: RiotMatchTeam[] | null,
  ): { team: string; won: boolean | null } | null {
    const me = players.find((p) => p.subject === this.selfPuuid);
    if (!me) return null;
    if (!teams) {
      return { team: me.teamId, won: null };
    }
    const team = teams.find((t) => t.teamId === me.teamId);
    return {
      team: me.teamId,
      won: team ? team.won : null,
    };
  }
}
