import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attackingTeam,
  computeMatchStats,
  isRemake,
  teamWon,
  type RiotMatchDetailsSlice,
} from "../src/collection/MatchStats.js";

const fixture = (
  JSON.parse(
    fs.readFileSync(
      path.join(import.meta.dirname, "fixtures", "recorded", "matchDetails.json"),
      "utf-8",
    ),
  ) as { raw: RiotMatchDetailsSlice }
).raw;

const performanceFixture = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures", "matchDetailsPerformance.json"),
    "utf-8",
  ),
) as RiotMatchDetailsSlice;

describe("teamWon", () => {
  const teams = (blue: boolean, red: boolean) => [
    { teamId: "Blue", won: blue },
    { teamId: "Red", won: red },
  ];

  it("reads the team's own flag when somebody won", () => {
    expect(teamWon(teams(true, false), "Blue")).toBe(true);
    expect(teamWon(teams(true, false), "Red")).toBe(false);
  });

  it("is nobody's loss when no team won", () => {
    expect(teamWon(teams(false, false), "Blue")).toBeNull();
    expect(teamWon(teams(false, false), "Red")).toBeNull();
  });

  it("tells a remake by how Riot says the match ended", () => {
    expect(isRemake({ matchInfo: { completionState: "Remake" } })).toBe(true);
    expect(isRemake({ matchInfo: { completionState: "Surrendered" } })).toBe(false);
    expect(isRemake(null)).toBe(false);
  });

  it("has no answer without the team or the list", () => {
    expect(teamWon(teams(true, false), "Green")).toBeNull();
    expect(teamWon(null, "Blue")).toBeNull();
  });
});

