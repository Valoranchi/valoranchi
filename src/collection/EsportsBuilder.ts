import type {
  EsportsLive,
  EsportsLiveWindow,
  EsportsMatch,
  EsportsMatchState,
  EsportsMatchTeam,
  EsportsOverview,
  EsportsPlayer,
  EsportsRound,
  EsportsStage,
  EsportsStageSection,
  EsportsStream,
} from "../model/index.js";
import type {
  RiotEsportsLiveEventTimesResponse,
  RiotEsportsLiveWindow,
  RiotEsportsMatch,
  RiotEsportsMatchesResponse,
  RiotEsportsOverviewResponse,
  RiotEsportsStage,
  RiotEsportsStageCell,
  RiotEsportsStageSection,
  RiotEsportsStagesResponse,
  RiotEsportsStream,
  RiotEsportsTeamMember,
  RiotEsportsTeamMembersResponse,
} from "../riot/types.js";

// Leagues the game itself asks for in its esports hub
export const VCT_LEAGUE_IDS = [
  "107254585505459304",
  "109940824119741550",
  "109974795266458277",
  "106109559530232966",
  "109974804058058602",
  "111691194187846945",
  "109222784797127274",
] as const;

function secure(url: string | null | undefined): string | null {
  return url ? url.replace(/^http:\/\//, "https://") : null;
}

function toState(state: string): EsportsMatchState {
  return state === "unstarted" || state === "inProgress" || state === "completed"
    ? state
    : "unknown";
}

function toResult(result: string | undefined): EsportsMatchTeam["result"] {
  return result === "win" || result === "loss" || result === "tie" ? result : null;
}

function streamUrl(provider: string, parameter: string): string | null {
  const id = encodeURIComponent(parameter);
  if (provider === "twitch") return `https://www.twitch.tv/${id}`;
  if (provider === "youtube") return `https://www.youtube.com/watch?v=${id}`;
  return null;
}

function toStreams(streams: RiotEsportsStream[] | null | undefined): EsportsStream[] {
  return (streams ?? []).flatMap(({ Provider, Parameter, Locale }) => {
    if (!Provider || !Parameter) return [];
    const provider = Provider.toLowerCase();
    return [
      {
        provider,
        parameter: Parameter,
        locale: Locale ?? "",
        url: streamUrl(provider, Parameter),
      },
    ];
  });
}

function toMatch(match: RiotEsportsMatch): EsportsMatch {
  return {
    id: match.ID,
    structuralId: match.StructuralID || null,
    leagueId: match.LeagueID,
    tournamentId: match.TournamentID,
    stageId: match.StageID,
    stageName: match.StageName ?? null,
    startsAt: match.StartTime,
    state: toState(match.State),
    teams: (match.MatchTeams ?? []).map((team) => ({
      teamId: team.TeamID,
      result: toResult(team.Result),
      gameWins: team.GameWins ?? 0,
      originId:
        team.OriginType === "match" && team.OriginStructuralID ? team.OriginStructuralID : null,
    })),
    streams: toStreams(match.Streams),
  };
}

function toRound(cell: RiotEsportsStageCell): EsportsRound {
  return { name: cell.Name, slug: cell.Slug, matchIds: cell.MatchIDs ?? [] };
}

function toSection(section: RiotEsportsStageSection): EsportsStageSection {
  const columns = (section.Columns ?? []).map((column) => (column.Cells ?? []).map(toRound));
  return {
    id: section.ID,
    name: section.Name,
    slug: section.Slug,
    type: section.Type,
    rounds: columns.flat(),
    columns,
    standings: (section.Standings ?? []).map(({ Team }) => ({
      teamId: Team.TeamID,
      wins: Team.TeamRecord?.Wins ?? 0,
      losses: Team.TeamRecord?.Losses ?? 0,
    })),
  };
}

function toStage(stage: RiotEsportsStage): EsportsStage {
  return {
    id: stage.ID,
    name: stage.Name,
    slug: stage.Slug,
    sections: (stage.Sections ?? []).map(toSection),
  };
}

function toPlayer(member: RiotEsportsTeamMember): EsportsPlayer {
  const position = member.Positions?.[0];
  return {
    id: member.ID,
    handle: member.Handle,
    firstName: member.FirstName ?? null,
    lastName: member.LastName ?? null,
    image: secure(member.ImageURL),
    role: position?.Slug ?? null,
    roleName: position?.Name ?? null,
  };
}

function toWindow(window: RiotEsportsLiveWindow): EsportsLiveWindow {
  return { id: window.ID, startsAt: window.StartTimeUTC, endsAt: window.EndTimeUTC };
}

export class EsportsBuilder {
  static buildOverview(raw: RiotEsportsOverviewResponse): EsportsOverview {
    return {
      leagues: (raw.Leagues ?? []).map((league) => ({
        id: league.ID,
        name: league.Name,
        image: secure(league.ImageURL),
        tournamentIds: league.TournamentIDs ?? [],
        teamIds: league.TeamIDs ?? [],
      })),
      tournaments: (raw.Tournaments ?? []).map((tournament) => ({
        id: tournament.ID,
        name: tournament.Name,
        leagueId: tournament.LeagueID,
        startsAt: tournament.StartTime,
        endsAt: tournament.EndTime,
        stageIds: tournament.StageIDs ?? [],
        teamIds: tournament.TeamIDs ?? [],
      })),
      teams: (raw.Teams ?? []).map((team) => ({
        id: team.ID,
        name: team.Name,
        code: team.Code,
        image: secure(team.HighResImageURL ?? team.BaseImageURL ?? team.LowResImageURL),
        homeLeagueId: team.HomeLeagueID ?? null,
        memberIds: team.TeamMemberIDs ?? [],
      })),
    };
  }

  static buildMatches(raw: RiotEsportsMatchesResponse): EsportsMatch[] {
    return (raw.Matches ?? []).map(toMatch);
  }

  static buildStages(raw: RiotEsportsStagesResponse): EsportsStage[] {
    return (raw.Stages ?? []).map(toStage);
  }

  static buildPlayers(raw: RiotEsportsTeamMembersResponse): EsportsPlayer[] {
    return (raw.TeamMembers ?? []).map(toPlayer);
  }

  static buildLive(raw: RiotEsportsLiveEventTimesResponse): EsportsLive {
    return {
      matches: (raw.Matches ?? []).map(toWindow),
      tournaments: (raw.Tournaments ?? []).map(toWindow),
    };
  }
}
