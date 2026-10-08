import { describe, expect, it } from "vitest";
import { sessionSummary } from "../src/analysis/session.js";
import type { Match } from "../src/model/index.js";
import type { RiotCompetitiveUpdate } from "../src/riot/types.js";

function makeMatch(
  id: string,
  startedAt: string,
  result: "win" | "loss" | "draw",
  score: number = 3000,
  roundsPlayed: number = 20,
): Match {
  const won = result === "win" ? true : result === "loss" ? false : null;
  const allyRounds = result === "win" ? 13 : result === "loss" ? 7 : 12;
  const enemyRounds = result === "win" ? 7 : result === "loss" ? 13 : 12;

  return {
    id,
    startedAt,
    lengthMs: 2400000, // 40 minutes
    completed: true,
    queue: "competitive",
    ranked: true,
    custom: false,
    customName: null,
    map: { uuid: "map-1", name: "Ascent", path: "/Game/Maps/Ascent" },
    mode: "Bomb",
    season: { uuid: "season-1", name: "Act 1" },
    teams: [
      { id: "Blue", won: Boolean(won), roundsWon: allyRounds, roundsPlayed },
      { id: "Red", won: result === "loss", roundsWon: enemyRounds, roundsPlayed },
    ],
    players: [
      {
        puuid: "self-puuid",
        gameName: "Self",
        tagLine: "NA1",
        team: "Blue",
        partyId: "p1",
        agent: { uuid: "agent-jett", name: "Jett", icon: null, role: "Duelist" },
        rank: { tier: 20, name: "Diamond 3", division: "3", rating: 50, icon: null },
        accountLevel: 100,
        card: null,
        title: null,
        stats: {
          score,
          kills: 20,
          deaths: 10,
          assists: 5,
          roundsPlayed,
          headshots: 10,
          bodyshots: 20,
          legshots: 2,
          damage: 2500,
          firstBloods: 3,
          plants: 1,
          defuses: 1,
          abilityCasts: { c: 1, q: 2, e: 4, x: 1 },
        },
      },
    ],
    rounds: [],
    self: { team: "Blue", won },
    replayRecorded: true,
  };
}

function makeUpdate(
  matchId: string,
  startTime: number,
  earned: number,
  tierBefore: number = 20,
  ratingBefore: number = 50,
): RiotCompetitiveUpdate {
  return {
    MatchID: matchId,
    MapID: "/Game/Maps/Ascent",
    SeasonID: "season-1",
    MatchStartTime: startTime,
    TierBeforeUpdate: tierBefore,
    TierAfterUpdate: tierBefore,
    RankedRatingBeforeUpdate: ratingBefore,
    RankedRatingAfterUpdate: ratingBefore + earned,
    RankedRatingEarned: earned,
    RankedRatingPerformanceBonus: 0,
    CompetitiveMovement: earned >= 0 ? "PROMOTED" : "DEMOTED",
    AFKPenalty: 0,
  };
}

describe("sessionSummary", () => {
  const baseNow = new Date("2026-10-08T20:00:00.000");

  it("filters matches to today by default (day boundary)", () => {
    const yesterday = new Date(baseNow);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(21, 0, 0, 0);

    const todayMatch = new Date(baseNow);
    todayMatch.setHours(14, 0, 0, 0);

    const mYesterday = makeMatch("m-yest", yesterday.toISOString(), "win");
    const mToday = makeMatch("m-today", todayMatch.toISOString(), "win");

    const summary = sessionSummary([], [mYesterday, mToday], baseNow);
    expect(summary.matches).toBe(1);
    expect(summary.wins).toBe(1);
    expect(summary.bestMatch?.id).toBe("m-today");
  });

  it("resets session after a gap of 4 hours or more within today", () => {
    const morningMatch = new Date(baseNow);
    morningMatch.setHours(9, 0, 0, 0); // ends at 9:40

    const eveningMatch1 = new Date(baseNow);
    eveningMatch1.setHours(16, 0, 0, 0); // gap from 9:40 to 16:00 is 6h20m >= 4h

    const eveningMatch2 = new Date(baseNow);
    eveningMatch2.setHours(17, 30, 0, 0);

    const m1 = makeMatch("m-morning", morningMatch.toISOString(), "loss");
    const m2 = makeMatch("m-eve-1", eveningMatch1.toISOString(), "win");
    const m3 = makeMatch("m-eve-2", eveningMatch2.toISOString(), "win");

    const summary = sessionSummary([], [m1, m2, m3], baseNow);
    expect(summary.matches).toBe(2);
    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(0);
    expect(summary.since).toBe(eveningMatch1.toISOString());
  });

  it("calculates win and loss streaks accurately", () => {
    const t1 = new Date(baseNow);
    t1.setHours(14, 0, 0, 0);
    const t2 = new Date(baseNow);
    t2.setHours(15, 0, 0, 0);
    const t3 = new Date(baseNow);
    t3.setHours(16, 0, 0, 0);

    const matches = [
      makeMatch("m1", t1.toISOString(), "loss"),
      makeMatch("m2", t2.toISOString(), "win"),
      makeMatch("m3", t3.toISOString(), "win"),
    ];

    const summary = sessionSummary([], matches, baseNow);
    expect(summary.streak).toEqual({ kind: "win", length: 2 });
  });

  it("detects tilt when the last 3 decided games are losses", () => {
    const times = [13, 14, 15, 16].map((h) => {
      const d = new Date(baseNow);
      d.setHours(h, 0, 0, 0);
      return d.toISOString();
    });

    const matchesNoTilt = [
      makeMatch("m1", times[0]!, "win"),
      makeMatch("m2", times[1]!, "loss"),
      makeMatch("m3", times[2]!, "loss"),
    ];
    expect(sessionSummary([], matchesNoTilt, baseNow).tilt).toBe(false);

    const matchesWithTilt = [
      makeMatch("m1", times[0]!, "win"),
      makeMatch("m2", times[1]!, "loss"),
      makeMatch("m3", times[2]!, "loss"),
      makeMatch("m4", times[3]!, "loss"),
    ];
    expect(sessionSummary([], matchesWithTilt, baseNow).tilt).toBe(true);

    const matchesTiltWithInterveningDraw = [
      makeMatch("m1", times[0]!, "loss"),
      makeMatch("m2", times[1]!, "loss"),
      makeMatch("m3", times[2]!, "draw"),
      makeMatch("m4", times[3]!, "loss"),
    ];
    expect(sessionSummary([], matchesTiltWithInterveningDraw, baseNow).tilt).toBe(true);
  });

  it("calculates net RR, RR per game, and rank delta", () => {
    const t1 = new Date(baseNow);
    t1.setHours(14, 0, 0, 0);
    const t2 = new Date(baseNow);
    t2.setHours(15, 0, 0, 0);

    const m1 = makeMatch("m1", t1.toISOString(), "win", 4000, 20); // acs 200
    const m2 = makeMatch("m2", t2.toISOString(), "loss", 2000, 20); // acs 100

    const u1 = makeUpdate("m1", t1.getTime(), 22, 20, 30);
    const u2 = makeUpdate("m2", t2.getTime(), -16, 20, 52);

    const summary = sessionSummary([u1, u2], [m1, m2], baseNow);
    expect(summary.rrNet).toBe(6);
    expect(summary.rrPerGame).toBe(3);
    expect(summary.rankStart?.rating).toBe(30);
    expect(summary.rankNow?.rating).toBe(36);
    expect(summary.bestMatch?.acs).toBe(200);
    expect(summary.worstMatch?.acs).toBe(100);
  });
});
