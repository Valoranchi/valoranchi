import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { MatchBuilder } from "../src/collection/MatchBuilder.js";
import type { RiotMatchDetailsResponse } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

const standardMatch = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "matchDetails.json"), "utf-8"),
) as RiotMatchDetailsResponse;

const deathmatchMatch = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures", "matchDetailsDeathmatch.json"),
    "utf-8",
  ),
) as RiotMatchDetailsResponse;

describe("MatchBuilder", () => {
  const catalogue = new Catalogue(catalogueData);

  it("builds a standard match with two teams, omitting observers with null stats", () => {
    const builder = new MatchBuilder(standardMatch, catalogue, "self-puuid");
    const match = builder.build();

    expect(match.id).toBe("match-std-1");
    expect(match.map.name).toBe("Ascent");
    expect(match.queue).toBe("competitive");
    expect(match.teams).toEqual([
      { id: "Blue", won: true, roundsPlayed: 20, roundsWon: 13, mvp: null },
      { id: "Red", won: false, roundsPlayed: 20, roundsWon: 7, mvp: null },
    ]);

    expect(match.players).toHaveLength(2);
    expect(match.players.some((p) => p.puuid === "observer-puuid")).toBe(false);

    expect(match.self).toEqual({ team: "Blue", won: true });
    expect(match.replayRecorded).toBe(true);
  });

  it("computes headshots, damage, first bloods, plants, defuses, and ability casts", () => {
    const builder = new MatchBuilder(standardMatch, catalogue, "self-puuid");
    const match = builder.build();
    const self = match.players.find((p) => p.puuid === "self-puuid");
    expect(self).toBeDefined();

    expect(self?.stats).toEqual({
      score: 4500,
      kills: 15,
      deaths: 10,
      assists: 5,
      roundsPlayed: 20,
      headshots: 1,
      bodyshots: 2,
      legshots: 1,
      damage: 310,
      firstBloods: 2,
      plants: 0,
      defuses: 1,
      abilityCasts: { c: 3, q: 4, e: 2, x: 1 },
    });

    const enemy = match.players.find((p) => p.puuid === "enemy-puuid");
    expect(enemy?.stats?.plants).toBe(1);
    expect(enemy?.stats?.defuses).toBe(0);
    expect(enemy?.stats?.firstBloods).toBe(0);
  });

  it("resolves kill weapons and damage types in rounds", () => {
    const builder = new MatchBuilder(standardMatch, catalogue, "self-puuid");
    const match = builder.build();

    expect(match.rounds).toHaveLength(2);
    const round0 = match.rounds[0]!;
    expect(round0.winner).toBe("Blue");
    expect(round0.site).toBe("A");
    expect(round0.planter).toBe("enemy-puuid");
    expect(round0.defuser).toBe("self-puuid");
    expect(round0.kills).toHaveLength(1);
    expect(round0.kills[0]!.weapon).toEqual({
      uuid: "ee613ee3-4eb0-ab0e-0888-64939b533ee7",
      name: "Vandal",
      kind: "Weapon",
    });

    const round1 = match.rounds[1]!;
    expect(round1.kills[0]!.weapon).toEqual({
      uuid: "Ability1",
      name: null,
      kind: "Ability",
    });
  });

  it("handles deathmatch fixtures with teams null", () => {
    const builder = new MatchBuilder(deathmatchMatch, catalogue, "self-puuid");
    const match = builder.build();

    expect(match.teams).toEqual([]);
    expect(match.self).toEqual({ team: "self-puuid", won: null });
    expect(match.players).toHaveLength(2);
  });

  it("produces MatchSummary with toSummary helper", () => {
    const summary = MatchBuilder.toSummary(standardMatch, catalogue);
    expect(summary).toEqual({
      id: "match-std-1",
      startedAt: new Date(1700000000000).toISOString(),
      queue: "competitive",
      map: {
        uuid: "map-1",
        name: "Ascent",
        path: "/Game/Maps/Ascent/Ascent",
      },
    });
  });
});
