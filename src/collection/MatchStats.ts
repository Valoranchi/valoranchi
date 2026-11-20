export type RiotPlayerSlice = {
  subject: string;
  teamId?: string | null;
  stats?: {
    score?: number;
    roundsPlayed?: number;
    kills?: number;
    deaths?: number;
    assists?: number;
    abilityCasts?: {
      grenadeCasts?: number;
      ability1Casts?: number;
      ability2Casts?: number;
      ultimateCasts?: number;
    } | null;
  } | null;
};

export type RiotKillSlice = {
  roundTime?: number;
  timeSinceRoundStartMillis?: number;
  killer: string;
  victim: string;
  assistants?: string[] | null;
  round?: number;
  finishingDamage?: { damageType?: string | null; damageItem?: string | null } | null;
};

export type RiotDamageSlice = {
  receiver: string;
  damage: number;
  headshots?: number;
  bodyshots?: number;
  legshots?: number;
};

export type RiotEconomySlice = {
  loadoutValue?: number;
  weapon?: string | null;
};

export type RiotRoundPlayerStatsSlice = {
  subject: string;
  kills?: RiotKillSlice[] | null;
  damage?: RiotDamageSlice[] | null;
  score?: number;
  economy?: RiotEconomySlice | null;
};

export type RiotRoundResultSlice = {
  roundNum: number;
  roundResult?: string | null;
  roundResultCode?: string | null;
  roundCeremony?: string | null;
  winningTeam?: string | null;
  bombPlanter?: string | null;
  bombDefuser?: string | null;
  playerStats?: RiotRoundPlayerStatsSlice[] | null;
};

export type RiotMatchDetailsSlice = {
  players?: RiotPlayerSlice[] | null;
  roundResults?: RiotRoundResultSlice[] | null;
  kills?: RiotKillSlice[] | null;
};

export type ComputedMultiKills = {
  k2: number;
  k3: number;
  k4: number;
  k5: number;
};

export type ComputedClutches = {
  count: number;
  best: number;
};

export type ComputedAbilityCasts = {
  c: number;
  q: number;
  e: number;
  x: number;
};

export type ComputedWeaponStats = {
  weaponId: string;
  rounds: number;
  kills: number;
  roundsWon: number;
};

export type ComputedPlayerStats = {
  puuid: string;
  acs: number;
  kd: number;
  plusMinus: number;
  adr: number | null;
  damageDelta: number | null;
  hsPct: number | null;
  kast: number | null;
  firstKills: number;
  firstDeaths: number;
  flawlessRounds: number;
  multiKills: ComputedMultiKills;
  clutches: ComputedClutches | null;
  plants: number;
  defuses: number;
  abilityCasts: ComputedAbilityCasts;
  avgLoadout: number | null;
  weapons: ComputedWeaponStats[];
};

export type ComputedRoundStats = {
  n: number;
  winningTeam: string | null;
  result: string | null;
  resultCode: string | null;
  ceremony: string | null;
};

export type ComputedMatchStats = {
  players: Map<string, ComputedPlayerStats>;
  rounds: ComputedRoundStats[];
};

// Riot marks every side `won: false` in a match nobody won, which is no result rather than a loss.
export function teamWon(
  teams: { teamId?: string; won?: boolean | null }[] | null | undefined,
  teamId: string | null | undefined,
): boolean | null {
  if (!teams?.some((team) => team.won === true)) return null;
  const team = teams.find((each) => each.teamId === teamId);
  return typeof team?.won === "boolean" ? team.won : null;
}

// Riot serves the details of a remade match but leaves it out of the history and moves no rank.
export const isRemake = (
  details: { matchInfo?: { completionState?: string | null } | null } | null,
): boolean => details?.matchInfo?.completionState === "Remake";

export function getKillTime(k: RiotKillSlice): number {
  return k.timeSinceRoundStartMillis ?? k.roundTime ?? 0;
}

export function getRoundKills(
  round: RiotRoundResultSlice,
  topLevelKills: RiotKillSlice[] | null | undefined,
): RiotKillSlice[] {
  const fromRound = (round.playerStats ?? []).flatMap((ps) => ps.kills ?? []);
  const kills =
    fromRound.length > 0
      ? fromRound
      : (topLevelKills ?? []).filter((k) => k.round === round.roundNum);
  return kills.slice().sort((a, b) => getKillTime(a) - getKillTime(b));
}

