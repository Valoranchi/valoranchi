import type { Catalogue } from "../catalogue/Catalogue.js";
import type {
  AccountXp,
  AccountXpHistoryEntry,
  AgentMastery,
  ContractProgress,
  ContractReward,
  DailyCheckpoints,
  DailyQueueRule,
  Favourite,
  Image,
  MatchAgentMastery,
  MatchContractProgress,
  MatchDailyProgress,
  MatchProgress,
  Mission,
  Penalty,
} from "../model/index.js";
import {
  ENTITLEMENT_ITEM_TYPES,
  type RiotAccountXpResponse,
  type RiotAgentMasteryMatchResponse,
  type RiotAgentMasteryResponse,
  type RiotContractsMatchResponse,
  type RiotContractsResponse,
  type RiotDailyTicketQueueConfigResponse,
  type RiotDailyTicketQueueRule,
  type RiotDailyTicketResponse,
  type RiotFavoritesResponse,
  type RiotPenaltiesResponse,
} from "../riot/types.js";

const DAILY_CHECKPOINT_TARGET = 4;

function describeAgent(
  catalogue: Catalogue,
  agentId: string,
): { agentId: string; agentName: string; agentIcon: Image } {
  const agent = catalogue.getAgent(agentId);
  return { agentId, agentName: agent?.displayName ?? "", agentIcon: agent?.displayIcon ?? null };
}

function entitlementTypeName(itemTypeId: string): string {
  const id = itemTypeId.toLowerCase();
  const known = Object.entries(ENTITLEMENT_ITEM_TYPES).find(([, typeId]) => typeId === id);
  return known ? known[0] : itemTypeId;
}

function toQueueRule(rule: RiotDailyTicketQueueRule): DailyQueueRule {
  return { perRoundWon: rule.progressPerRoundWin, perMatch: rule.flatProgressPerMatch };
}

function resolveRewardDetails(
  catalogue: Catalogue,
  type: string,
  uuid: string,
): { name: string; icon: Image } {
  const t = type.toLowerCase();
  if (t === "spray") {
    const s = catalogue.getSpray(uuid);
    return { name: s?.displayName ?? "", icon: s?.displayIcon ?? null };
  }
  if (t === "playercard") {
    const c = catalogue.getCard(uuid);
    return { name: c?.displayName ?? "", icon: c?.smallArt ?? null };
  }
  if (t === "playertitle") {
    const title = catalogue.getTitle(uuid);
    return { name: title?.displayName ?? "", icon: null };
  }
  if (t === "buddy") {
    const b = catalogue.getBuddy(uuid);
    return { name: b?.displayName ?? "", icon: b?.displayIcon ?? null };
  }
  if (t === "currency") {
    const cur = catalogue.getCurrency(uuid);
    return { name: cur?.displayName ?? "", icon: null };
  }
  const skin = catalogue.getSkin(uuid);
  return { name: skin?.displayName ?? "", icon: skin?.displayIcon ?? null };
}

export class AccountProgressionBuilder {
  static buildAccountXp(raw: RiotAccountXpResponse): AccountXp {
    const history: AccountXpHistoryEntry[] = (raw.History ?? []).map((h) => {
      const sources = { timePlayed: 0, matchWin: 0, firstWinOfTheDay: 0 };
      for (const s of h.XPSources ?? []) {
        if (s.ID === "time-played") sources.timePlayed += s.Amount;
        else if (s.ID === "match-win") sources.matchWin += s.Amount;
        else if (s.ID === "first-win-of-the-day") sources.firstWinOfTheDay += s.Amount;
      }
      return {
        matchId: h.ID,
        at: h.MatchStart,
        before: { level: h.StartProgress.Level, xp: h.StartProgress.XP },
        after: { level: h.EndProgress.Level, xp: h.EndProgress.XP },
        delta: h.XPDelta,
        sources,
      };
    });
    return {
      level: raw.Progress.Level,
      xp: raw.Progress.XP,
      history,
      nextFirstWinAt: raw.NextTimeFirstWinAvailable ?? null,
    };
  }

