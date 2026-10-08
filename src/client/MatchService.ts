import { ContentBuilder } from "../collection/ContentBuilder.js";
import { LeaderboardBuilder } from "../collection/LeaderboardBuilder.js";
import { MatchBuilder } from "../collection/MatchBuilder.js";
import { MmrBuilder } from "../collection/MmrBuilder.js";
import type {
  Content,
  Leaderboard,
  LiveMatch,
  Match,
  MatchSummary,
  Mmr,
  Premier,
  RankChange,
  RatingTrend,
  PerformanceSummary,
  PlayerAssessment,
  MatchSyncResult,
  Session,
} from "../model/index.js";
import { ratingTrend } from "../analysis/ratingTrend.js";
import { performanceSummary } from "../analysis/performanceSummary.js";
import { playerAssessment } from "../analysis/playerAssessment.js";
import { sessionSummary } from "../analysis/session.js";
import { loadKnownMatches, saveKnownMatches, syncMatches } from "../analysis/matchSync.js";
import { defaultResponseCacheDir } from "../riot/ResponseCache.js";
import type { RiotMatchHistoryItem } from "../riot/types.js";
import { EventsService } from "./EventsService.js";
import { MatchWatcher } from "../watch/MatchWatcher.js";
import {
  Instalock,
  type InstalockHandle,
  type InstalockOptions,
} from "../watch/Instalock.js";
import type { MatchesApi } from "./api.js";
import type { ClientContext } from "./ClientContext.js";
import { LiveMatchService } from "./LiveMatchService.js";
import { MatchValidator } from "./MatchValidator.js";
import { ValidationError } from "../errors.js";

export class MatchService implements MatchesApi {
  private readonly liveMatchService: LiveMatchService;

  constructor(private readonly context: ClientContext) {
    this.liveMatchService = new LiveMatchService(context);
  }

  async list(options?: { count?: number; queue?: string }): Promise<MatchSummary[]> {
    const session = await this.context.sessions.session();
    return this.fetchMatchList(session.puuid, options);
  }

  async listFor(
    puuid: string,
    options?: { count?: number; queue?: string },
  ): Promise<MatchSummary[]> {
    return this.fetchMatchList(puuid, options);
  }

  private async fetchMatchList(
    puuid: string,
    options?: { count?: number; queue?: string },
  ): Promise<MatchSummary[]> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const targetCount = Math.min(Math.max(options?.count ?? 20, 1), 100);
    const collected: RiotMatchHistoryItem[] = [];

    for (let start = 0; start < targetCount; start += 20) {
      if (start > 0) await new Promise((r) => setTimeout(r, 500));
      const end = Math.min(start + 20, targetCount);
      const page = await api.matchHistory(start, end, options?.queue, puuid);
      const history = page.History ?? [];
      if (history.length === 0) break;
      collected.push(...history);
      if (history.length < end - start) break;
    }

    const summaries = await Promise.all(
      collected.slice(0, targetCount).map(async (item) => {
        try {
          const details = await api.matchDetails(item.MatchID);
          return MatchBuilder.toSummary(details, catalogue);
        } catch {
          return {
            id: item.MatchID,
            startedAt: new Date(item.GameStartTime).toISOString(),
            queue: item.QueueID,
            map: { uuid: null, name: null, path: "" },
          };
        }
      }),
    );

