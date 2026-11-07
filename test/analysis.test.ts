import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ratingTrend } from "../src/analysis/ratingTrend.js";
import { performanceSummary } from "../src/analysis/performanceSummary.js";
import { playerAssessment } from "../src/analysis/playerAssessment.js";
import { diffLoadout, exportLoadout } from "../src/analysis/loadoutDiff.js";
import { collectionValue } from "../src/analysis/collectionValue.js";
import {
  loadStoreHistory,
  querySkinSeen,
  recordStoreRotation,
  saveStoreHistory,
} from "../src/analysis/storeHistory.js";
import { loadKnownMatches, saveKnownMatches, syncMatches } from "../src/analysis/matchSync.js";
import { MatchBuilder } from "../src/collection/MatchBuilder.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { RankResolver } from "../src/collection/RankResolver.js";
import type {
  Loadout,
  MatchSummary,
  Mmr,
  Offer,
  OwnedItems,
  Store,
  StoreHistory,
} from "../src/model/index.js";
import type { LoadoutChange } from "../src/client/LoadoutValidator.js";
import type { RiotCompetitiveUpdate, RiotMatchDetailsResponse } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;
const catalogue = new Catalogue(catalogueData);
const resolver = new RankResolver(catalogue);

const twentyUpdates = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures", "analysis", "twentyUpdates.json"),
    "utf-8",
  ),
) as RiotCompetitiveUpdate[];

const fixtureOffers = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "analysis", "offers.json"), "utf-8"),
) as Offer[];

describe("ratingTrend", () => {
  it("computes all trend fields from twenty competitive updates", () => {
    const currentRank = resolver.fromTier(15, 72);
    const trend = ratingTrend(twentyUpdates, currentRank);

    expect(trend.streak).toEqual({
      kind: "win",
      length: 5,
    });

    expect(trend.net).toEqual({
      last5: 105,
      last10: 101,
      last20: 120,
    });

    expect(trend.winRate).toBe(0.6);
    expect(trend.perGame.averageGain).toBe(21.1);
    expect(trend.perGame.averageLoss).toBe(16.6);

    expect(trend.toNextRank).toEqual({
      rating: 28,
      winsAtCurrentPace: 2,
    });

    expect(trend.toDemotion).toEqual({
      rating: 72,
      lossesAtCurrentPace: 6,
    });

    expect(trend.pace).toBe("climbing");
  });

  it("handles empty updates gracefully", () => {
    const trend = ratingTrend([]);
    expect(trend.streak).toEqual({ kind: null, length: 0 });
    expect(trend.net).toEqual({ last5: 0, last10: 0, last20: 0 });
    expect(trend.winRate).toBe(0);
    expect(trend.perGame).toEqual({ averageGain: null, averageLoss: null });
    expect(trend.toNextRank).toEqual({ rating: 100, winsAtCurrentPace: null });
    expect(trend.toDemotion).toEqual({ rating: 0, lossesAtCurrentPace: null });
    expect(trend.pace).toBe("holding");
  });

  it("identifies falling pace when net last 10 is negative", () => {
    const lossUpdates: RiotCompetitiveUpdate[] = Array.from({ length: 10 }, (_, i) => ({
      MatchID: `m-${i}`,
      MapID: "",
      SeasonID: "",
      MatchStartTime: 1000 - i,
      TierAfterUpdate: 15,
      TierBeforeUpdate: 15,
      RankedRatingAfterUpdate: 20,
      RankedRatingBeforeUpdate: 38,
      RankedRatingEarned: -18,
      RankedRatingPerformanceBonus: 0,
      CompetitiveMovement: "MOVEMENT_DOWN",
      AFKPenalty: 0,
    }));
    const trend = ratingTrend(lossUpdates, resolver.fromTier(15, 20));
    expect(trend.streak).toEqual({ kind: "loss", length: 10 });
    expect(trend.pace).toBe("falling");
    expect(trend.toDemotion.lossesAtCurrentPace).toBe(3);
  });

  it.each([
    [0, 1],
    [1, 2],
    [20, 2],
    [21, 3],
  ])("counts the loss taken at 0 RR on top of those reaching it from %i RR", (rating, losses) => {
    const update: RiotCompetitiveUpdate = {
      MatchID: "m",
      MapID: "",
      SeasonID: "",
      MatchStartTime: 1000,
      TierAfterUpdate: 15,
      TierBeforeUpdate: 15,
      RankedRatingAfterUpdate: rating,
      RankedRatingBeforeUpdate: rating + 20,
      RankedRatingEarned: -20,
      RankedRatingPerformanceBonus: 0,
      CompetitiveMovement: "MOVEMENT_DOWN",
      AFKPenalty: 0,
    };
    const trend = ratingTrend([update], resolver.fromTier(15, rating));
    expect(trend.toDemotion.lossesAtCurrentPace).toBe(losses);
  });
});