function computeFirstKillsAndDeaths(
  roundResults: RiotRoundResultSlice[],
  topLevelKills: RiotKillSlice[] | null | undefined,
): { fk: Map<string, number>; fd: Map<string, number> } {
  const fk = new Map<string, number>();
  const fd = new Map<string, number>();
  for (const r of roundResults) {
    const kills = getRoundKills(r, topLevelKills);
    if (kills.length > 0) {
      const first = kills[0];
      fk.set(first.killer, (fk.get(first.killer) ?? 0) + 1);
      fd.set(first.victim, (fd.get(first.victim) ?? 0) + 1);
    }
  }
  return { fk, fd };
}

function computeMultiKills(
  roundResults: RiotRoundResultSlice[],
  topLevelKills: RiotKillSlice[] | null | undefined,
): Map<string, ComputedMultiKills> {
  const res = new Map<string, ComputedMultiKills>();
  for (const r of roundResults) {
    const kills = getRoundKills(r, topLevelKills);
    const roundKillerCount = new Map<string, number>();
    for (const k of kills) {
      roundKillerCount.set(k.killer, (roundKillerCount.get(k.killer) ?? 0) + 1);
    }
    for (const [puuid, count] of roundKillerCount.entries()) {
      if (!res.has(puuid)) res.set(puuid, { k2: 0, k3: 0, k4: 0, k5: 0 });
      const mk = res.get(puuid)!;
      if (count === 2) mk.k2++;
      else if (count === 3) mk.k3++;
      else if (count === 4) mk.k4++;
      else if (count >= 5) mk.k5++;
    }
  }
  return res;
}

function computeBombStats(roundResults: RiotRoundResultSlice[]): {
  plants: Map<string, number>;
  defuses: Map<string, number>;
} {
  const plants = new Map<string, number>();
  const defuses = new Map<string, number>();
  for (const r of roundResults) {
    if (r.bombPlanter) {
      plants.set(r.bombPlanter, (plants.get(r.bombPlanter) ?? 0) + 1);
    }
    if (r.bombDefuser) {
      defuses.set(r.bombDefuser, (defuses.get(r.bombDefuser) ?? 0) + 1);
    }
  }
  return { plants, defuses };
}