    return options?.queue
      ? summaries.filter((s) => s.queue.toLowerCase() === options.queue!.toLowerCase())
      : summaries;
  }

  private async fetchMatchListPage(
    puuid: string,
    start: number,
    count: number,
  ): Promise<MatchSummary[]> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const page = await api.matchHistory(start, start + count, undefined, puuid);
    const history = page.History ?? [];
    if (history.length === 0) return [];

    return Promise.all(
      history.map(async (item) => {
        try {
          const details = await api.matchDetails(item.MatchID);
          return MatchBuilder.toSummary(details, catalogue);
        } catch {
          return {
            id: item.MatchID,
            startedAt: new Date(item.GameStartTime).toISOString(),
            queue: item.QueueID,
            map: { uuid: null, name: null, path: "" },
          };
        }
      }),
    );
  }

  async sync(options?: { maxPages?: number }): Promise<MatchSyncResult> {
    const session = await this.context.sessions.session();
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    const known = loadKnownMatches(cacheDir, session.puuid);
    const knownIds = new Set(known.map((m) => m.id));

    const fetcher = (startIndex: number) => this.fetchMatchListPage(session.puuid, startIndex, 20);

    const added = await syncMatches(fetcher, knownIds, { maxPages: options?.maxPages });
    const allMatches = [...added, ...known];
    saveKnownMatches(cacheDir, session.puuid, allMatches);
    const total = loadKnownMatches(cacheDir, session.puuid).length;
    return { added, total };
  }

  async known(puuid?: string): Promise<MatchSummary[]> {
    const targetPuuid = puuid ?? (await this.context.sessions.session()).puuid;
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    return loadKnownMatches(cacheDir, targetPuuid);
  }

  async get(id: string): Promise<Match> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [details, catalogue] = await Promise.all([
      api.matchDetails(id),
      this.context.catalogue(),
    ]);
    return new MatchBuilder(details, catalogue, session.puuid).build();
  }

  async mmr(): Promise<Mmr> {
    const session = await this.context.sessions.session();
    return this.mmrFor(session.puuid);
  }

  async mmrFor(puuid: string): Promise<Mmr> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawMmr, rawUpdates, catalogue] = await Promise.all([
      api.mmr(puuid),
      api.competitiveUpdates(0, 20, "competitive", puuid),
      this.context.catalogue(),
    ]);
    return new MmrBuilder(catalogue).buildMmr(rawMmr, rawUpdates.Matches ?? []);
  }

  async rankHistory(options?: { count?: number }): Promise<RankChange[]> {
    const session = await this.context.sessions.session();
    return this.rankHistoryFor(session.puuid, options);
  }

  async rankHistoryFor(puuid: string, options?: { count?: number }): Promise<RankChange[]> {
    const count = Math.max(options?.count ?? 20, 1);
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawUpdates, catalogue] = await Promise.all([
      api.competitiveUpdates(0, count, "competitive", puuid),
      this.context.catalogue(),
    ]);
    return new MmrBuilder(catalogue).buildRankChanges(rawUpdates.Matches ?? []);
  }

  async live(options?: { ranks?: boolean; loadouts?: boolean }): Promise<LiveMatch> {
    return this.liveMatchService.liveMatch(options);
  }

  async leaderboard(options?: {
    season?: string;
    start?: number;
    size?: number;
    query?: string;
  }): Promise<Leaderboard> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    let seasonId = options?.season ?? catalogue.currentAct()?.uuid;
    if (!seasonId) {
      const content = await api.content();
      const activeAct = content.Seasons.find((s) => s.Type.toLowerCase() === "act" && s.IsActive);
      seasonId = activeAct?.ID ?? "";
    }
    const raw = await api.leaderboard(
      seasonId,
      options?.start ?? 0,
      options?.size ?? 100,
      options?.query ?? "",
    );
    return new LeaderboardBuilder(catalogue).build(raw);
  }

  async content(): Promise<Content> {
    const session = await this.context.sessions.session();
    const raw = await this.context.api(session).content();
    return ContentBuilder.build(raw);
  }

  async premier(): Promise<Premier> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [eligibility, roster, activeSeason, conferences] = await Promise.all([
      api.premierEligibility().catch(() => null),
      api.premierPlayer().catch(() => null),
      api.premierActiveSeason().catch(() => null),
      api.premierConferences().catch(() => null),
    ]);

    const eligRecord = eligibility as Record<string, unknown> | null;
    const isEligible = eligRecord
      ? typeof eligRecord.eligible === "boolean"
        ? eligRecord.eligible
        : typeof eligRecord.IsEligible === "boolean"
          ? eligRecord.IsEligible
          : true
      : null;

    return {
      eligible: isEligible,
      roster,
      season: activeSeason,
      conferences,
    };
  }

  async validateSelectAgent(
    agent: string,
  ): Promise<{ method: string; path: string; matchId: string; agentUuid: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const pregame = await api.pregamePlayer();
    if (!pregame?.MatchID) {
      throw new ValidationError("not-in-pregame", "Not currently in pregame agent select");
    }
    const [pregameMatch, entitlements] = await Promise.all([
      api.pregameMatch(pregame.MatchID),
      api.entitlements(),
    ]);
    return MatchValidator.validateSelectOrLock(
      pregameMatch,
      catalogue,
      entitlements,
      agent,
      session.puuid,
      "select",
    );
  }

  async selectAgent(agent: string): Promise<LiveMatch> {
    const validated = await this.validateSelectAgent(agent);
    const session = await this.context.sessions.session();
    await this.context.api(session).selectAgent(validated.matchId, validated.agentUuid);
    return this.live();
  }

  async validateLockAgent(
    agent: string,
  ): Promise<{ method: string; path: string; matchId: string; agentUuid: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const pregame = await api.pregamePlayer();
    if (!pregame?.MatchID) {
      throw new ValidationError("not-in-pregame", "Not currently in pregame agent select");
    }
    const [pregameMatch, entitlements] = await Promise.all([
      api.pregameMatch(pregame.MatchID),
      api.entitlements(),
    ]);
    return MatchValidator.validateSelectOrLock(
      pregameMatch,
      catalogue,
      entitlements,
      agent,
      session.puuid,
      "lock",
    );
  }

  async lockAgent(agent: string): Promise<LiveMatch> {
    const validated = await this.validateLockAgent(agent);
    const session = await this.context.sessions.session();
    await this.context.api(session).lockAgent(validated.matchId, validated.agentUuid);
    return this.live();
  }

  async validateDodge(options?: {
    confirm?: boolean;
  }): Promise<{ method: string; path: string; matchId: string }> {
    const session = await this.context.sessions.session();
    const pregame = await this.context.api(session).pregamePlayer();
    return MatchValidator.validateDodge(pregame, options);
  }

  async dodge(options?: { confirm?: boolean }): Promise<{ dodged: boolean; matchId: string }> {
    const validated = await this.validateDodge(options);
    const session = await this.context.sessions.session();
    await this.context.api(session).quitPregameMatch(validated.matchId);
    return { dodged: true, matchId: validated.matchId };
  }

  async validateLeaveMatch(options?: {
    confirm?: boolean;
  }): Promise<{ method: string; path: string; matchId: string; puuid: string }> {
    const session = await this.context.sessions.session();
    const core = await this.context.api(session).coreGamePlayer();
    return MatchValidator.validateLeaveMatch(core, session.puuid, options);
  }

  async leaveMatch(options?: { confirm?: boolean }): Promise<{ left: boolean; matchId: string }> {
    const validated = await this.validateLeaveMatch(options);
    const session = await this.context.sessions.session();
    await this.context.api(session).disassociatePlayer(validated.matchId, session.puuid);
    return { left: true, matchId: validated.matchId };
  }

  async trend(options?: { count?: number; puuid?: string }): Promise<RatingTrend> {
    const session = await this.context.sessions.session();
    const puuid = options?.puuid ?? session.puuid;
    const count = Math.max(options?.count ?? 20, 1);
    const api = this.context.api(session);
    const [rawUpdates, mmr] = await Promise.all([
      api.competitiveUpdates(0, count, "competitive", puuid),
      this.mmrFor(puuid).catch(() => null),
    ]);
    return ratingTrend(rawUpdates.Matches ?? [], mmr?.current ?? null);
  }

  async summary(options?: {
    count?: number;
    queue?: string;
    puuid?: string;
    onProgress?: (done: number, total: number) => void;
  }): Promise<PerformanceSummary> {
    const session = await this.context.sessions.session();
    const puuid = options?.puuid ?? session.puuid;
    const targetCount = Math.min(Math.max(options?.count ?? 10, 1), 50);
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();

    const historyPage = await api.matchHistory(0, targetCount, options?.queue, puuid);
    let items = historyPage.History ?? [];
    if (options?.queue) {
      items = items.filter((h) => h.QueueID.toLowerCase() === options.queue!.toLowerCase());
    }
    const matchIds = items.slice(0, targetCount).map((h) => h.MatchID);

    const matches: Match[] = [];
    for (let i = 0; i < matchIds.length; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      try {
        const details = await api.matchDetails(matchIds[i]!);
        matches.push(new MatchBuilder(details, catalogue, puuid).build());
      } catch {}
      options?.onProgress?.(i + 1, matchIds.length);
    }

    return performanceSummary(matches, puuid, catalogue);
  }

  async assess(puuid?: string): Promise<PlayerAssessment> {
    const session = await this.context.sessions.session();
    const targetPuuid = puuid ?? session.puuid;
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();

    let accountLevel = 0;
    if (targetPuuid === session.puuid) {
      const player = await this.context.player(session);
      accountLevel = player.accountLevel;
    } else {
      try {
        const history = await api.matchHistory(0, 1, undefined, targetPuuid);
        if (history.History && history.History.length > 0) {
          const details = await api.matchDetails(history.History[0]!.MatchID);
          const p = details.players?.find((pl) => pl.subject === targetPuuid);
          accountLevel = p?.accountLevel ?? 0;
        }
      } catch {
        accountLevel = 0;
      }
    }

    const [rawMmr, rawUpdates] = await Promise.all([
      api.mmr(targetPuuid),
      api.competitiveUpdates(0, 20, "competitive", targetPuuid).catch(() => ({ Matches: [] })),
    ]);

    const mmr = new MmrBuilder(catalogue).buildMmr(rawMmr, rawUpdates.Matches ?? []);
    return playerAssessment({
      puuid: targetPuuid,
      accountLevel,
      mmr,
      updates: rawUpdates.Matches ?? [],
    });
  }

  async session(options?: { since?: string }): Promise<Session> {
    const session = await this.context.sessions.session();
    const puuid = session.puuid;
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();

    const [historyPage, rawUpdates] = await Promise.all([
      api.matchHistory(0, 20, undefined, puuid),
      api.competitiveUpdates(0, 20, "competitive", puuid).catch(() => ({ Matches: [] })),
    ]);

    const items = historyPage.History ?? [];
    const matchIds = items.map((h) => h.MatchID);
    const matches: Match[] = [];

    for (let i = 0; i < matchIds.length; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      try {
        const details = await api.matchDetails(matchIds[i]!);
        matches.push(new MatchBuilder(details, catalogue, puuid).build());
      } catch {}
    }

    return sessionSummary(rawUpdates.Matches ?? [], matches, new Date(), {
      since: options?.since,
      puuid,
      catalogue,
    });
  }

  instalock(options: InstalockOptions): InstalockHandle {
    const events = new EventsService(this.context).events();
    const watcher = new MatchWatcher(events, this, { pollIntervalMs: 1000 });
    return new Instalock(watcher, this, options, true);
  }
}