const rawThreeMatches = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures", "analysis", "threeMatchDetails.json"),
    "utf-8",
  ),
) as RiotMatchDetailsResponse[];

describe("performanceSummary", () => {
  const matches = rawThreeMatches.map((m) => new MatchBuilder(m, catalogue, "self-puuid").build());

  it("computes overall performance statistics and consistency", () => {
    const summary = performanceSummary(matches, "self-puuid", catalogue);

    expect(summary.overall).toEqual({
      games: 3,
      wins: 2,
      winRate: 0.67,
      kd: 1.05,
      kda: 1.49,
      headshotRate: 0.35,
      averageScore: 3000,
      averageDamagePerRound: 123.3,
      firstBloodsPerGame: 0.3,
      plantsPerGame: 0.7,
      defusesPerGame: 0.3,
    });

    expect(summary.consistency).toEqual({
      scoreStdDev: 816.5,
      gamesNonNegative: 2,
      longestNonNegativeStreak: 2,
    });
  });

  it("computes breakdown by agent and by map", () => {
    const summary = performanceSummary(matches, "self-puuid", catalogue);

    expect(summary.byAgent).toHaveLength(2);
    const jett = summary.byAgent.find((a) => a.name === "Jett");
    expect(jett).toBeDefined();
    expect(jett?.games).toBe(2);
    expect(jett?.wins).toBe(2);
    expect(jett?.winRate).toBe(1);
    expect(jett?.kd).toBe(1.4);

    expect(summary.byMap).toHaveLength(2);
    const ascent = summary.byMap.find((m) => m.name === "Ascent");
    expect(ascent).toBeDefined();
    expect(ascent?.games).toBe(2);
    expect(ascent?.wins).toBe(2);
    expect(ascent?.winRate).toBe(1);
  });

  it("returns null best and worst when fewer than 3 games per agent or map", () => {
    const summary = performanceSummary(matches, "self-puuid", catalogue);
    expect(summary.best.agent).toBeNull();
    expect(summary.worst.agent).toBeNull();
    expect(summary.best.map).toBeNull();
    expect(summary.worst.map).toBeNull();
  });

  it("selects best and worst agent and map with the minimum-3-games rule", () => {
    const match4 = new MatchBuilder(
      {
        ...rawThreeMatches[0]!,
        matchInfo: { ...rawThreeMatches[0]!.matchInfo, matchId: "match-3" },
      },
      catalogue,
      "self-puuid",
    ).build();

    const match5 = new MatchBuilder(
      {
        ...rawThreeMatches[2]!,
        matchInfo: { ...rawThreeMatches[2]!.matchInfo, matchId: "match-4" },
      },
      catalogue,
      "self-puuid",
    ).build();

    const match6 = new MatchBuilder(
      {
        ...rawThreeMatches[2]!,
        matchInfo: { ...rawThreeMatches[2]!.matchInfo, matchId: "match-5" },
      },
      catalogue,
      "self-puuid",
    ).build();

    const expandedMatches = [...matches, match4, match5, match6];
    const summary = performanceSummary(expandedMatches, "self-puuid", catalogue);

    expect(summary.best.agent?.name).toBe("Jett");
    expect(summary.worst.agent?.name).toBe("Phoenix");
    expect(summary.best.map?.name).toBe("Ascent");
    expect(summary.worst.map?.name).toBe("Bind");
  });
});

