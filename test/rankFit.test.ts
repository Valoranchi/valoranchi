import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { immortalCutoffs } from "../src/collection/LeaderboardBuilder.js";
import { rankFit } from "../src/collection/RankFit.js";
import { RankResolver } from "../src/collection/RankResolver.js";
import type { RiotCompetitiveUpdate } from "../src/riot/types.js";

const catalogue = new Catalogue(
  JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData,
);
const resolver = new RankResolver(catalogue);
const current = resolver.fromTier(21, 40);

function updates(earned: number[]): RiotCompetitiveUpdate[] {
  return earned.map((value, i) => ({
    MatchID: `m${i}`,
    MapID: "",
    SeasonID: "",
    MatchStartTime: 0,
    TierAfterUpdate: 21,
    TierBeforeUpdate: 21,
    RankedRatingAfterUpdate: 50,
    RankedRatingBeforeUpdate: 50,
    RankedRatingEarned: value,
    RankedRatingPerformanceBonus: 0,
    CompetitiveMovement: "MOVEMENT_UNKNOWN",
    AFKPenalty: 0,
  }));
}

describe("rankFit", () => {
  it("needs three wins before judging", () => {
    const fit = rankFit(current, updates([20, 18]), resolver);
    expect(fit.verdict).toBeNull();
    expect(fit.sample).toBe(2);
  });

  it("calls a rank fit between 13 and 25 rating per win", () => {
    const fit = rankFit(current, updates([20, 18, -15, 22]), resolver);
    expect(fit.verdict).toBe("fit");
    expect(fit.ranksAbove).toBe(0);
    expect(fit.expected?.tier).toBe(21);
    expect(fit.averageGain).toBe(20);
    expect(fit.averageLoss).toBe(15);
  });

  it("calls the account above its rank when it wins little", () => {
    const fit = rankFit(current, updates([8, 10, 12]), resolver);
    expect(fit.verdict).toBe("above");
    expect(fit.ranksAbove).toBe(-1);
    expect(fit.expected?.tier).toBe(18);
  });

  it("expects one rank up between 26 and 30 and two above 30, capped at Radiant", () => {
    expect(rankFit(current, updates([26, 28, 30]), resolver).expected?.tier).toBe(24);
    expect(rankFit(current, updates([31, 35, 40]), resolver).expected?.tier).toBe(27);
    expect(rankFit(resolver.fromTier(26, 0), updates([31, 35, 40]), resolver).expected?.tier).toBe(
      27,
    );
  });

  it("stays silent for unranked accounts", () => {
    expect(rankFit(resolver.fromTier(0), updates([20, 20, 20]), resolver).verdict).toBeNull();
  });

  it("takes any tier resolver, not only the catalogue's", () => {
    const named = {
      fromTier: (tier: number) => ({
        tier,
        name: `T${tier}`,
        division: null,
        icon: null,
        rating: null,
      }),
    };

    expect(rankFit(current, updates([26, 28, 30]), named).expected).toEqual({
      tier: 24,
      name: "T24",
      division: null,
      icon: null,
      rating: null,
    });
  });
});

describe("immortalCutoffs", () => {
  const board = {
    tierDetails: {
      "24": { rankedRatingThreshold: 0 },
      "25": { rankedRatingThreshold: 90 },
      "26": { rankedRatingThreshold: 150 },
      "27": { rankedRatingThreshold: 200 },
    },
    Players: [{ leaderboardRank: 500, rankedRating: 229 }],
  };

  it("reads the region's lines, and prices Radiant at passing the 500th", () => {
    expect(immortalCutoffs(board)).toEqual([
      { tier: 25, rr: 90 },
      { tier: 26, rr: 150 },
      { tier: 27, rr: 230 },
    ]);
    expect(immortalCutoffs({ ...board, Players: [] })?.[2]?.rr).toBe(200);
    expect(immortalCutoffs({})).toBeNull();
  });
});