  static buildContracts(raw: RiotContractsResponse, catalogue: Catalogue): ContractProgress[] {
    const list: ContractProgress[] = [];
    for (const c of raw.Contracts ?? []) {
      const def = catalogue.getContract(c.ContractDefinitionID);
      if (!def) continue;
      const kindRaw = def.content?.relationType?.toLowerCase();
      const kind = kindRaw === "agent" || kindRaw === "season" ? kindRaw : "event";
      const { rewards, nextLevelAt } = this.extractRewards(
        def,
        c.ProgressionLevelReached,
        catalogue,
      );
      list.push({
        uuid: def.uuid,
        name: def.displayName,
        kind,
        level: c.ProgressionLevelReached,
        progress: c.ProgressionTowardsNextLevel,
        nextLevelAt,
        active: raw.ActiveSpecialContract === def.uuid,
        rewards,
      });
    }
    return list;
  }

  private static extractRewards(
    def: ReturnType<Catalogue["getContract"]>,
    reachedLevel: number,
    catalogue: Catalogue,
  ): { rewards: ContractReward[]; nextLevelAt: number | null } {
    let index = 1;
    let nextLevelAt: number | null = null;
    const rewards: ContractReward[] = [];
    for (const ch of def?.content?.chapters ?? []) {
      for (const lvl of ch.levels) {
        if (index === reachedLevel + 1) nextLevelAt = lvl.xp;
        const resolved = resolveRewardDetails(catalogue, lvl.reward.type, lvl.reward.uuid);
        rewards.push({
          level: index,
          type: lvl.reward.type,
          uuid: lvl.reward.uuid,
          name: resolved.name,
          icon: resolved.icon,
          unlocked: index <= reachedLevel,
        });
        index++;
      }
    }
    return { rewards, nextLevelAt };
  }

  static buildMissions(raw: RiotContractsResponse, catalogue: Catalogue): Mission[] {
    return (raw.Missions ?? []).map((m) => {
      const def = catalogue.getMission(m.ID);
      const target = def?.progressToComplete ?? 1;
      const progress = Object.values(m.Objectives ?? {}).reduce((acc, v) => acc + v, 0);
      return {
        uuid: m.ID,
        title: def?.title ?? def?.displayName ?? m.ID,
        progress: m.Complete ? target : progress,
        target,
        complete: m.Complete,
        expiresAt: m.ExpirationTime || null,
      };
    });
  }

  static buildPenalties(raw: RiotPenaltiesResponse): Penalty[] {
    return (raw.Penalties ?? []).map((p) => ({
      id: p.ID,
      reason: p.Reason,
      expiresAt: p.Expiry,
    }));
  }

  static buildFavourites(raw: RiotFavoritesResponse, catalogue: Catalogue): Favourite[] {
    return Object.values(raw.FavoritedContent ?? {}).map((item) => {
      const skin = catalogue.getSkin(item.ItemID);
      const weapon = catalogue.weapons.find((w) =>
        w.skins.some((s) => s.uuid.toLowerCase() === item.ItemID.toLowerCase()),
      );
      return {
        skinUuid: item.ItemID,
        name: skin?.displayName ?? item.ItemID,
        weapon: weapon?.displayName ?? "",
      };
    });
  }

  static buildAgentMastery(raw: RiotAgentMasteryResponse, catalogue: Catalogue): AgentMastery[] {
    return (raw.Bonsais ?? [])
      .map((bonsai) => ({
        ...describeAgent(catalogue, bonsai.BonsaiID),
        longLevel: bonsai.Flourish.LongLevel ?? 0,
        shortLevel: bonsai.Flourish.ShortLevel ?? 0,
        points: bonsai.Flourish.Points ?? 0,
        tracks: (bonsai.TrackProgressList ?? []).map((track) => ({
          trackId: track.TrackID,
          level: track.TrackLevel ?? 0,
        })),
      }))
      .sort((a, b) => b.points - a.points);
  }

  static buildMatchProgress(
    matchId: string,
    raw: {
      mastery: RiotAgentMasteryMatchResponse | null;
      contracts: RiotContractsMatchResponse | null;
      dailyTicket: RiotDailyTicketResponse;
    },
    catalogue: Catalogue,
  ): MatchProgress {
    return {
      matchId,
      agentMastery: raw.mastery && this.buildMatchAgentMastery(raw.mastery, catalogue),
      contracts: raw.contracts && this.buildMatchContracts(raw.contracts, catalogue),
      daily: this.buildMatchDaily(raw.dailyTicket, matchId),
    };
  }