function createMockMmr(overrides?: Partial<Mmr>): Mmr {
  return {
    current: null,
    fit: {
      verdict: null,
      ranksAbove: 0,
      expected: null,
      averageGain: null,
      averageLoss: null,
      sample: 0,
    },
    peak: null,
    act: null,
    lastUpdate: null,
    leaderboardAnonymized: false,
    ...overrides,
  };
}

describe("playerAssessment", () => {
  it("flags low-level-high-rank when account level is under 50 and tier is Platinum or higher", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(15, 50),
      fit: {
        verdict: "fit",
        ranksAbove: 0,
        expected: null,
        averageGain: 20,
        averageLoss: 15,
        sample: 5,
      },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 30,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("low-level-high-rank");
    expect(assessment.flags.find((f) => f.flag === "low-level-high-rank")?.reason).toContain(
      "Account level 30 under 50 with Platinum or higher rank",
    );
  });

  it("flags inflated when rank fit verdict is above", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: {
        verdict: "above",
        ranksAbove: -1,
        expected: null,
        averageGain: 10,
        averageLoss: 20,
        sample: 5,
      },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("inflated");
  });

  it("flags underranked when rank fit is below with two ranks", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: {
        verdict: "below",
        ranksAbove: 2,
        expected: null,
        averageGain: 35,
        averageLoss: 10,
        sample: 5,
      },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 8, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("underranked");
  });

  it("flags long-streak when streak is 5 or more", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: {
        verdict: "fit",
        ranksAbove: 0,
        expected: null,
        averageGain: 20,
        averageLoss: 15,
        sample: 5,
      },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: twentyUpdates,
    });

    expect(assessment.warnings).toContain("long-streak");
    expect(assessment.flags.find((f) => f.flag === "long-streak")?.reason).toBe(
      "5-game win streak",
    );
  });

  it("flags new-act when fewer than 5 games this act", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: {
        verdict: "fit",
        ranksAbove: 0,
        expected: null,
        averageGain: 20,
        averageLoss: 15,
        sample: 3,
      },
      act: { uuid: "act-1", name: "Act 1", games: 3, wins: 2, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("new-act");
    expect(assessment.flags.find((f) => f.flag === "new-act")?.reason).toContain(
      "Fewer than 5 competitive games played this act (3)",
    );
  });

  it("returns no flags for normal accounts", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: {
        verdict: "fit",
        ranksAbove: 0,
        expected: null,
        averageGain: 20,
        averageLoss: 15,
        sample: 5,
      },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 80,
      mmr,
      updates: [],
    });

    expect(assessment.flags).toHaveLength(0);
    expect(assessment.warnings).toHaveLength(0);
  });
});

function createTestLoadout(): Loadout {
  const vandal = catalogue.weapons.find((w) => w.displayName === "Vandal")!;
  const primeSkin = vandal.skins.find((s) => s.displayName === "Prime Vandal")!;

  return {
    player: {
      puuid: "p1",
      gameName: "Player",
      tagLine: "1234",
      region: "na",
      shard: "na",
      accountLevel: 50,
    },
    guns: [
      {
        weapon: { uuid: vandal.uuid, name: vandal.displayName },
        skin: {
          uuid: primeSkin.uuid,
          name: primeSkin.displayName,
          icon: primeSkin.displayIcon ?? null,
        },
        level: { uuid: primeSkin.levels[0]!.uuid, name: primeSkin.levels[0]!.displayName },
        chroma: { uuid: primeSkin.chromas[0]!.uuid, name: primeSkin.chromas[0]!.displayName },
        buddy: null,
      },
    ],
    sprays: [
      {
        slot: "0",
        uuid: catalogueData.sprays[0]!.uuid,
        name: catalogueData.sprays[0]!.displayName,
        icon: catalogueData.sprays[0]!.displayIcon ?? null,
      },
    ],
    flex: null,
    card: {
      uuid: catalogueData.playerCards[0]!.uuid,
      name: catalogueData.playerCards[0]!.displayName,
      small: catalogueData.playerCards[0]!.smallArt,
      wide: catalogueData.playerCards[0]!.wideArt,
      large: catalogueData.playerCards[0]!.largeArt,
    },
    title: {
      uuid: catalogueData.playerTitles[0]!.uuid,
      name: catalogueData.playerTitles[0]!.displayName,
      text: catalogueData.playerTitles[0]!.titleText,
    },
    incognito: false,
  };
}

