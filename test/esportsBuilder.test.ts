import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EsportsBuilder, VCT_LEAGUE_IDS } from "../src/collection/EsportsBuilder.js";
import type {
  RiotEsportsLiveEventTimesResponse,
  RiotEsportsMatch,
  RiotEsportsMatchesResponse,
  RiotEsportsOverviewResponse,
  RiotEsportsStagesResponse,
  RiotEsportsTeamMembersResponse,
} from "../src/riot/types.js";

function fixture<T>(name: string): T {
  const file = path.join(import.meta.dirname, "fixtures", "esports", `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

function rawMatch(overrides: Partial<RiotEsportsMatch>): RiotEsportsMatch {
  return {
    ID: "m1",
    LeagueID: "l1",
    TournamentID: "t1",
    StageID: "s1",
    StartTime: "2026-11-10T20:00:00Z",
    State: "unstarted",
    MatchTeams: [],
    ...overrides,
  };
}

describe("VCT_LEAGUE_IDS", () => {
  it("lists the seven leagues the game asks for, Champions first", () => {
    expect(VCT_LEAGUE_IDS).toHaveLength(7);
    expect(VCT_LEAGUE_IDS[0]).toBe("107254585505459304");
  });
});

describe("EsportsBuilder.buildOverview", () => {
  it("builds leagues, tournaments and teams with secure images", () => {
    const overview = EsportsBuilder.buildOverview(fixture<RiotEsportsOverviewResponse>("overview"));

    expect(overview.leagues).toHaveLength(2);
    expect(overview.leagues[0]).toEqual({
      id: "107254585505459304",
      name: "Champions",
      image: "https://static.lolesports.com/leagues/1636575094815_VCT_Spark_Gold.png",
      tournamentIds: ["115576361459045501"],
      teamIds: ["107745125595754895", "106013381894847385"],
    });
    expect(overview.tournaments).toEqual([
      {
        id: "115576361459045501",
        name: "Champions Shanghai",
        leagueId: "107254585505459304",
        startsAt: "2026-09-23T22:00:00Z",
        endsAt: "2026-10-18T12:00:00Z",
        stageIds: ["115576361460159614", "115576361460159615"],
        teamIds: ["107745125595754895", "106013381894847385"],
      },
    ]);
    expect(overview.teams[0]).toEqual({
      id: "107745125595754895",
      name: "LOUD",
      code: "LOUD",
      image:
        "https://am-a.akamaihd.net/image?resize=256:256&f=http%3A%2F%2Fstatic.lolesports.com%2Fteams%2F1644060140569_LOUDGreen.png",
      homeLeagueId: "109974795266458277",
      memberIds: ["107729647161362937", "111918157299291121"],
    });
  });

  it("falls back to the smallest team image and defaults the optional team fields", () => {
    const overview = EsportsBuilder.buildOverview({
      Leagues: null,
      Tournaments: null,
      Teams: [{ ID: "t1", Name: "Team", Code: "TM", BaseImageURL: "http://static.example/t.png" }],
    });
    expect(overview).toEqual({
      leagues: [],
      tournaments: [],
      teams: [
        {
          id: "t1",
          name: "Team",
          code: "TM",
          image: "https://static.example/t.png",
          homeLeagueId: null,
          memberIds: [],
        },
      ],
    });
  });
});

describe("EsportsBuilder.buildMatches", () => {
  it("reads results, game wins and state of finished matches", () => {
    const [first, second] = EsportsBuilder.buildMatches(
      fixture<RiotEsportsMatchesResponse>("matches"),
    );
    expect(first).toEqual({
      id: "115576361461142741",
      leagueId: "107254585505459304",
      tournamentId: "115576361459045501",
      stageId: "115576361460159615",
      stageName: "Eliminatorias",
      startsAt: "2026-10-08T09:00:00Z",
      state: "completed",
      teams: [
        { teamId: "105748037960121143", result: "loss", gameWins: 0 },
        { teamId: "105680891295502820", result: "win", gameWins: 2 },
      ],
      streams: [],
    });
    expect(second?.teams).toEqual([
      { teamId: "107745125595754895", result: "win", gameWins: 3 },
      { teamId: "106013381894847385", result: "loss", gameWins: 1 },
    ]);
  });

  it("keeps twitch and youtube streams and drops the ones without a parameter", () => {
    const [match] = EsportsBuilder.buildMatches({
      Matches: [
        rawMatch({
          State: "inProgress",
          Streams: [
            { Provider: "Twitch", Parameter: "valorant_es", Locale: "es-ES" },
            { Provider: "youtube", Parameter: "abc123" },
            { Provider: "twitch" },
            { Parameter: "orphan" },
          ],
        }),
      ],
    });
    expect(match?.state).toBe("inProgress");
    expect(match?.streams).toEqual([
      {
        provider: "twitch",
        parameter: "valorant_es",
        locale: "es-ES",
        url: "https://www.twitch.tv/valorant_es",
      },
      {
        provider: "youtube",
        parameter: "abc123",
        locale: "",
        url: "https://www.youtube.com/watch?v=abc123",
      },
    ]);
  });

  it("maps the states, results and providers it does not know", () => {
    const [match] = EsportsBuilder.buildMatches({
      Matches: [
        rawMatch({
          State: "postponed",
          MatchTeams: [{ TeamID: "t1", Result: "draw" }],
          Streams: [{ Provider: "kick", Parameter: "channel" }],
        }),
      ],
    });
    expect(match?.state).toBe("unknown");
    expect(match?.teams).toEqual([{ teamId: "t1", result: null, gameWins: 0 }]);
    expect(match?.streams).toEqual([
      { provider: "kick", parameter: "channel", locale: "", url: null },
    ]);
  });
});

describe("EsportsBuilder.buildStages", () => {
  it("flattens the rounds of a section in order and reads the standings", () => {
    const [stage] = EsportsBuilder.buildStages(fixture<RiotEsportsStagesResponse>("stages"));
    const [section] = stage?.sections ?? [];
    expect(stage?.slug).toBe("groups");
    expect(section?.rounds.map((round) => round.slug)).toEqual([
      "round_1",
      "upper_bracket_finals",
      "lower_bracket_round_1",
      "lower_bracket_finals",
    ]);
    expect(section?.rounds[0]).toEqual({
      name: "Ronda 1",
      slug: "round_1",
      matchIds: ["115576361461077125", "115576361461077129"],
    });
    expect(section?.standings).toEqual([
      { teamId: "105748037960121143", wins: 2, losses: 0 },
      { teamId: "105827039633208481", wins: 2, losses: 1 },
      { teamId: "105720659034682989", wins: 1, losses: 2 },
      { teamId: "111878266367184534", wins: 0, losses: 2 },
    ]);
  });
});

describe("EsportsBuilder.buildPlayers", () => {
  it("reads the role of players and coaches", () => {
    const [kamo] = EsportsBuilder.buildPlayers(
      fixture<RiotEsportsTeamMembersResponse>("teamMembers"),
    );
    expect(kamo).toEqual({
      id: "107736211832747525",
      handle: "kamo",
      firstName: "Kamil",
      lastName: "Frąckowiak",
      image:
        "https://am-a.akamaihd.net/image?resize=256:256&f=http%3A%2F%2Fstatic.lolesports.com%2Fplayers%2F1784890123163_kamo-01.png",
      role: "player",
      roleName: "Jugador",
    });

    expect(
      EsportsBuilder.buildPlayers({
        TeamMembers: [
          { ID: "c1", Handle: "Coach", Positions: [{ Name: "Coach", Slug: "coach" }] },
          { ID: "c2", Handle: "NoRole", Positions: null },
        ],
      }),
    ).toEqual([
      {
        id: "c1",
        handle: "Coach",
        firstName: null,
        lastName: null,
        image: null,
        role: "coach",
        roleName: "Coach",
      },
      {
        id: "c2",
        handle: "NoRole",
        firstName: null,
        lastName: null,
        image: null,
        role: null,
        roleName: null,
      },
    ]);
  });
});

describe("EsportsBuilder.buildLive", () => {
  it("reads the windows of the live tournaments", () => {
    expect(
      EsportsBuilder.buildLive(fixture<RiotEsportsLiveEventTimesResponse>("liveEventTimes")),
    ).toEqual({
      matches: [],
      tournaments: [
        {
          id: "115576361459045501",
          startsAt: "2026-09-10T15:00:00Z",
          endsAt: "2026-10-25T20:00:00Z",
        },
        {
          id: "117200126947483851",
          startsAt: "2026-10-16T07:00:00Z",
          endsAt: "2026-11-04T23:59:59Z",
        },
      ],
    });
  });

  it("reads the windows of live matches", () => {
    expect(
      EsportsBuilder.buildLive({
        Matches: [
          { ID: "m1", StartTimeUTC: "2026-11-10T20:00:00Z", EndTimeUTC: "2026-11-10T22:00:00Z" },
        ],
        Tournaments: null,
      }),
    ).toEqual({
      matches: [{ id: "m1", startsAt: "2026-11-10T20:00:00Z", endsAt: "2026-11-10T22:00:00Z" }],
      tournaments: [],
    });
  });
});