function computeAvgLoadout(roundResults: RiotRoundResultSlice[], puuid: string): number | null {
  const vals: number[] = [];
  for (const r of roundResults) {
    const ps = (r.playerStats ?? []).find((s) => s.subject === puuid);
    const lv = ps?.economy?.loadoutValue;
    if (typeof lv === "number" && !isNaN(lv)) {
      vals.push(lv);
    }
  }
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function computePlayerWeapons(
  roundResults: RiotRoundResultSlice[],
  topLevelKills: RiotKillSlice[] | null | undefined,
  puuid: string,
  teamId: string | null | undefined,
): ComputedWeaponStats[] {
  const weapons = new Map<string, ComputedWeaponStats>();
  for (const r of roundResults) {
    const weaponId = (r.playerStats ?? [])
      .find((s) => s.subject === puuid)
      ?.economy?.weapon?.toLowerCase();
    if (!weaponId) continue;
    const entry = weapons.get(weaponId) ?? { weaponId, rounds: 0, kills: 0, roundsWon: 0 };
    entry.rounds++;
    entry.kills += getRoundKills(r, topLevelKills).filter(
      (k) =>
        k.killer === puuid &&
        k.finishingDamage?.damageType === "Weapon" &&
        k.finishingDamage.damageItem?.toLowerCase() === weaponId,
    ).length;
    if (teamId && r.winningTeam === teamId) entry.roundsWon++;
    weapons.set(weaponId, entry);
  }
  return [...weapons.values()].sort((a, b) => b.rounds - a.rounds);
}

function computePlayerDamageStats(
  roundResults: RiotRoundResultSlice[],
  puuid: string,
  teamId: string | null | undefined,
  playerTeams: Map<string, string | null>,
  roundCount: number,
): { adr: number | null; hsPct: number | null; damageDelta: number | null } {
  if (roundCount === 0) return { adr: null, hsPct: null, damageDelta: null };
  let enemyDmg = 0;
  let receivedDmg = 0;
  let hs = 0;
  let allHits = 0;
  for (const r of roundResults) {
    const ps = (r.playerStats ?? []).find((s) => s.subject === puuid);
    for (const d of ps?.damage ?? []) {
      const isSelf = d.receiver === puuid;
      const isTeammate = teamId != null && playerTeams.get(d.receiver) === teamId;
      if (!isSelf && !isTeammate) enemyDmg += d.damage ?? 0;
      const h = d.headshots ?? 0;
      const b = d.bodyshots ?? 0;
      const l = d.legshots ?? 0;
      hs += h;
      allHits += h + b + l;
    }
    for (const other of r.playerStats ?? []) {
      const otherTeam = playerTeams.get(other.subject);
      if (!otherTeam || otherTeam === teamId) continue;
      for (const d of other.damage ?? []) {
        if (d.receiver === puuid) receivedDmg += d.damage ?? 0;
      }
    }
  }
  return {
    adr: Math.round(enemyDmg / roundCount),
    hsPct: allHits > 0 ? hs / allHits : null,
    damageDelta: teamId ? Math.round((enemyDmg - receivedDmg) / roundCount) : null,
  };
}

function computeFlawlessRounds(
  roundResults: RiotRoundResultSlice[],
  topLevelKills: RiotKillSlice[] | null | undefined,
  playerTeams: Map<string, string | null>,
): Map<string, number> {
  const res = new Map<string, number>();
  for (const r of roundResults) {
    const winner = r.winningTeam;
    if (!winner) continue;
    const kills = getRoundKills(r, topLevelKills);
    if (kills.some((k) => playerTeams.get(k.victim) === winner)) continue;
    res.set(winner, (res.get(winner) ?? 0) + 1);
  }
  return res;
}

// A trade is the killer dying to a teammate of the victim's within 5000 ms.
function isTrade(
  victimDeath: RiotKillSlice,
  allKills: RiotKillSlice[],
  victimPuuid: string,
  victimTeam: string,
  playerTeams: Map<string, string | null>,
): boolean {
  const dTime = getKillTime(victimDeath);
  return allKills.some((k) => {
    if (k.victim !== victimDeath.killer) return false;
    if (k.killer === victimPuuid) return false;
    if (playerTeams.get(k.killer) !== victimTeam) return false;
    const kTime = getKillTime(k);
    return kTime >= dTime && kTime - dTime <= 5000;
  });
}

function computePlayerKast(
  roundResults: RiotRoundResultSlice[],
  topLevelKills: RiotKillSlice[] | null | undefined,
  puuid: string,
  teamId: string | null | undefined,
  playerTeams: Map<string, string | null>,
  roundCount: number,
): number | null {
  if (roundCount === 0 || !teamId) return null;
  let kastRounds = 0;
  for (const r of roundResults) {
    const kills = getRoundKills(r, topLevelKills);
    const gotKill = kills.some((k) => k.killer === puuid);
    const gotAssist = kills.some((k) => (k.assistants ?? []).includes(puuid));
    const deaths = kills.filter((k) => k.victim === puuid);
    const survived = deaths.length === 0;
    const traded = deaths.some((d) => isTrade(d, kills, puuid, teamId, playerTeams));
    if (gotKill || gotAssist || survived || traded) kastRounds++;
  }
  return Math.round((kastRounds / roundCount) * 100);
}

// A clutch is the round won after being alone against one or more enemies.
function checkClutchInRound(
  round: RiotRoundResultSlice,
  kills: RiotKillSlice[],
  puuid: string,
  teamId: string,
  allPlayers: RiotPlayerSlice[],
): number | null {
  if (round.winningTeam !== teamId || kills.length === 0) return null;
  const lastKillTime = getKillTime(kills[kills.length - 1]);
  const pDeath = kills.find((k) => k.victim === puuid);
  if (pDeath && getKillTime(pDeath) <= lastKillTime) return null;
  const mates = allPlayers.filter((p) => p.subject !== puuid && p.teamId === teamId);
  if (mates.length === 0) return null;
  const mateDeathTimes: number[] = [];
  for (const m of mates) {
    const death = kills.find((k) => k.victim === m.subject && getKillTime(k) <= lastKillTime);
    if (!death) return null;
    mateDeathTimes.push(getKillTime(death));
  }
  const timeAlone = Math.max(...mateDeathTimes);
  const enemies = allPlayers.filter((p) => p.teamId !== teamId);
  const aliveEnemies = enemies.filter((e) => {
    const d = kills.find((k) => k.victim === e.subject);
    return !d || getKillTime(d) >= timeAlone;
  }).length;
  return aliveEnemies >= 1 ? aliveEnemies : null;
}

function computePlayerClutches(
  roundResults: RiotRoundResultSlice[],
  topLevelKills: RiotKillSlice[] | null | undefined,
  puuid: string,
  teamId: string | null | undefined,
  allPlayers: RiotPlayerSlice[],
  roundCount: number,
): ComputedClutches | null {
  if (roundCount === 0 || !teamId) return null;
  let count = 0;
  let best = 0;
  for (const r of roundResults) {
    const kills = getRoundKills(r, topLevelKills);
    const n = checkClutchInRound(r, kills, puuid, teamId, allPlayers);
    if (n != null) {
      count++;
      if (n > best) best = n;
    }
  }
  return { count, best };
}

export function computeMatchStats(details: RiotMatchDetailsSlice): ComputedMatchStats {
  const players = details.players ?? [];
  const roundResults = details.roundResults ?? [];
  const roundCount = roundResults.length;
  const playerTeams = new Map(players.map((p) => [p.subject, p.teamId ?? null]));
  const { fk, fd } = computeFirstKillsAndDeaths(roundResults, details.kills);
  const mkMap = computeMultiKills(roundResults, details.kills);
  const flawless = computeFlawlessRounds(roundResults, details.kills, playerTeams);
  const { plants, defuses } = computeBombStats(roundResults);
  const statsMap = new Map<string, ComputedPlayerStats>();

  for (const p of players) {
    const puuid = p.subject;
    const s = p.stats ?? {};
    const kills = s.kills ?? 0;
    const deaths = s.deaths ?? 0;
    const score = s.score ?? 0;
    const roundsPlayed = s.roundsPlayed ?? roundCount;
    const acs = roundsPlayed > 0 ? Math.round(score / roundsPlayed) : 0;
    const kd = deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills;
    const dmg = computePlayerDamageStats(roundResults, puuid, p.teamId, playerTeams, roundCount);
    const kast = computePlayerKast(
      roundResults,
      details.kills,
      puuid,
      p.teamId,
      playerTeams,
      roundCount,
    );
    const clutches = computePlayerClutches(
      roundResults,
      details.kills,
      puuid,
      p.teamId,
      players,
      roundCount,
    );
    const casts = s.abilityCasts ?? {};
    statsMap.set(puuid, {
      puuid,
      acs,
      kd,
      plusMinus: kills - deaths,
      adr: dmg.adr,
      damageDelta: dmg.damageDelta,
      hsPct: dmg.hsPct,
      kast,
      firstKills: fk.get(puuid) ?? 0,
      firstDeaths: fd.get(puuid) ?? 0,
      flawlessRounds: p.teamId ? (flawless.get(p.teamId) ?? 0) : 0,
      multiKills: mkMap.get(puuid) ?? { k2: 0, k3: 0, k4: 0, k5: 0 },
      clutches,
      plants: plants.get(puuid) ?? 0,
      defuses: defuses.get(puuid) ?? 0,
      abilityCasts: {
        c: casts.grenadeCasts ?? 0,
        q: casts.ability1Casts ?? 0,
        e: casts.ability2Casts ?? 0,
        x: casts.ultimateCasts ?? 0,
      },
      avgLoadout: roundCount > 0 ? computeAvgLoadout(roundResults, puuid) : null,
      weapons: computePlayerWeapons(roundResults, details.kills, puuid, p.teamId),
    });
  }

  const rounds: ComputedRoundStats[] = roundResults.map((r, i) => ({
    n: (typeof r.roundNum === "number" ? r.roundNum : i) + 1,
    winningTeam: r.winningTeam ?? null,
    result: r.roundResult ?? null,
    resultCode: r.roundResultCode ?? null,
    ceremony: r.roundCeremony ?? null,
  }));

  return { players: statsMap, rounds };
}

// Sides swap at the half (4 rounds in Swiftplay, 12 elsewhere) and alternate every round after it.
export function attackingTeam(round: number, queueId: string): "Red" | "Blue" {
  const half = queueId === "swiftplay" ? 4 : 12;
  if (round < half) return "Red";
  if (round < half * 2) return "Blue";
  return round % 2 === 0 ? "Red" : "Blue";
}
