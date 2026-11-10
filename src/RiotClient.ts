import { FileCatalogueStore } from "./catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "./catalogue/ValorantApi.js";
import { AccountService } from "./client/AccountService.js";
import type {
  AccountApi,
  EsportsApi,
  LocalRawApi,
  MatchesApi,
  OfficialApi,
  PartyApi,
  RiotRawApi,
  SocialApi,
  StoreApi,
} from "./client/api.js";
import { createPlayer, type ClientContext } from "./client/ClientContext.js";
import { EsportsService } from "./client/EsportsService.js";
import { EventsService } from "./client/EventsService.js";
import type { LoadoutChange, LoadoutGunChange } from "./client/LoadoutValidator.js";
import { MatchService } from "./client/MatchService.js";
import { OfficialService } from "./client/OfficialService.js";
import { PartyService } from "./client/PartyService.js";
import type { PartyActionRequest } from "./client/PartyValidator.js";
import { SessionManager } from "./client/SessionManager.js";
import { SocialService } from "./client/SocialService.js";
import { StoreService } from "./client/StoreService.js";
import type { RiotEvents } from "./events/RiotEvents.js";
import type { RiotClientLocalApi } from "./local/RiotClientLocalApi.js";
import { HttpGateway } from "./riot/HttpGateway.js";
import { defaultResponseCacheDir, FileResponseCache } from "./riot/ResponseCache.js";
import { RiotApi } from "./riot/RiotApi.js";
import type { Session } from "./riot/Session.js";
import { createRiotServer, type ServeOptions, type ServerInstance } from "./serve/index.js";
import { WatchService, type WatchApi } from "./watch/index.js";

export type { LoadoutChange, LoadoutGunChange, PartyActionRequest };

class LocalRawService implements LocalRawApi {
  constructor(private readonly sessions: SessionManager) {}

  async get<T = unknown>(path: string): Promise<T> {
    const res = await this.sessions.localApi().get<T>(path);
    return res as T;
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.sessions.localApi().post<T>(path, body);
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.sessions.localApi().put<T>(path, body);
  }

  async delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.sessions.localApi().delete<T>(path, body);
  }
}

class RiotRawService implements RiotRawApi {
  constructor(
    private readonly sessions: SessionManager,
    private readonly gateway: HttpGateway,
  ) {}

  private extractHeaders(
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Record<string, string> | undefined {
    if (!options) return undefined;
    if ("headers" in options && options.headers && typeof options.headers === "object") {
      return options.headers;
    }
    return options as Record<string, string>;
  }

  async get<T = unknown>(
    url: string,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T> {
    const session = await this.sessions.session();
    return this.gateway.get<T>(url, session.headers(this.extractHeaders(options)));
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T> {
    const session = await this.sessions.session();
    return this.gateway.post<T>(url, body, session.headers(this.extractHeaders(options)));
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T> {
    const session = await this.sessions.session();
    return this.gateway.put<T>(url, body, session.headers(this.extractHeaders(options)));
  }

  async delete<T = unknown>(
    url: string,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T> {
    const session = await this.sessions.session();
    return this.gateway.delete<T>(url, session.headers(this.extractHeaders(options)));
  }
}

export interface RiotClientOptions {
  language?: string;
  lockfilePath?: string;
  sessionTtlMs?: number;
  catalogueDir?: string | null;
  responseCache?: { ttlMs: number; dir?: string };
  gateway?: HttpGateway;
  valorantApi?: ValorantApi;
  localApiFactory?: (port: number, pass: string) => RiotClientLocalApi;
  officialApiKey?: string;
  officialCache?: boolean;
}

export class RiotClient {
  readonly account: AccountApi;
  readonly social: SocialApi;
  readonly store: StoreApi;
  readonly matches: MatchesApi;
  readonly party: PartyApi;
  readonly official: OfficialApi;
  readonly esports: EsportsApi;
  readonly watch: WatchApi;
  readonly local: LocalRawApi;
  readonly riot: RiotRawApi;

  private readonly sessions: SessionManager;
  private readonly eventsService: EventsService;

  constructor(options: RiotClientOptions = {}) {
    const language = options.language ?? "en-US";
    const gateway = options.gateway ?? new HttpGateway();
    const store =
      options.catalogueDir === null ? null : new FileCatalogueStore(options.catalogueDir);
    const valorantApi =
      options.valorantApi ?? new ValorantApi(gateway, new MemoryCatalogueCache(), store);
    const cacheDir = options.responseCache?.dir ?? defaultResponseCacheDir();
    const responseCache = options.responseCache
      ? new FileResponseCache(options.responseCache.ttlMs, cacheDir)
      : new FileResponseCache(0, cacheDir);

    this.sessions = new SessionManager({
      lockfilePath: options.lockfilePath,
      sessionTtlMs: options.sessionTtlMs,
      valorantApi,
      localApiFactory: options.localApiFactory,
    });

    const api = (session: Session) => new RiotApi(gateway, session, responseCache);
    const context: ClientContext = {
      language,
      sessions: this.sessions,
      valorantApi,
      api,
      catalogue: (lang?: string) => valorantApi.getCatalogue(lang ?? language),
      player: (session: Session) => createPlayer(api(session), session),
      cacheDir,
      gateway,
      officialApiKey: options.officialApiKey,
      officialCache: options.officialCache,
    };

    this.account = new AccountService(context);
    this.social = new SocialService(context);
    this.store = new StoreService(context);
    this.matches = new MatchService(context);
    this.party = new PartyService(context);
    this.official = new OfficialService(context);
    this.esports = new EsportsService(context);
    this.local = new LocalRawService(this.sessions);
    this.riot = new RiotRawService(this.sessions, gateway);
    this.eventsService = new EventsService(context);
    this.watch = new WatchService(() => this.events(), this.matches, this.store);
  }

  events(): RiotEvents {
    return this.eventsService.events();
  }

  async serve(options: ServeOptions = {}): Promise<ServerInstance> {
    return createRiotServer(this, options);
  }

  async close(): Promise<void> {
    this.eventsService.close();
    await this.sessions.close();
  }
}