describe("loadoutDiff and exportLoadout", () => {
  it("diffLoadout with identical loadouts produces 0 changes", () => {
    const current = createTestLoadout();
    const diff = diffLoadout(current, current, catalogue);
    expect(diff.totalChanges).toBe(0);
    expect(diff.guns).toHaveLength(0);
    expect(diff.sprays).toHaveLength(0);
    expect(diff.identity).toHaveLength(0);
  });

  it("diffLoadout detects different guns", () => {
    const current = createTestLoadout();
    const vandal = catalogue.weapons.find((w) => w.displayName === "Vandal")!;
    const reaverSkin = vandal.skins.find((s) => s.displayName === "Reaver Vandal")!;
    const target: LoadoutChange = {
      guns: [{ weapon: "Vandal", skin: reaverSkin.uuid }],
    };
    const diff = diffLoadout(current, target, catalogue);
    expect(diff.totalChanges).toBe(1);
    expect(diff.guns).toHaveLength(1);
    expect(diff.guns[0]?.slot).toBe("Vandal");
    expect(diff.guns[0]?.from.name).toBe("Prime Vandal");
    expect(diff.guns[0]?.to.name).toBe("Reaver Vandal");
  });

  it("diffLoadout detects different sprays", () => {
    const current = createTestLoadout();
    const target: LoadoutChange = {
      sprays: ["other-spray-uuid"],
    };
    const diff = diffLoadout(current, target, catalogue);
    expect(diff.totalChanges).toBe(1);
    expect(diff.sprays).toHaveLength(1);
    expect(diff.sprays[0]?.slot).toBe("Spray (Round Start)");
  });

  it("diffLoadout detects different identity", () => {
    const current = createTestLoadout();
    const target: LoadoutChange = {
      card: "diff-card-uuid",
      incognito: true,
    };
    const diff = diffLoadout(current, target, catalogue);
    expect(diff.totalChanges).toBe(2);
    expect(diff.identity).toHaveLength(2);
    expect(diff.identity.find((i) => i.slot === "Card")).toBeDefined();
    expect(diff.identity.find((i) => i.slot === "Incognito")).toBeDefined();
  });

  it("exportLoadout produces valid LoadoutChange matching schema", () => {
    const current = createTestLoadout();
    const exported = exportLoadout(current);
    expect(exported.guns).toHaveLength(1);
    expect(exported.guns?.[0]?.weapon).toBe(current.guns[0]?.weapon.uuid);
    expect(exported.sprays).toHaveLength(1);
    expect(exported.card).toBe(current.card?.uuid);
    expect(exported.title).toBe(current.title?.uuid);
    expect(exported.incognito).toBe(false);
  });

  it("round-trip exportLoadout -> diffLoadout produces 0 changes", () => {
    const current = createTestLoadout();
    const exported = exportLoadout(current);
    const diff = diffLoadout(current, exported, catalogue);
    expect(diff.totalChanges).toBe(0);
    expect(diff.guns).toHaveLength(0);
    expect(diff.sprays).toHaveLength(0);
    expect(diff.identity).toHaveLength(0);
  });
});

