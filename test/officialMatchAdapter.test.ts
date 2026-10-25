import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { MatchBuilder } from "../src/collection/MatchBuilder.js";
import { toLeaderboard, toMatchDetails } from "../src/official/OfficialMatchAdapter.js";
import type { OfficialLeaderboardResponse, OfficialMatchResponse } from "../src/official/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

describe("OfficialMatchAdapter", () => {
  const catalogue = new Catalogue(catalogueData);

  const fixture: OfficialMatchResponse = {
    matchInfo: {
      matchId: "off-match-1",
      mapId: "/Game/Maps/Ascent/Ascent",
      gameLengthMillis: 1800000,
      gameStartMillis: 1700000000000,
      provisioningFlowId: "Matchmaking",
      isCompleted: true,
      customGameName: null,
      queueId: "competitive",
      gameMode: "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
      isRanked: true,
      seasonId: "season-uuid-1",
    },
    players: [
      {
        puuid: "p1-uuid",
        gameName: "Jett",
        tagLine: "NA1",
        teamId: "Blue",
        characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
        stats: {
          score: 300,
          roundsPlayed: 1,
          kills: 1,
          deaths: 0,
          assists: 0,
          abilityCasts: { grenadeCasts: 1, ability1Casts: 0, ability2Casts: 0, ultimateCasts: 0 },
        },
        competitiveTier: 15,
        accountLevel: 50,
      },
      {
        puuid: "p2-uuid",
        gameName: "Reyna",
        tagLine: "LATAM",
        teamId: "Red",
        characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
        stats: {
          score: 100,
          roundsPlayed: 1,
          kills: 0,
          deaths: 1,
          assists: 0,
        },
        competitiveTier: 14,
        accountLevel: 42,
      },
    ],
    teams: [
      { teamId: "Blue", won: true, roundsPlayed: 1, roundsWon: 1 },
      { teamId: "Red", won: false, roundsPlayed: 1, roundsWon: 0 },
    ],
    roundResults: [
      {
        roundNum: 0,
        roundResult: "Eliminated",
        winningTeam: "Blue",
        playerStats: [
          {
            puuid: "p1-uuid",
            damage: [
              {
                receiver: "p2-uuid",
                damage: 160,
                legshots: 0,
                bodyshots: 0,
                headshots: 1,
              },
            ],
            kills: [
              {
                gameTime: 45000,
                roundTime: 15000,
                killer: "p1-uuid",
                victim: "p2-uuid",
                finishingDamage: {
                  damageType: "Weapon",
                  damageItem: "ee613ee3-4eb0-ab0e-0888-64939b533ee7",
                },
              },
            ],
          },
        ],
      },
    ],
  };

  it("converts official match and builds valid Match model with MatchBuilder", () => {
    const details = toMatchDetails(fixture);
    expect(details.matchInfo.queueID).toBe("competitive");
    expect(details.players[0]!.subject).toBe("p1-uuid");

    const builder = new MatchBuilder(details, catalogue, "p1-uuid");
    const match = builder.build();

    expect(match.id).toBe("off-match-1");
    expect(match.map.name).toBe("Ascent");
    expect(match.queue).toBe("competitive");
    expect(match.teams).toEqual([
      { id: "Blue", won: true, roundsPlayed: 1, roundsWon: 1, mvp: null },
      { id: "Red", won: false, roundsPlayed: 1, roundsWon: 0, mvp: null },
    ]);
    expect(match.self).toEqual({ team: "Blue", won: true });
    expect(match.rounds[0]!.kills[0]!.weapon).toEqual({
      uuid: "ee613ee3-4eb0-ab0e-0888-64939b533ee7",
      name: "Vandal",
      kind: "Weapon",
    });
  });

  it("builds MatchSummary from adapted official match", () => {
    const details = toMatchDetails(fixture);
    const summary = MatchBuilder.toSummary(details, catalogue);

    expect(summary.id).toBe("off-match-1");
    expect(summary.queue).toBe("competitive");
    expect(summary.map.name).toBe("Ascent");
    expect(summary.startedAt).toBe(new Date(1700000000000).toISOString());
  });

  it("maps official leaderboard response to Leaderboard model", () => {
    const rawLb: OfficialLeaderboardResponse = {
      shard: "na",
      actId: "act-uuid-1",
      totalPlayers: 1,
      players: [
        {
          puuid: "p1-uuid",
          gameName: "TenZ",
          tagLine: "SEN",
          leaderboardRank: 1,
          rankedRating: 950,
          numberOfWins: 85,
          competitiveTier: 27,
        },
      ],
    };

    const lb = toLeaderboard(rawLb, catalogue);
    expect(lb.season).toBe("act-uuid-1");
    expect(lb.total).toBe(1);
    expect(lb.entries).toHaveLength(1);
    expect(lb.entries[0]!.rank).toBe(1);
    expect(lb.entries[0]!.gameName).toBe("TenZ");
    expect(lb.entries[0]!.tagLine).toBe("SEN");
    expect(lb.entries[0]!.rating).toBe(950);
    expect(lb.entries[0]!.wins).toBe(85);
  });
});