describe("computeMatchStats", () => {
  it("computes stats over the real matchDetails fixture", () => {
    const stats = computeMatchStats(fixture);

    expect(stats.rounds.length).toBe(fixture.roundResults!.length);
    expect(stats.players.size).toBe(fixture.players!.length);

    let totalComputedKills = 0;
    let totalPayloadKills = 0;

    for (const p of fixture.players!) {
      const computed = stats.players.get(p.subject);
      expect(computed).toBeDefined();
      expect(computed?.acs).toBeGreaterThan(0);
      expect(computed?.adr).not.toBeNull();
      expect(computed?.adr).toBeGreaterThan(0);
      expect(computed?.hsPct).not.toBeNull();
      expect(computed?.kast).not.toBeNull();

      totalComputedKills += computed?.kd != null ? p.stats!.kills! : 0;
      totalPayloadKills += p.stats!.kills!;
    }

    expect(totalComputedKills).toBe(totalPayloadKills);

    // Verify round strip integrity
    for (let i = 0; i < stats.rounds.length; i++) {
      expect(stats.rounds[i].n).toBe(i + 1);
      expect(stats.rounds[i].winningTeam).toBe(fixture.roundResults![i].winningTeam);
    }
  });

  it("detects KAST trades within 5000 ms and rejects late trades", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        {
          subject: "ally1",
          teamId: "Blue",
          stats: { score: 100, roundsPlayed: 1 },
        },
        {
          subject: "ally2",
          teamId: "Blue",
          stats: { score: 100, roundsPlayed: 1 },
        },
        {
          subject: "enemy1",
          teamId: "Red",
          stats: { score: 100, roundsPlayed: 1 },
        },
      ],
      roundResults: [
        {
          roundNum: 0,
          winningTeam: "Blue",
          playerStats: [],
        },
      ],
      kills: [
        // ally1 dies to enemy1 at 1000ms
        {
          round: 0,
          roundTime: 1000,
          killer: "enemy1",
          victim: "ally1",
        },
        // ally2 trades enemy1 at 4500ms (diff = 3500ms <= 5000ms)
        {
          round: 0,
          roundTime: 4500,
          killer: "ally2",
          victim: "enemy1",
        },
      ],
    };

    const res = computeMatchStats(payload);
    // ally1 died, but was traded by ally2 within 5000ms -> KAST = 100%
    expect(res.players.get("ally1")?.kast).toBe(100);

    // Now test late trade (> 5000ms)
    const latePayload: RiotMatchDetailsSlice = {
      ...payload,
      kills: [
        {
          round: 0,
          roundTime: 1000,
          killer: "enemy1",
          victim: "ally1",
        },
        // trade happens at 6500ms (diff = 5500ms > 5000ms)
        {
          round: 0,
          roundTime: 6500,
          killer: "ally2",
          victim: "enemy1",
        },
      ],
    };

    const lateRes = computeMatchStats(latePayload);
    // ally1 died, not traded in time, no kill, no assist, did not survive -> KAST = 0%
    expect(lateRes.players.get("ally1")?.kast).toBe(0);
  });

  it("attributes first kill and first death to the earliest kill in each round", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "p1", teamId: "Blue" },
        { subject: "p2", teamId: "Red" },
        { subject: "p3", teamId: "Red" },
      ],
      roundResults: [
        {
          roundNum: 0,
          playerStats: [],
        },
      ],
      kills: [
        {
          round: 0,
          roundTime: 2500,
          killer: "p1",
          victim: "p3",
        },
        {
          round: 0,
          roundTime: 1200, // earlier!
          killer: "p1",
          victim: "p2",
        },
      ],
    };

    const res = computeMatchStats(payload);
    expect(res.players.get("p1")?.firstKills).toBe(1);
    expect(res.players.get("p2")?.firstDeaths).toBe(1);
    expect(res.players.get("p3")?.firstDeaths).toBe(0);
  });

  it("attributes multikills correctly (e.g. a 3K)", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "slayer", teamId: "Blue" },
        { subject: "v1", teamId: "Red" },
        { subject: "v2", teamId: "Red" },
        { subject: "v3", teamId: "Red" },
      ],
      roundResults: [
        {
          roundNum: 0,
          playerStats: [],
        },
      ],
      kills: [
        { round: 0, roundTime: 1000, killer: "slayer", victim: "v1" },
        { round: 0, roundTime: 2000, killer: "slayer", victim: "v2" },
        { round: 0, roundTime: 3000, killer: "slayer", victim: "v3" },
      ],
    };

    const res = computeMatchStats(payload);
    const mk = res.players.get("slayer")?.multiKills;
    expect(mk?.k2).toBe(0);
    expect(mk?.k3).toBe(1);
    expect(mk?.k4).toBe(0);
    expect(mk?.k5).toBe(0);
  });

  it("detects a 1v2 clutch and records count and best 1vN", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "clutcher", teamId: "Blue" },
        { subject: "mate", teamId: "Blue" },
        { subject: "enemy1", teamId: "Red" },
        { subject: "enemy2", teamId: "Red" },
      ],
      roundResults: [
        {
          roundNum: 0,
          winningTeam: "Blue",
          playerStats: [],
        },
      ],
      kills: [
        // mate dies at 1000ms to enemy1. Clutcher is now alone against enemy1 and enemy2 (2 enemies alive).
        { round: 0, roundTime: 1000, killer: "enemy1", victim: "mate" },
        // clutcher kills enemy1 at 2000ms
        { round: 0, roundTime: 2000, killer: "clutcher", victim: "enemy1" },
        // clutcher kills enemy2 at 3000ms (last kill)
        { round: 0, roundTime: 3000, killer: "clutcher", victim: "enemy2" },
      ],
    };

    const res = computeMatchStats(payload);
    const clutches = res.players.get("clutcher")?.clutches;
    expect(clutches).toEqual({ count: 1, best: 2 });
  });

  it("attributes plants and defuses", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "planter", teamId: "Red" },
        { subject: "defuser", teamId: "Blue" },
      ],
      roundResults: [
        {
          roundNum: 0,
          bombPlanter: "planter",
          bombDefuser: "defuser",
          playerStats: [],
        },
      ],
    };

    const res = computeMatchStats(payload);
    expect(res.players.get("planter")?.plants).toBe(1);
    expect(res.players.get("planter")?.defuses).toBe(0);
    expect(res.players.get("defuser")?.plants).toBe(0);
    expect(res.players.get("defuser")?.defuses).toBe(1);
  });

  it("calculates ADR ignoring damage to self and teammates", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "shooter", teamId: "Blue" },
        { subject: "ally", teamId: "Blue" },
        { subject: "enemy", teamId: "Red" },
      ],
      roundResults: [
        {
          roundNum: 0,
          playerStats: [
            {
              subject: "shooter",
              damage: [
                { receiver: "shooter", damage: 50 }, // self damage (ignored)
                { receiver: "ally", damage: 30 }, // team damage (ignored)
                { receiver: "enemy", damage: 150, headshots: 1, bodyshots: 1 }, // enemy damage
              ],
            },
          ],
        },
      ],
    };

    const res = computeMatchStats(payload);
    // 150 damage over 1 round -> ADR = 150
    expect(res.players.get("shooter")?.adr).toBe(150);
    // 1 headshot out of 2 hits -> 0.5
    expect(res.players.get("shooter")?.hsPct).toBe(0.5);
  });

  it("counts a flawless round only for the winning team when no member died", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "a1", teamId: "Blue" },
        { subject: "a2", teamId: "Blue" },
        { subject: "e1", teamId: "Red" },
        { subject: "e2", teamId: "Red" },
      ],
      roundResults: [
        { roundNum: 0, winningTeam: "Blue", playerStats: [] },
        { roundNum: 1, winningTeam: "Blue", playerStats: [] },
      ],
      kills: [
        { round: 0, roundTime: 1000, killer: "a1", victim: "e1" },
        { round: 1, roundTime: 1000, killer: "e2", victim: "a2" },
      ],
    };

    const res = computeMatchStats(payload);
    // Round 0 is flawless for Blue; round 1 lost a2, so it is not
    expect(res.players.get("a1")?.flawlessRounds).toBe(1);
    expect(res.players.get("a2")?.flawlessRounds).toBe(1);
    expect(res.players.get("e1")?.flawlessRounds).toBe(0);
    expect(res.players.get("e2")?.flawlessRounds).toBe(0);
  });

  it("computes damageDelta as damage dealt to rivals minus damage taken from them", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "s", teamId: "Blue" },
        { subject: "e", teamId: "Red" },
      ],
      roundResults: [
        {
          roundNum: 0,
          playerStats: [
            { subject: "s", damage: [{ receiver: "e", damage: 150 }] },
            { subject: "e", damage: [{ receiver: "s", damage: 40 }] },
          ],
        },
      ],
    };

    const res = computeMatchStats(payload);
    expect(res.players.get("s")?.damageDelta).toBe(110);
    expect(res.players.get("e")?.damageDelta).toBe(-110);
  });

  it("leaves friendly fire out of both damage dealt and damage taken", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "s", teamId: "Blue" },
        { subject: "ally", teamId: "Blue" },
        { subject: "e", teamId: "Red" },
      ],
      roundResults: [
        {
          roundNum: 0,
          playerStats: [
            {
              subject: "s",
              damage: [
                { receiver: "e", damage: 150 },
                { receiver: "ally", damage: 80 },
              ],
            },
            { subject: "ally", damage: [{ receiver: "s", damage: 60 }] },
            { subject: "e", damage: [{ receiver: "s", damage: 40 }] },
          ],
        },
      ],
    };

    const res = computeMatchStats(payload);
    expect(res.players.get("s")?.adr).toBe(150);
    expect(res.players.get("s")?.damageDelta).toBe(110);
  });

  it("leaves damageDelta null for a player with no team", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "s", teamId: "Blue" },
        { subject: "loner", teamId: null },
      ],
      roundResults: [
        {
          roundNum: 0,
          winningTeam: "Blue",
          playerStats: [{ subject: "loner", damage: [{ receiver: "s", damage: 30 }] }],
        },
      ],
    };

    const res = computeMatchStats(payload);
    expect(res.players.get("loner")?.damageDelta).toBeNull();
    expect(res.players.get("loner")?.adr).toBe(30);
    expect(res.players.get("loner")?.flawlessRounds).toBe(0);
  });

  it("leaves damageDelta and flawlessRounds empty when there are no rounds", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [{ subject: "s", teamId: "Blue" }],
      roundResults: [],
    };

    const res = computeMatchStats(payload);
    expect(res.players.get("s")?.damageDelta).toBeNull();
    expect(res.players.get("s")?.flawlessRounds).toBe(0);
    expect(res.players.get("s")?.weapons).toEqual([]);
  });

  it("counts each weapon's rounds, kills and won rounds over a real match", () => {
    const stats = computeMatchStats(performanceFixture);

    expect(stats.players.get("00000000-0000-4000-8000-000000000008")?.weapons).toEqual([
      { weaponId: "9c82e19d-4575-0200-1a81-3eacf00cf872", rounds: 8, kills: 5, roundsWon: 3 },
      { weaponId: "29a0cfab-485b-f5d5-779a-b59f85e204a8", rounds: 5, kills: 0, roundsWon: 0 },
      { weaponId: "8db0a1bf-4a50-832a-4566-faaaa6d250ca", rounds: 1, kills: 0, roundsWon: 1 },
      { weaponId: "1baa85b4-4c70-1284-64bb-6481dfc3bb4e", rounds: 1, kills: 0, roundsWon: 0 },
      { weaponId: "4ade7faa-4cf1-8376-95ef-39884480959b", rounds: 1, kills: 1, roundsWon: 0 },
      { weaponId: "e336c6b8-418d-9340-d77f-7a9e4cfe0702", rounds: 1, kills: 0, roundsWon: 1 },
      { weaponId: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", rounds: 1, kills: 2, roundsWon: 0 },
    ]);
  });

  it("keeps Riot's round result code beside the result text", () => {
    const rounds = computeMatchStats(performanceFixture).rounds;

    expect(rounds.filter((r) => r.resultCode === "Defuse").map((r) => r.n)).toEqual([4, 9, 12, 17]);
    const others = rounds.filter((r) => r.resultCode !== "Defuse");
    expect(others).toHaveLength(14);
    expect(others.every((r) => r.resultCode === "Elimination")).toBe(true);
    expect(rounds[0].result).toBe("Eliminated");
  });

  it("counts a weapon only with weapon kills of that weapon, case-insensitively", () => {
    const payload: RiotMatchDetailsSlice = {
      players: [
        { subject: "s", teamId: "Blue" },
        { subject: "e", teamId: "Red" },
      ],
      roundResults: [
        {
          roundNum: 0,
          winningTeam: "Blue",
          roundResultCode: "Elimination",
          playerStats: [
            {
              subject: "s",
              economy: { weapon: "AAA" },
              kills: [
                {
                  killer: "s",
                  victim: "e",
                  roundTime: 1000,
                  finishingDamage: { damageType: "Weapon", damageItem: "aaa" },
                },
              ],
            },
          ],
        },
        {
          roundNum: 1,
          winningTeam: "Red",
          roundResultCode: "",
          playerStats: [
            {
              subject: "s",
              economy: { weapon: "aaa" },
              kills: [
                {
                  killer: "s",
                  victim: "e",
                  roundTime: 1000,
                  finishingDamage: { damageType: "Ability", damageItem: "GrenadeAbility" },
                },
                {
                  killer: "s",
                  victim: "e",
                  roundTime: 2000,
                  finishingDamage: { damageType: "Weapon", damageItem: "BBB" },
                },
              ],
            },
          ],
        },
        {
          roundNum: 2,
          winningTeam: "Blue",
          playerStats: [{ subject: "s", economy: { weapon: "BBB" } }],
        },
        {
          roundNum: 3,
          winningTeam: "Blue",
          playerStats: [{ subject: "s", economy: { weapon: "" } }],
        },
        { roundNum: 4, winningTeam: "Blue", playerStats: [] },
      ],
    };

    const res = computeMatchStats(payload);
    expect(res.players.get("s")?.weapons).toEqual([
      { weaponId: "aaa", rounds: 2, kills: 1, roundsWon: 1 },
      { weaponId: "bbb", rounds: 1, kills: 0, roundsWon: 1 },
    ]);
    expect(res.players.get("e")?.weapons).toEqual([]);
    expect(res.rounds.map((r) => r.resultCode)).toEqual(["Elimination", "", null, null, null]);
  });
});

describe("attackingTeam", () => {
  it.each([
    [0, "Red"],
    [11, "Red"],
    [12, "Blue"],
    [23, "Blue"],
    [24, "Red"],
    [25, "Blue"],
  ])("round %i of a full match is attacked by %s", (round, team) => {
    expect(attackingTeam(round, "competitive")).toBe(team);
  });

  it.each([
    [3, "Red"],
    [4, "Blue"],
    [8, "Red"],
    [9, "Blue"],
  ])("round %i of Swiftplay is attacked by %s", (round, team) => {
    expect(attackingTeam(round, "swiftplay")).toBe(team);
  });
});