  private static buildMatchAgentMastery(
    raw: RiotAgentMasteryMatchResponse,
    catalogue: Catalogue,
  ): MatchAgentMastery {
    const { Delta: delta } = raw;
    const earnings = delta.EarningsBreakdown;
    return {
      ...describeAgent(catalogue, raw.PlayedCharacter),
      pointsBefore: delta.PointsBefore ?? null,
      pointsAfter: delta.PointsAfter,
      earned: earnings.TotalMPGranted,
      breakdown: {
        secondsPlayed: earnings.SecondsPlayed,
        timePlayed: earnings.TimePlayedMP,
        winBonus: earnings.WinBonusMP ?? 0,
        performanceBonus: earnings.PerformanceBonusMP ?? 0,
      },
      longLevelBefore: delta.LongLevelBefore ?? null,
      longLevelAfter: delta.LongLevelAfter,
      shortLevelBefore: delta.ShortLevelBefore ?? null,
      shortLevelAfter: delta.ShortLevelAfter,
    };
  }

  private static buildMatchContracts(
    raw: RiotContractsMatchResponse,
    catalogue: Catalogue,
  ): MatchContractProgress {
    const { XPGrants: xp, DoughGrants: dough } = raw;
    return {
      xp: {
        roundsPlayed: xp.RoundPlayed,
        roundsWon: xp.RoundWon,
        gamePlayed: xp.GamePlayed,
        gameWon: xp.GameWon,
        total: xp.GamePlayed + xp.GameWon + xp.RoundPlayed + xp.RoundWon,
      },
      kingdomCredits: {
        roundsPlayed: dough.RoundPlayed,
        roundsWon: dough.RoundWon,
        gamePlayed: dough.GamePlayed,
        total: dough.GamePlayed + dough.RoundPlayed + dough.RoundWon,
      },
      contractXp: Object.values(raw.ContractDeltas ?? {}).map((delta) => ({
        contractId: delta.ID,
        name: catalogue.getContract(delta.ID)?.displayName ?? "",
        before: delta.TotalXPBefore,
        after: delta.TotalXPAfter,
      })),
      rewards: Object.entries(raw.RewardGrants ?? {}).flatMap(([contractId, grant]) =>
        (grant.EntitlementRewards ?? []).map((reward) => {
          const type = entitlementTypeName(reward.ItemTypeID);
          return {
            contractId,
            type,
            uuid: reward.ItemID,
            ...resolveRewardDetails(catalogue, type, reward.ItemID),
            amount: reward.Amount,
          };
        }),
      ),
    };
  }

  private static buildMatchDaily(
    ticket: RiotDailyTicketResponse,
    matchId: string,
  ): MatchDailyProgress | null {
    const processed = (ticket.ProcessedMatches ?? []).find(
      (match) => match.ID.toLowerCase() === matchId.toLowerCase(),
    );
    return processed
      ? {
          progressBefore: processed.ProgressBefore,
          progressAfter: processed.ProgressAfter,
          xp: processed.XP,
          kingdomCredits: processed.SoftCurrency,
        }
      : null;
  }

  static buildDailyCheckpoints(
    ticket: RiotDailyTicketResponse,
    queueConfig: RiotDailyTicketQueueConfigResponse,
    now: Date = new Date(),
  ): DailyCheckpoints {
    const { RemainingLifetimeSeconds, Milestones } = ticket.DailyRewards;
    return {
      checkpoints: Milestones.map((milestone) => ({
        progress: milestone.Progress,
        target: DAILY_CHECKPOINT_TARGET,
        complete: milestone.Progress >= DAILY_CHECKPOINT_TARGET,
      })),
      expiresAt: new Date(now.getTime() + RemainingLifetimeSeconds * 1000).toISOString(),
      queues: Object.fromEntries(
        Object.entries(queueConfig.queueOverrides ?? {}).map(([queue, rule]) => [
          queue,
          toQueueRule(rule),
        ]),
      ),
      default: toQueueRule(queueConfig.default),
    };
  }
}
