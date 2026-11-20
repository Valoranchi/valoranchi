import { describe, expect, it } from "vitest";
import {
  matchRating,
  percentileOf,
  playerRating,
  quantiles,
  RATING_STATS,
  RATING_WEIGHTS,
  ratingGrade,
  scoreboardPlaces,
  type RatingBenchmarks,
} from "../src/collection/Rating.js";

const CUTS = quantiles(Array.from({ length: 101 }, (_, i) => i));
const BENCHMARKS: RatingBenchmarks = {
  winRate: CUTS,
  kd: CUTS,
  acs: CUTS,
  adr: CUTS,
  kast: CUTS,
  place: CUTS,
};

describe("quantiles", () => {
  it("cuts 0 to 100 into the 21 steps of 5", () => {
    expect(CUTS).toEqual(Array.from({ length: 21 }, (_, i) => i * 5));
  });

  it("sorts a copy of the input and keeps the endpoints", () => {
    const values = [3, 1, 2];
    const cuts = quantiles(values);
    expect(cuts).toHaveLength(21);
    expect(cuts[0]).toBe(1);
    expect(cuts[10]).toBe(2);
    expect(cuts[20]).toBe(3);
    expect(values).toEqual([3, 1, 2]);
  });

  it("interpolates between the values around a cut", () => {
    expect(quantiles([10, 20])[10]).toBe(15);
  });

  it("repeats a single value across every cut", () => {
    expect(quantiles([7])).toEqual(Array.from({ length: 21 }, () => 7));
  });

  it("throws on an empty list", () => {
    expect(() => quantiles([])).toThrow(RangeError);
  });
});

describe("percentileOf", () => {
  it.each([
    [50, 0.5],
    [52.5, 0.525],
    [2.5, 0.025],
    [0, 0],
    [-10, 0],
    [100, 1],
    [150, 1],
  ])("reads acs %d as %d", (value, expected) => {
    expect(percentileOf("acs", CUTS, value)).toBeCloseTo(expected, 10);
  });

  it.each([
    [20, 0.8],
    [52.5, 0.475],
    [0, 1],
    [100, 0],
  ])("inverts place %d to %d", (value, expected) => {
    expect(percentileOf("place", CUTS, value)).toBeCloseTo(expected, 10);
  });

  it("gives the top of a plateau when every cut is equal", () => {
    const flat = Array.from({ length: 21 }, () => 7);
    expect(percentileOf("kd", flat, 7)).toBe(1);
    expect(percentileOf("kd", flat, 6)).toBe(0);
  });
});

describe("ratingGrade", () => {
  it.each([
    [0, "D"],
    [199, "D"],
    [200, "C"],
    [399, "C"],
    [400, "B"],
    [699, "B"],
    [700, "A"],
    [899, "A"],
    [900, "S"],
    [1000, "S"],
  ])("grades %d as %s", (score, grade) => {
    expect(ratingGrade(score)).toBe(grade);
  });
});

describe("RATING_WEIGHTS", () => {
  it("weighs every stat and sums to one", () => {
    expect(Object.keys(RATING_WEIGHTS).sort()).toEqual([...RATING_STATS].sort());
    const total = Object.values(RATING_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("playerRating", () => {
  it("gives every stat at the median a B and a 500 score", () => {
    const rating = playerRating(
      { winRate: 50, kd: 50, acs: 50, adr: 50, kast: 50, place: 50 },
      BENCHMARKS,
    );
    expect(rating?.score).toBe(500);
    expect(rating?.grade).toBe("B");
    for (const stat of RATING_STATS) {
      expect(rating?.stats[stat]?.percentile).toBeCloseTo(0.5, 10);
      expect(rating?.stats[stat]?.grade).toBe("B");
    }
  });

  it("renormalizes the weights over the stats present", () => {
    const rating = playerRating({ acs: 80, place: 35 }, BENCHMARKS);
    expect(rating?.score).toBe(750);
    expect(rating?.grade).toBe("A");
    expect(rating?.stats.acs).toMatchObject({ value: 80, grade: "A" });
    expect(rating?.stats.acs?.percentile).toBeCloseTo(0.8, 10);
    expect(rating?.stats.place).toMatchObject({ value: 35, grade: "B" });
    expect(rating?.stats.place?.percentile).toBeCloseTo(0.65, 10);
    expect(Object.keys(rating?.stats ?? {}).sort()).toEqual(["acs", "place"]);
  });

  it("lets a single stat carry the whole score", () => {
    expect(playerRating({ acs: 80 }, BENCHMARKS)?.score).toBe(800);
  });

  it("leaves out a stat whose cuts are empty", () => {
    expect(playerRating({ acs: 80, kd: 50 }, { ...BENCHMARKS, kd: [] })?.score).toBe(800);
  });

  it("has no rating without any usable stat", () => {
    expect(playerRating({}, BENCHMARKS)).toBeNull();
    expect(playerRating({ kd: Number.NaN }, BENCHMARKS)).toBeNull();
  });
});

describe("matchRating", () => {
  it.each([
    [250, { score: 500, grade: "B" }],
    [349.6, { score: 699, grade: "B" }],
    [450, { score: 900, grade: "S" }],
    [600, { score: 1000, grade: "S" }],
    [-5, { score: 0, grade: "D" }],
    [Number.NaN, { score: 0, grade: "D" }],
  ])("rates performance %d", (performance, expected) => {
    expect(matchRating(performance)).toEqual(expected);
  });
});

describe("scoreboardPlaces", () => {
  it("orders by performance when everyone has it", () => {
    const places = scoreboardPlaces([
      { puuid: "a", performance: 200, score: 300 },
      { puuid: "b", performance: 400, score: 100 },
      { puuid: "c", performance: 300, score: 200 },
    ]);
    expect([...places]).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("orders by combat score when someone lacks performance", () => {
    const places = scoreboardPlaces([
      { puuid: "a", performance: 200, score: 300 },
      { puuid: "b", performance: null, score: 100 },
      { puuid: "c", performance: 300, score: 200 },
    ]);
    expect([...places]).toEqual([
      ["a", 1],
      ["c", 2],
      ["b", 3],
    ]);
  });

  it("keeps the input order on a combat score tie", () => {
    const places = scoreboardPlaces([
      { puuid: "a", score: 100 },
      { puuid: "b", score: 100 },
      { puuid: "c", score: 150 },
    ]);
    expect([...places]).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ]);
  });

  it("is empty for an empty lobby", () => {
    expect(scoreboardPlaces([]).size).toBe(0);
  });
});