describe("collectionValue", () => {
  it("calculates collection value with known prices, upgrade costs, and groupings", () => {
    const vandal = catalogue.weapons.find((w) => w.displayName === "Vandal")!;
    const standardSkin = vandal.skins.find((s) => s.displayName === "Standard Vandal")!;
    const primeSkin = vandal.skins.find((s) => s.displayName === "Prime Vandal")!;
    const reaverSkin = vandal.skins.find((s) => s.displayName === "Reaver Vandal")!;

    const owned: OwnedItems = {
      language: "en-US",
      generatedAt: "2026-01-01T00:00:00.000Z",
      player: {
        puuid: "p1",
        gameName: "Player",
        tagLine: "1234",
        region: "na",
        shard: "na",
        accountLevel: 50,
      },
      weapons: [
        {
          uuid: vandal.uuid,
          name: vandal.displayName,
          category: vandal.category,
          skinsOwned: 4,
          skinsTotal: 4,
          skins: [
            {
              uuid: standardSkin.uuid,
              name: standardSkin.displayName,
              tier: null,
              icon: null,
              levels: [
                {
                  uuid: standardSkin.levels[0]!.uuid,
                  name: standardSkin.levels[0]!.displayName,
                  owned: true,
                },
              ],
              chromas: [
                {
                  uuid: standardSkin.chromas[0]!.uuid,
                  name: standardSkin.chromas[0]!.displayName,
                  owned: true,
                  swatch: null,
                },
              ],
            },
            {
              uuid: primeSkin.uuid,
              name: primeSkin.displayName,
              tier: {
                uuid: "e046854e-406c-37f4-6607-19a9ba8426fc",
                name: "Premium",
                rank: 3,
                icon: null,
              },
              icon: null,
              levels: [
                {
                  uuid: primeSkin.levels[0]!.uuid,
                  name: primeSkin.levels[0]!.displayName,
                  owned: true,
                },
                {
                  uuid: primeSkin.levels[1]!.uuid,
                  name: primeSkin.levels[1]!.displayName,
                  owned: true,
                },
              ],
              chromas: [
                {
                  uuid: primeSkin.chromas[0]!.uuid,
                  name: primeSkin.chromas[0]!.displayName,
                  owned: true,
                  swatch: null,
                },
                {
                  uuid: primeSkin.chromas[1]!.uuid,
                  name: primeSkin.chromas[1]!.displayName,
                  owned: true,
                  swatch: null,
                },
              ],
            },
            {
              uuid: reaverSkin.uuid,
              name: reaverSkin.displayName,
              tier: {
                uuid: "e046854e-406c-37f4-6607-19a9ba8426fc",
                name: "Premium",
                rank: 3,
                icon: null,
              },
              icon: null,
              levels: [
                {
                  uuid: reaverSkin.levels[0]!.uuid,
                  name: reaverSkin.levels[0]!.displayName,
                  owned: true,
                },
              ],
              chromas: [
                {
                  uuid: reaverSkin.chromas[0]!.uuid,
                  name: reaverSkin.chromas[0]!.displayName,
                  owned: true,
                  swatch: null,
                },
              ],
            },
            {
              uuid: "unknown-skin-uuid",
              name: "Mystery Vandal",
              tier: { uuid: "exclusive-tier-uuid", name: "Exclusive", rank: 4, icon: null },
              icon: null,
              levels: [
                { uuid: "mystery-l1", name: "Mystery Level 1", owned: true },
                { uuid: "mystery-l2", name: "Mystery Level 2", owned: true },
              ],
              chromas: [
                { uuid: "mystery-c1", name: "Mystery Chroma 1", owned: true, swatch: null },
              ],
            },
          ],
        },
      ],
      buddies: [],
      sprays: [],
      cards: [],
      titles: [],
      agents: [],
    };

    const val = collectionValue(owned, fixtureOffers, catalogue);

    expect(val.total.vp).toBe(3550);
    expect(val.total.radianite).toBe(35);
    expect(val.total.priced).toBe(3);
    expect(val.total.totalItems).toBe(4);

    expect(val.byWeapon).toHaveLength(1);
    expect(val.byWeapon[0]?.name).toBe("Vandal");
    expect(val.byWeapon[0]?.vp).toBe(3550);
    expect(val.byWeapon[0]?.radianite).toBe(35);
    expect(val.byWeapon[0]?.items).toBe(4);
    expect(val.byWeapon[0]?.priced).toBe(3);

    expect(val.byTier).toHaveLength(3);
    const standardTier = val.byTier.find((t) => t.name === "Standard");
    expect(standardTier?.vp).toBe(0);
    expect(standardTier?.items).toBe(1);

    const premiumTier = val.byTier.find((t) => t.name === "Premium");
    expect(premiumTier?.vp).toBe(3550);
    expect(premiumTier?.items).toBe(2);
    expect(premiumTier?.radianite).toBe(25);

    const exclusiveTier = val.byTier.find((t) => t.name === "Exclusive");
    expect(exclusiveTier?.vp).toBe(0);
    expect(exclusiveTier?.priced).toBe(0);
    expect(exclusiveTier?.items).toBe(1);
    expect(exclusiveTier?.radianite).toBe(10);
  });
});

