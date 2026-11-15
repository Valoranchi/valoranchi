import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchMvps, playerPerformance } from "../src/collection/Performance.js";
import type { RiotMatchDetailsResponse } from "../src/riot/types.js";

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures", "matchDetailsPerformance.json"),
    "utf-8",
  ),
) as RiotMatchDetailsResponse;

const MATCH_MVP = "00000000-0000-4000-8000-000000000002";
const SELF = "11111111-2222-4333-8444-555555555555";

const player = (subject: string) => {
  const found = fixture.players.find((p) => p.subject === subject);
  if (!found) throw new Error(`${subject} is not in the fixture`);
  return found;
};

describe("playerPerformance", () => {
  it("reads the score, grade and breakdown of the match's MVP", () => {
    expect(playerPerformance(player(MATCH_MVP).scores)).toMatchObject({
      score: 410,
      combat: 370,
      support: 500,
      grade: "merit",
      combatBreakdown: {
        damage: "up",
        killImpact: "double_up",
        deathImpact: "neutral",
        trades: "double_up",
      },
      supportBreakdown: {
        assists: "double_up",
        plants: "neutral",
        defuses: "double_up",
        utilityUsage: "double_up",
      },
    });
  });

  it("reads a player below the merit cut as a pass", () => {
    expect(playerPerformance(player(SELF).scores)).toMatchObject({
      score: 294,
      combat: 302,
      support: 269,
      grade: "pass",
    });
  });

  it("is null for a player without a score", () => {
    expect(playerPerformance(undefined)).toBeNull();
    expect(playerPerformance(null)).toBeNull();
    expect(playerPerformance({})).toBeNull();
    expect(playerPerformance({ TempValueG: 300 })).toBeNull();
    expect(playerPerformance({ TempValueF: Number.NaN })).toBeNull();
  });

  it("falls back to pass and neutral for words it does not know", () => {
    const odd = structuredClone(player(MATCH_MVP).scores!);
    odd.TempValueL!.TempValueO = "legend";
    odd.TempValueL!.TempValueP!.damage = "sideways";
    odd.TempValueL!.TempValueQ!.plants = "";

    const performance = playerPerformance(odd);

    expect(performance?.grade).toBe("pass");
    expect(performance?.combatBreakdown.damage).toBe("neutral");
    expect(performance?.supportBreakdown.plants).toBe("neutral");
    expect(performance?.combatBreakdown.killImpact).toBe("double_up");
  });

  it("keeps the score when the rest of the detail is missing", () => {
    expect(playerPerformance({ TempValueF: 249.6 })).toEqual({
      score: 250,
      combat: 0,
      support: 0,
      grade: "pass",
      combatTrend: "neutral",
      supportTrend: "neutral",
      combatBreakdown: {
        damage: "neutral",
        killImpact: "neutral",
        deathImpact: "neutral",
        trades: "neutral",
      },
      supportBreakdown: {
        assists: "neutral",
        plants: "neutral",
        defuses: "neutral",
        utilityUsage: "neutral",
      },
    });
  });
});

describe("matchMvps", () => {
  it("reads the match's MVP and the one of each team", () => {
    const { mvp, teamMvps } = matchMvps(fixture);

    expect(mvp).toBe(MATCH_MVP);
    expect(teamMvps).toHaveLength(2);
    expect(teamMvps).toEqual(expect.arrayContaining([MATCH_MVP, SELF]));
  });

  it("has nobody for a match that predates them", () => {
    expect(matchMvps({ teams: [{ mvp: "" }, {}] })).toEqual({
      mvp: null,
      teamMvps: [],
    });
    expect(matchMvps(null)).toEqual({ mvp: null, teamMvps: [] });
  });
});
