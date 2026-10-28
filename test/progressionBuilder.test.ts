import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { AccountProgressionBuilder } from "../src/collection/AccountProgressionBuilder.js";
import type {
  RiotAgentMasteryMatchResponse,
  RiotAgentMasteryResponse,
  RiotContractsMatchResponse,
  RiotDailyTicketQueueConfigResponse,
  RiotDailyTicketResponse,
  RiotGoldStarPlayerResponse,
  RiotGoldStarsResponse,
} from "../src/riot/types.js";

function fixture<T>(name: string): T {
  const file = path.join(import.meta.dirname, "fixtures", "progression", `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

const JETT = "add6443a-41bd-e414-f6ad-e58d267f4e95";
const PHOENIX = "eb93336a-449b-9c1b-0a54-a891f7921d69";
const RAZE = "f94c3b30-42be-e959-889c-5aa313dba261";
const UNKNOWN_AGENT = "7c8a4701-4de6-9355-b254-e09bc2a34b72";
const BATTLEPASS = "d18b7d8f-4971-2f89-5613-248257830e11";
const CARD = "b85c3ef6-4737-9a4f-cc60-5286bbd11731";
const TITLE = "7230ce4b-41fb-ba89-123c-75bfe4e71a1f";
const MATCH_WITH_BONUS = "64750dc4-6543-4cff-80b2-b9596426777a";
const MATCH_WITHOUT_BONUS = "ec8f25d1-075d-45e5-84ae-ef3891b73827";

const baseCatalogue = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

const catalogue = new Catalogue({
  ...baseCatalogue,
  agents: [
    ...baseCatalogue.agents,
    {
      uuid: RAZE,
      displayName: "Raze",
      role: { displayName: "Duelist" },
      displayIcon: "https://media.valorant-api.com/agents/raze.png",
      isPlayableCharacter: true,
    },
  ],
  contracts: [
    ...(baseCatalogue.contracts ?? []),
    { uuid: BATTLEPASS, displayName: "Test Battlepass", displayIcon: null, content: null },
  ],
  playerCards: [
    ...baseCatalogue.playerCards,
    {
      uuid: CARD,
      displayName: "Test Card",
      smallArt: "https://media.valorant-api.com/playercards/test/smallart.png",
      wideArt: null,
      largeArt: null,
    },
  ],
  playerTitles: [
    ...baseCatalogue.playerTitles,
    { uuid: TITLE, displayName: "Test Title", titleText: "Test title text" },
  ],
});

const player = fixture<RiotAgentMasteryResponse>("bloomlinePlayer");
const matchWithBonus = fixture<RiotAgentMasteryMatchResponse>("bloomlineMatch");
const matchWithoutBonus = fixture<RiotAgentMasteryMatchResponse>("bloomlineMatchNoBonus");
const contractsMatch = fixture<RiotContractsMatchResponse>("contractsMatch");
const dailyTicket = fixture<RiotDailyTicketResponse>("dailyTicket");
const queueConfig = fixture<RiotDailyTicketQueueConfigResponse>("dailyTicketQueueConfig");

describe("AccountProgressionBuilder.buildAgentMastery", () => {
  const mastery = AccountProgressionBuilder.buildAgentMastery(player, catalogue);

  it("lists every agent from the highest points to the lowest", () => {
    expect(mastery).toHaveLength(player.Bonsais.length);
    const points = mastery.map((agent) => agent.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it("resolves the played agent and its levels and tracks", () => {
    expect(mastery[0]).toEqual({
      agentId: PHOENIX,
      agentName: "Phoenix",
      agentIcon: "https://media.valorant-api.com/agents/phoenix.png",
      longLevel: 1,
      shortLevel: 1,
      points: 5969,
      tracks: [{ trackId: "2d0a2cda-4c57-a899-88ed-0d9172d61358", level: 1 }],
    });
  });

  it("reads zero levels from an agent that only has points", () => {
    expect(mastery[1]).toMatchObject({
      agentId: RAZE,
      agentName: "Raze",
      longLevel: 0,
      shortLevel: 0,
      points: 174,
      tracks: [{ trackId: "9795d974-4b72-7475-1caa-fdb07dc45858", level: 0 }],
    });
  });

  it("reports agents that were never played at zero", () => {
    const unplayed = mastery.slice(2);
    expect(unplayed).toHaveLength(player.Bonsais.length - 2);
    for (const agent of unplayed) {
      expect(agent).toMatchObject({ longLevel: 0, shortLevel: 0, points: 0 });
      expect(agent.tracks).toHaveLength(1);
      expect(agent.tracks[0]?.level).toBe(0);
    }
  });

  it("keeps an agent the catalogue does not know, with an empty name", () => {
    expect(mastery.find((agent) => agent.agentId === UNKNOWN_AGENT)).toMatchObject({
      agentName: "",
      agentIcon: null,
      points: 0,
    });
  });
});

describe("AccountProgressionBuilder.buildMatchProgress", () => {
  it("builds the mastery of a first match with win and performance bonuses", () => {
    const progress = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITH_BONUS,
      { mastery: matchWithBonus, contracts: null, dailyTicket },
      catalogue,
    );

    expect(progress.matchId).toBe(MATCH_WITH_BONUS);
    expect(progress.agentMastery).toEqual({
      agentId: JETT,
      agentName: "Jett",
      agentIcon: "https://media.valorant-api.com/agents/jett.png",
      pointsBefore: null,
      pointsAfter: 2837,
      earned: 2837,
      breakdown: { secondsPlayed: 1419, timePlayed: 1892, winBonus: 567, performanceBonus: 378 },
      longLevelBefore: null,
      longLevelAfter: 1,
      shortLevelBefore: null,
      shortLevelAfter: 1,
    });
    const { breakdown, earned } = progress.agentMastery!;
    expect(breakdown.timePlayed + breakdown.winBonus + breakdown.performanceBonus).toBe(earned);
  });

  it("builds the mastery of a match without bonuses that has points before", () => {
    const progress = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITHOUT_BONUS,
      { mastery: matchWithoutBonus, contracts: null, dailyTicket },
      catalogue,
    );

    expect(progress.agentMastery).toMatchObject({
      agentId: PHOENIX,
      agentName: "Phoenix",
      pointsBefore: 3952,
      pointsAfter: 5969,
      earned: 2017,
      breakdown: { secondsPlayed: 1513, timePlayed: 2017, winBonus: 0, performanceBonus: 0 },
      longLevelBefore: 1,
      longLevelAfter: 1,
      shortLevelBefore: 1,
      shortLevelAfter: 1,
    });
    const phoenix = AccountProgressionBuilder.buildAgentMastery(player, catalogue).find(
      (agent) => agent.agentId === PHOENIX,
    );
    expect(progress.agentMastery?.pointsAfter).toBe(phoenix?.points);
  });

  it("reads the XP and Kingdom Credits grants and resolves the contract rewards", () => {
    const progress = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITHOUT_BONUS,
      { mastery: null, contracts: contractsMatch, dailyTicket },
      catalogue,
    );

    expect(progress.agentMastery).toBeNull();
    expect(progress.contracts).toEqual({
      xp: { roundsPlayed: 1700, roundsWon: 800, gamePlayed: 0, gameWon: 0, total: 2500 },
      kingdomCredits: { roundsPlayed: 34, roundsWon: 16, gamePlayed: 0, total: 50 },
      contractXp: [
        { contractId: BATTLEPASS, name: "Test Battlepass", before: 10600, after: 15100 },
      ],
      rewards: [
        {
          contractId: BATTLEPASS,
          type: "playerCard",
          uuid: CARD,
          name: "Test Card",
          icon: "https://media.valorant-api.com/playercards/test/smallart.png",
          amount: 1,
        },
        {
          contractId: BATTLEPASS,
          type: "playerTitle",
          uuid: TITLE,
          name: "Test Title",
          icon: null,
          amount: 1,
        },
      ],
    });
  });

  it("adds up to the contract XP once the daily checkpoint XP is counted", () => {
    const { contracts, daily } = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITHOUT_BONUS,
      { mastery: null, contracts: contractsMatch, dailyTicket },
      catalogue,
    );

    const delta = contracts!.contractXp[0]!;
    expect(delta.after - delta.before).toBe(contracts!.xp.total + daily!.xp);
  });

  it("finds the match in the processed matches of the daily ticket", () => {
    const progress = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITHOUT_BONUS.toUpperCase(),
      { mastery: null, contracts: null, dailyTicket },
      catalogue,
    );

    expect(progress.daily).toEqual({
      progressBefore: 0,
      progressAfter: 4,
      xp: 2000,
      kingdomCredits: 300,
    });
  });

  it("leaves the daily part empty when the match is not in the daily ticket", () => {
    const sources = { mastery: null, contracts: null };
    const unknownMatch = "00000000-0000-4000-8000-000000000000";

    const unknown = AccountProgressionBuilder.buildMatchProgress(
      unknownMatch,
      { ...sources, dailyTicket },
      catalogue,
    );
    const withoutHistory = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITH_BONUS,
      { ...sources, dailyTicket: { ...dailyTicket, ProcessedMatches: undefined } },
      catalogue,
    );

    expect(unknown).toEqual({
      matchId: unknownMatch,
      agentMastery: null,
      contracts: null,
      daily: null,
    });
    expect(withoutHistory.daily).toBeNull();
  });

  it("keeps the raw type of a reward the constants do not know", () => {
    const unknownType = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const raw: RiotContractsMatchResponse = {
      ...contractsMatch,
      RewardGrants: {
        [BATTLEPASS]: {
          EntitlementRewards: [{ ItemTypeID: unknownType, ItemID: "item-1", Amount: 3 }],
          ItemRewards: null,
          WalletRewards: null,
          CounterRewards: null,
          ProgressionRewards: null,
        },
      },
    };

    const progress = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITHOUT_BONUS,
      { mastery: null, contracts: raw, dailyTicket },
      catalogue,
    );

    expect(progress.contracts?.rewards).toEqual([
      {
        contractId: BATTLEPASS,
        type: unknownType,
        uuid: "item-1",
        name: "",
        icon: null,
        amount: 3,
      },
    ]);
  });

  it("tolerates a match with no rewards and no contract deltas", () => {
    const raw: RiotContractsMatchResponse = {
      ...contractsMatch,
      RewardGrants: {
        [BATTLEPASS]: {
          EntitlementRewards: null,
          ItemRewards: null,
          WalletRewards: null,
          CounterRewards: null,
          ProgressionRewards: null,
        },
      },
      ContractDeltas: undefined,
    };

    const progress = AccountProgressionBuilder.buildMatchProgress(
      MATCH_WITHOUT_BONUS,
      { mastery: null, contracts: raw, dailyTicket },
      catalogue,
    );

    expect(progress.contracts?.rewards).toEqual([]);
    expect(progress.contracts?.contractXp).toEqual([]);
  });
});

describe("AccountProgressionBuilder.buildDailyCheckpoints", () => {
  const now = new Date("2026-10-24T22:00:00.000Z");

  it("builds the four checkpoints against a target of four", () => {
    const daily = AccountProgressionBuilder.buildDailyCheckpoints(dailyTicket, queueConfig, now);

    expect(daily.checkpoints).toEqual([
      { progress: 4, target: 4, complete: true },
      { progress: 4, target: 4, complete: true },
      { progress: 4, target: 4, complete: true },
      { progress: 0, target: 4, complete: false },
    ]);
  });

  it("marks a checkpoint as complete once it reaches the target", () => {
    const partial: RiotDailyTicketResponse = {
      DailyRewards: {
        RemainingLifetimeSeconds: 0,
        BonusMilestonesPending: 0,
        Milestones: [3, 4].map((Progress) => ({ Progress, BonusApplied: false })),
      },
    };

    const daily = AccountProgressionBuilder.buildDailyCheckpoints(partial, queueConfig, now);

    expect(daily.checkpoints.map((checkpoint) => checkpoint.complete)).toEqual([false, true]);
  });

  it("derives the expiry from the remaining lifetime of the ticket", () => {
    const daily = AccountProgressionBuilder.buildDailyCheckpoints(dailyTicket, queueConfig, now);

    expect(daily.expiresAt).toBe("2026-10-25T10:49:00.000Z");
  });

  it("maps what each queue adds and the default rule", () => {
    const daily = AccountProgressionBuilder.buildDailyCheckpoints(dailyTicket, queueConfig, now);

    expect(Object.keys(daily.queues)).toEqual(Object.keys(queueConfig.queueOverrides));
    expect(daily.queues.competitive).toEqual({ perRoundWon: true, perMatch: 0 });
    expect(daily.queues.spikerush).toEqual({ perRoundWon: false, perMatch: 2 });
    expect(daily.queues.dodgeball).toEqual({ perRoundWon: false, perMatch: 3 });
    expect(daily.default).toEqual({ perRoundWon: false, perMatch: 0 });
  });

  it("returns no queue rules when the config has no overrides", () => {
    const daily = AccountProgressionBuilder.buildDailyCheckpoints(
      dailyTicket,
      { default: queueConfig.default } as RiotDailyTicketQueueConfigResponse,
      now,
    );

    expect(daily.queues).toEqual({});
  });
});

describe("AccountProgressionBuilder.buildGoldStars", () => {
  const definitions = fixture<RiotGoldStarsResponse>("goldStars");
  const player = fixture<RiotGoldStarPlayerResponse>("goldStarPlayer");
  const ADR = "6dc31cfd-41da-895f-9246-a8b63558cdb8";
  const NEVER_EARNED = "4815a8a2-4649-9bfe-afd2-38ae9cc22898";
  const SEASON = "d816f426-48ea-f052-117f-9697a155b319";

  it("lists every gold star for life, the unearned ones at zero", () => {
    const { lifetime } = AccountProgressionBuilder.buildGoldStars(definitions, player);

    expect(lifetime).toHaveLength(definitions.length);
    expect(lifetime.find((star) => star.id === ADR)).toEqual({
      id: ADR,
      threshold: 170,
      count: 1,
      best: 189.5,
    });
    expect(lifetime.find((star) => star.id === NEVER_EARNED)).toEqual({
      id: NEVER_EARNED,
      threshold: 420,
      count: 0,
      best: null,
    });
  });

  it("keeps each season apart from the lifetime totals", () => {
    const { seasons } = AccountProgressionBuilder.buildGoldStars(definitions, player);

    expect(seasons.map((season) => season.seasonId)).toEqual([SEASON]);
    expect(seasons[0].goldStars.find((star) => star.id === ADR)?.count).toBe(1);
  });

  it("reads the recent matches with every player's values", () => {
    const { recentMatches } = AccountProgressionBuilder.buildGoldStars(definitions, player);

    expect(recentMatches).toHaveLength(1);
    expect(recentMatches[0].matchId).toBe("11111111-2222-4333-8444-555555555555");
    expect(recentMatches[0].playedAt).toBe(new Date(1792522659514).toISOString());
    expect(recentMatches[0].players).toHaveLength(3);
    expect(recentMatches[0].players[2]).toEqual({
      puuid: "00000000-0000-4000-8000-000000000003",
      values: [],
    });
  });

  it("answers zeros for a player Riot has nothing on", () => {
    const empty = AccountProgressionBuilder.buildGoldStars(definitions, {
      puuid: "p",
      version: 1,
      tempS: {},
    });

    expect(empty.lifetime.every((star) => star.count === 0 && star.best === null)).toBe(true);
    expect(empty.seasons).toEqual([]);
    expect(empty.recentMatches).toEqual([]);
  });
});