function createMockStore(skinUuids: string[]): Store {
  return {
    player: {
      puuid: "p1",
      gameName: "Player",
      tagLine: "1234",
      region: "na",
      shard: "na",
      accountLevel: 50,
    },
    fetchedAt: "2026-01-01T00:00:00.000Z",
    daily: {
      endsAt: "2026-01-02T00:00:00.000Z",
      offers: skinUuids.map((uuid, i) => ({
        offerId: `offer-${i}`,
        item: {
          kind: "skin",
          uuid,
          name: `Skin ${i}`,
          weapon: "Vandal",
          tier: null,
          icon: null,
          levelUuid: `level-${uuid}`,
        },
        cost: { currency: "Valorant Points", currencyUuid: "vp-uuid", amount: 1775 },
      })),
    },
    nightMarket: null,
    bundles: null,
    accessories: null,
    radianite: [],
  };
}

describe("storeHistory", () => {
  it("recordStoreRotation appends new days and deduplicates same day", () => {
    const history: StoreHistory = { days: [] };
    const store = createMockStore(["skin-a", "skin-b"]);
    const day1 = recordStoreRotation(history, store, new Date("2026-01-01T12:00:00Z"));

    expect(day1.days).toHaveLength(1);
    expect(day1.days[0]?.day).toBe("2026-01-01");
    expect(day1.days[0]?.daily).toEqual(["skin-a", "skin-b"]);

    const day1Updated = recordStoreRotation(
      day1,
      createMockStore(["skin-c"]),
      new Date("2026-01-01T18:00:00Z"),
    );
    expect(day1Updated.days).toHaveLength(1);
    expect(day1Updated.days[0]?.daily).toEqual(["skin-c"]);

    const day2 = recordStoreRotation(
      day1Updated,
      createMockStore(["skin-d"]),
      new Date("2026-01-02T12:00:00Z"),
    );
    expect(day2.days).toHaveLength(2);
    expect(day2.days[1]?.day).toBe("2026-01-02");
  });

  it("recordStoreRotation caps history at 400 days", () => {
    const initialDays = Array.from({ length: 410 }, (_, i) => ({
      day: `2025-${String(Math.floor(i / 30) + 1).padStart(2, "0")}-${String((i % 30) + 1).padStart(2, "0")}`,
      daily: ["skin-1"],
      nightMarket: null,
      bundles: null,
    }));
    const history: StoreHistory = { days: initialDays };
    const store = createMockStore(["skin-new"]);
    const updated = recordStoreRotation(history, store, new Date("2026-05-01T00:00:00Z"));

    expect(updated.days).toHaveLength(400);
    expect(updated.days[399]?.day).toBe("2026-05-01");
  });

  it("querySkinSeen finds multiple times, once, and never seen", () => {
    const history: StoreHistory = {
      days: [
        { day: "2026-01-01", daily: ["skin-a", "skin-b"], nightMarket: null, bundles: null },
        { day: "2026-01-02", daily: ["skin-b", "skin-c"], nightMarket: null, bundles: null },
        { day: "2026-01-03", daily: ["skin-a", "skin-d"], nightMarket: null, bundles: null },
      ],
    };

    const multi = querySkinSeen(history, "skin-a");
    expect(multi.times).toBe(2);
    expect(multi.lastSeen).toBe("2026-01-03");

    const once = querySkinSeen(history, "skin-c");
    expect(once.times).toBe(1);
    expect(once.lastSeen).toBe("2026-01-02");

    const never = querySkinSeen(history, "skin-never");
    expect(never.times).toBe(0);
    expect(never.lastSeen).toBeNull();
  });

  it("loadStoreHistory and saveStoreHistory round-trip with temp directory", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-history-test-"));
    try {
      const history: StoreHistory = {
        days: [
          { day: "2026-01-01", daily: ["skin-1", "skin-2"], nightMarket: null, bundles: null },
        ],
      };
      saveStoreHistory(tempDir, "player-1", history);
      const loaded = loadStoreHistory(tempDir, "player-1");
      expect(loaded.days).toHaveLength(1);
      expect(loaded.days[0]?.day).toBe("2026-01-01");
      expect(loaded.days[0]?.daily).toEqual(["skin-1", "skin-2"]);

      const empty = loadStoreHistory(tempDir, "nonexistent-player");
      expect(empty.days).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("matchSync", () => {
  it("syncMatches stops when hitting known ID", async () => {
    const fetcher = async (startIndex: number): Promise<MatchSummary[]> => {
      if (startIndex === 0) {
        return [
          {
            id: "m3",
            startedAt: "2026-01-03T00:00:00Z",
            queue: "competitive",
            map: { uuid: null, name: "Ascent", path: "" },
          },
          {
            id: "m2",
            startedAt: "2026-01-02T00:00:00Z",
            queue: "competitive",
            map: { uuid: null, name: "Ascent", path: "" },
          },
        ];
      }
      return [
        {
          id: "m1",
          startedAt: "2026-01-01T00:00:00Z",
          queue: "competitive",
          map: { uuid: null, name: "Ascent", path: "" },
        },
      ];
    };
    const knownIds = new Set(["m2"]);
    const added = await syncMatches(fetcher, knownIds, { maxPages: 5, pageSize: 2 });
    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBe("m3");
  });

  it("syncMatches stops at maxPages", async () => {
    let pagesFetched = 0;
    const fetcher = async (startIndex: number): Promise<MatchSummary[]> => {
      pagesFetched++;
      return [
        {
          id: `match-${startIndex}`,
          startedAt: "2026-01-01T00:00:00Z",
          queue: "competitive",
          map: { uuid: null, name: "Ascent", path: "" },
        },
        {
          id: `match-${startIndex + 1}`,
          startedAt: "2026-01-01T00:00:00Z",
          queue: "competitive",
          map: { uuid: null, name: "Ascent", path: "" },
        },
      ];
    };
    const knownIds = new Set<string>();
    const added = await syncMatches(fetcher, knownIds, { maxPages: 2, pageSize: 2 });
    expect(pagesFetched).toBe(2);
    expect(added).toHaveLength(4);
  });

  it("saveKnownMatches deduplicates and sorts by startedAt descending", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "match-sync-test-"));
    try {
      const matches: MatchSummary[] = [
        {
          id: "m1",
          startedAt: "2026-01-01T00:00:00Z",
          queue: "competitive",
          map: { uuid: null, name: "Ascent", path: "" },
        },
        {
          id: "m3",
          startedAt: "2026-01-03T00:00:00Z",
          queue: "competitive",
          map: { uuid: null, name: "Ascent", path: "" },
        },
        {
          id: "m1",
          startedAt: "2026-01-01T00:00:00Z",
          queue: "competitive",
          map: { uuid: null, name: "Ascent", path: "" },
        },
        {
          id: "m2",
          startedAt: "2026-01-02T00:00:00Z",
          queue: "competitive",
          map: { uuid: null, name: "Ascent", path: "" },
        },
      ];
      saveKnownMatches(tempDir, "player-1", matches);
      const loaded = loadKnownMatches(tempDir, "player-1");
      expect(loaded).toHaveLength(3);
      expect(loaded[0]?.id).toBe("m3");
      expect(loaded[1]?.id).toBe("m2");
      expect(loaded[2]?.id).toBe("m1");

      const empty = loadKnownMatches(tempDir, "nonexistent");
      expect(empty).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
