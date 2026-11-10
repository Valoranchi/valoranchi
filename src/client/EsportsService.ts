import { EsportsBuilder, VCT_LEAGUE_IDS } from "../collection/EsportsBuilder.js";
import { ValidationError } from "../errors.js";
import type {
  EsportsLive,
  EsportsMatch,
  EsportsOverview,
  EsportsPlayer,
  EsportsStage,
} from "../model/index.js";
import type { EsportsApi, EsportsOptions } from "./api.js";
import type { ClientContext } from "./ClientContext.js";

const DEFAULT_LOCALE = "en-US";

export class EsportsService implements EsportsApi {
  constructor(private readonly context: ClientContext) {}

  async overview(options: EsportsOptions = {}): Promise<EsportsOverview> {
    const session = await this.context.sessions.session();
    const raw = await this.context
      .api(session)
      .esportsOverview(options.locale ?? DEFAULT_LOCALE, options.leagueIds ?? VCT_LEAGUE_IDS);
    return EsportsBuilder.buildOverview(raw);
  }

  async upcoming(options: EsportsOptions = {}): Promise<EsportsMatch[]> {
    const session = await this.context.sessions.session();
    const raw = await this.context
      .api(session)
      .esportsUpcomingMatches(
        options.locale ?? DEFAULT_LOCALE,
        options.leagueIds ?? VCT_LEAGUE_IDS,
      );
    return EsportsBuilder.buildMatches(raw);
  }

  async live(options: EsportsOptions = {}): Promise<EsportsLive> {
    const session = await this.context.sessions.session();
    const raw = await this.context
      .api(session)
      .esportsLiveEventTimes(options.locale ?? DEFAULT_LOCALE, options.leagueIds ?? VCT_LEAGUE_IDS);
    return EsportsBuilder.buildLive(raw);
  }

  async matches(matchIds: string[], options: { locale?: string } = {}): Promise<EsportsMatch[]> {
    if (matchIds.length === 0) return [];
    const session = await this.context.sessions.session();
    const raw = await this.context
      .api(session)
      .esportsMatches(options.locale ?? DEFAULT_LOCALE, matchIds);
    return EsportsBuilder.buildMatches(raw);
  }

  async stages(stageIds: string[], options: { locale?: string } = {}): Promise<EsportsStage[]> {
    if (stageIds.length === 0) return [];
    const session = await this.context.sessions.session();
    const raw = await this.context
      .api(session)
      .esportsStages(options.locale ?? DEFAULT_LOCALE, stageIds);
    return EsportsBuilder.buildStages(raw);
  }

  async roster(teamId: string, options: { locale?: string } = {}): Promise<EsportsPlayer[]> {
    if (!teamId) throw new ValidationError("invalid-team-id", "Expected a team id", { teamId });
    const session = await this.context.sessions.session();
    const raw = await this.context
      .api(session)
      .esportsTeamMembers(options.locale ?? DEFAULT_LOCALE, teamId);
    return EsportsBuilder.buildPlayers(raw);
  }
}
