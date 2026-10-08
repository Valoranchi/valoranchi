import type { HttpGateway } from "./HttpGateway.js";
import type { FileResponseCache } from "./ResponseCache.js";
import type { Session } from "./Session.js";
import type {
  RiotAccountXpResponse,
  RiotClientConfigResponse,
  RiotCompetitiveUpdatesResponse,
  RiotContentResponse,
  RiotContractsResponse,
  RiotCoreGameLoadoutsResponse,
  RiotCoreGameMatchResponse,
  RiotCoreGamePlayerResponse,
  RiotCustomGameConfigsResponse,
  RiotEntitlementsResponse,
  RiotFavoritesResponse,
  RiotLeaderboardResponse,
  RiotLoadoutResponse,
  RiotMatchDetailsResponse,
  RiotMatchHistoryResponse,
  RiotMmrResponse,
  RiotNameResponse,
  RiotOffersResponse,
  RiotOrderResponse,
  RiotPartyPlayerResponse,
  RiotPartyResponse,
  RiotPenaltiesResponse,
  RiotPregameMatchResponse,
  RiotPregamePlayerResponse,
  RiotQueueConfigsResponse,
  RiotSessionResponse,
  RiotStorefrontResponse,
  RiotWalletResponse,
} from "./types.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class RiotApi {
  private readonly gateway: HttpGateway;
  private readonly session: Session;
  private readonly cache: FileResponseCache | null;

  constructor(gateway: HttpGateway, session: Session, cache: FileResponseCache | null = null) {
    this.gateway = gateway;
    this.session = session;
    this.cache = cache;
  }

  private get<T>(url: string): Promise<T> {
    return this.cached(`GET ${url}`, () => this.gateway.get<T>(url, this.session.headers()));
  }

  private cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cache ? this.cache.through(`${this.session.puuid} ${key}`, fetcher) : fetcher();
  }

  async entitlements(): Promise<RiotEntitlementsResponse> {
    return this.get(`${this.session.endpoints.pd}/store/v1/entitlements/${this.session.puuid}`);
  }

  async loadout(): Promise<RiotLoadoutResponse> {
    return this.get(
      `${this.session.endpoints.pd}/personalization/v3/players/${this.session.puuid}/playerloadout`,
    );
  }

  async putLoadout(body: unknown): Promise<RiotLoadoutResponse> {
    const url = `${this.session.endpoints.pd}/personalization/v3/players/${this.session.puuid}/playerloadout`;
    return this.gateway.put<RiotLoadoutResponse>(url, body, this.session.headers());
  }

  invalidateLoadout(): void {
    if (this.cache) {
      const loadoutUrl = `${this.session.endpoints.pd}/personalization/v3/players/${this.session.puuid}/playerloadout`;
      const entitlementsUrl = `${this.session.endpoints.pd}/store/v1/entitlements/${this.session.puuid}`;
      this.cache.forget(`${this.session.puuid} GET ${loadoutUrl}`);
      this.cache.forget(`${this.session.puuid} GET ${entitlementsUrl}`);
    }
  }

  async accountXp(): Promise<RiotAccountXpResponse> {
    return this.get(`${this.session.endpoints.pd}/account-xp/v1/players/${this.session.puuid}`);
  }

  async wallet(): Promise<RiotWalletResponse> {
    return this.get(`${this.session.endpoints.pd}/store/v1/wallet/${this.session.puuid}`);
  }

  async storefront(): Promise<RiotStorefrontResponse> {
    const url = `${this.session.endpoints.pd}/store/v3/storefront/${this.session.puuid}`;
    return this.cached(`POST ${url}`, () =>
      this.gateway.post<RiotStorefrontResponse>(url, {}, this.session.headers()),
    );
  }

  async names(puuids: string[]): Promise<RiotNameResponse[]> {
    const url = `${this.session.endpoints.pd}/name-service/v2/players`;
    return this.cached(`PUT ${url} ${puuids.join(",")}`, () =>
      this.gateway.put<RiotNameResponse[]>(url, puuids, this.session.headers()),
    );
  }

  async matchHistory(
    startIndex = 0,
    endIndex = 20,
    queue?: string,
    puuid = this.session.puuid,
  ): Promise<RiotMatchHistoryResponse> {
    const queueParam = queue ? `&queue=${encodeURIComponent(queue)}` : "";
    const url = `${this.session.endpoints.pd}/match-history/v1/history/${puuid}?startIndex=${startIndex}&endIndex=${endIndex}${queueParam}`;
    return this.get(url);
  }

  async matchDetails(matchId: string): Promise<RiotMatchDetailsResponse> {
    const url = `${this.session.endpoints.pd}/match-details/v1/matches/${matchId}`;
    const fetcher = () => this.gateway.get<RiotMatchDetailsResponse>(url, this.session.headers());
    return this.cache
      ? this.cache.through(`matchDetails ${matchId}`, fetcher, { ttlMs: THIRTY_DAYS_MS })
      : fetcher();
  }

  async mmr(puuid = this.session.puuid): Promise<RiotMmrResponse> {
    return this.get(`${this.session.endpoints.pd}/mmr/v1/players/${puuid}`);
  }

  async competitiveUpdates(
    startIndex = 0,
    endIndex = 20,
    queue = "competitive",
    puuid = this.session.puuid,
  ): Promise<RiotCompetitiveUpdatesResponse> {
    const url = `${this.session.endpoints.pd}/mmr/v1/players/${puuid}/competitiveupdates?startIndex=${startIndex}&endIndex=${endIndex}&queue=${encodeURIComponent(queue)}`;
    return this.get(url);
  }

  async pregamePlayer(): Promise<RiotPregamePlayerResponse | null> {
    const url = `${this.session.endpoints.glz}/pregame/v1/players/${this.session.puuid}`;
    return this.gateway.getOrNull(url, this.session.headers());
  }

  async pregameMatch(id: string): Promise<RiotPregameMatchResponse> {
    const url = `${this.session.endpoints.glz}/pregame/v1/matches/${id}`;
    return this.gateway.get(url, this.session.headers());
  }

  async selectAgent(matchId: string, agentUuid: string): Promise<RiotPregameMatchResponse> {
    const url = `${this.session.endpoints.glz}/pregame/v1/matches/${encodeURIComponent(matchId)}/select/${encodeURIComponent(agentUuid)}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async lockAgent(matchId: string, agentUuid: string): Promise<RiotPregameMatchResponse> {
    const url = `${this.session.endpoints.glz}/pregame/v1/matches/${encodeURIComponent(matchId)}/lock/${encodeURIComponent(agentUuid)}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async quitPregameMatch(matchId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/pregame/v1/matches/${encodeURIComponent(matchId)}/quit`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async pregameLoadouts(matchId: string): Promise<RiotCoreGameLoadoutsResponse> {
    const url = `${this.session.endpoints.glz}/pregame/v1/matches/${encodeURIComponent(matchId)}/loadouts`;
    return this.gateway.get(url, this.session.headers());
  }

  async coreGamePlayer(): Promise<RiotCoreGamePlayerResponse | null> {
    const url = `${this.session.endpoints.glz}/core-game/v1/players/${this.session.puuid}`;
    return this.gateway.getOrNull(url, this.session.headers());
  }

  async coreGameMatch(id: string): Promise<RiotCoreGameMatchResponse> {
    const url = `${this.session.endpoints.glz}/core-game/v1/matches/${id}`;
    return this.gateway.get(url, this.session.headers());
  }

  async coreGameLoadouts(id: string): Promise<RiotCoreGameLoadoutsResponse> {
    const url = `${this.session.endpoints.glz}/core-game/v1/matches/${id}/loadouts`;
    return this.gateway.get(url, this.session.headers());
  }

  async disassociatePlayer(matchId: string, puuid = this.session.puuid): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/core-game/v1/players/${encodeURIComponent(puuid)}/disassociate/${encodeURIComponent(matchId)}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async partyPlayer(): Promise<RiotPartyPlayerResponse | null> {
    const url = `${this.session.endpoints.glz}/parties/v1/players/${this.session.puuid}`;
    return this.gateway.getOrNull(url, this.session.headers());
  }

  async party(id: string): Promise<RiotPartyResponse> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${id}`;
    return this.gateway.get(url, this.session.headers());
  }

  async inviteToParty(partyId: string, name: string, tag: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/invites/name/${encodeURIComponent(name)}/tag/${encodeURIComponent(tag)}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async createPartyInviteCode(partyId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/invitecode`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async revokePartyInviteCode(partyId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/invitecode`;
    return this.gateway.delete(url, this.session.headers());
  }

  async joinPartyByCode(code: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/players/joinbycode/${encodeURIComponent(code)}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async kickFromParty(partyId: string, puuid: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(puuid)}`;
    return this.gateway.delete(url, this.session.headers());
  }

  async promotePartyMember(partyId: string, puuid: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(puuid)}/owner`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async setPartyReady(partyId: string, puuid: string, ready: boolean): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(puuid)}/setReady`;
    return this.gateway.post(url, { ready }, this.session.headers());
  }

  async setPartyQueue(partyId: string, queueId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/queue`;
    return this.gateway.post(url, { queueID: queueId }, this.session.headers());
  }

  async setPartyAccessibility(partyId: string, accessibility: "OPEN" | "CLOSED"): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/accessibility`;
    return this.gateway.post(url, { accessibility }, this.session.headers());
  }

  async startPartyMatchmaking(partyId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/matchmaking/join`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async stopPartyMatchmaking(partyId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/matchmaking/leave`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async leaveParty(puuid: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/players/${encodeURIComponent(puuid)}`;
    return this.gateway.delete(url, this.session.headers());
  }

  async joinParty(partyId: string, puuid = this.session.puuid): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/players/${encodeURIComponent(puuid)}/joinparty/${encodeURIComponent(partyId)}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async declinePartyInvite(partyId: string, inviteId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/invites/decline`;
    return this.gateway.post(url, { InviteID: inviteId }, this.session.headers());
  }

  async requestPartyJoin(partyId: string, puuid = this.session.puuid): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/request`;
    return this.gateway.post(url, { Subjects: [puuid] }, this.session.headers());
  }

  async declinePartyRequest(partyId: string, requestId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/request/${encodeURIComponent(requestId)}/decline`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async makePartyCustomGame(partyId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/makecustomgame`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async makePartyDefault(partyId: string, queue: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/makedefault?queueID=${encodeURIComponent(queue)}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async setPartyCustomGameSettings(partyId: string, settings: unknown): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/customgamesettings`;
    return this.gateway.post(url, settings, this.session.headers());
  }

  async setPartyCustomGameTeam(partyId: string, team: string, puuid: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/customgamemembership/${encodeURIComponent(team)}`;
    return this.gateway.post(url, { playerToPutOnTeam: puuid }, this.session.headers());
  }

  async startPartyCustomGame(partyId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/startcustomgame`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async balancePartyTeams(partyId: string): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/balance`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async setPreferredGamePods(partyId: string, gamePodIds: string[]): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/preferredgamepods`;
    return this.gateway.post(url, { GamePodIDs: gamePodIds }, this.session.headers());
  }

  async setPlayerModeratorStatus(
    partyId: string,
    puuid: string,
    isModerator: boolean,
  ): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/setplayermoderatorstatus`;
    return this.gateway.post(
      url,
      { Subject: puuid, IsModerator: isModerator },
      this.session.headers(),
    );
  }

  async refreshPartyPings(partyId: string, puuid = this.session.puuid): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(puuid)}/refreshPings`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async refreshPartyCompetitiveTier(partyId: string, puuid = this.session.puuid): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(puuid)}/refreshCompetitiveTier`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async refreshPartyPlayerIdentity(partyId: string, puuid = this.session.puuid): Promise<unknown> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(puuid)}/refreshPlayerIdentity`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async contracts(puuid = this.session.puuid): Promise<RiotContractsResponse> {
    return this.get(`${this.session.endpoints.pd}/contracts/v1/contracts/${puuid}`);
  }

  async activateContract(contractId: string): Promise<unknown> {
    const url = `${this.session.endpoints.pd}/contracts/v1/contracts/${this.session.puuid}/special/${contractId}`;
    return this.gateway.post(url, undefined, this.session.headers());
  }

  async penalties(): Promise<RiotPenaltiesResponse> {
    return this.get(`${this.session.endpoints.pd}/restrictions/v3/penalties`);
  }

  async favorites(puuid = this.session.puuid): Promise<RiotFavoritesResponse> {
    return this.get(`${this.session.endpoints.pd}/favorites/v1/players/${puuid}/favorites`);
  }

  async addFavorite(itemId: string): Promise<unknown> {
    const url = `${this.session.endpoints.pd}/favorites/v1/players/${this.session.puuid}/favorites`;
    return this.gateway.post(url, { ItemID: itemId }, this.session.headers());
  }

  async removeFavorite(itemIdWithoutDashes: string): Promise<unknown> {
    const url = `${this.session.endpoints.pd}/favorites/v1/players/${this.session.puuid}/favorites/${itemIdWithoutDashes}`;
    return this.gateway.delete(url, this.session.headers());
  }

  async setActRankBadgeHidden(hidden: boolean): Promise<unknown> {
    const url = `${this.session.endpoints.pd}/mmr/v1/players/${this.session.puuid}/hideactrankbadge`;
    return this.gateway.post(url, { HideActRankBadge: hidden }, this.session.headers());
  }

  async setLeaderboardAnonymized(seasonId: string, anonymized: boolean): Promise<unknown> {
    const url = `${this.session.endpoints.pd}/mmr/v1/leaderboards/affinity/${this.session.region}/queue/competitive/season/${seasonId}/subject/${this.session.puuid}/anonymize`;
    return this.gateway.post(url, { Anonymize: anonymized }, this.session.headers());
  }

  async gameSession(): Promise<RiotSessionResponse> {
    return this.gateway.get(
      `${this.session.endpoints.glz}/session/v1/sessions/${this.session.puuid}`,
      this.session.headers(),
    );
  }

  async clientConfig(region = this.session.region): Promise<RiotClientConfigResponse> {
    return this.gateway.get(
      `${this.session.endpoints.shared}/v1/config/${region}`,
      this.session.headers(),
    );
  }

  async offers(): Promise<RiotOffersResponse> {
    return this.get(`${this.session.endpoints.pd}/store/v1/offers/`);
  }

  async revealNightMarket(): Promise<unknown> {
    const url = `${this.session.endpoints.pd}/store/v2/storefront/${this.session.puuid}/nightmarket/offers`;
    return this.gateway.post(url, {}, this.session.headers());
  }

  async createOrder(body: unknown): Promise<RiotOrderResponse> {
    const url = `${this.session.endpoints.pd}/store/v1/order/`;
    return this.gateway.post(url, body, this.session.headers());
  }

  async createBundleOrder(bundleId: string, body: unknown): Promise<RiotOrderResponse> {
    const url = `${this.session.endpoints.pd}/store/v1/bundles/${bundleId}/order`;
    return this.gateway.post(url, body, this.session.headers());
  }

  async order(orderId: string): Promise<RiotOrderResponse> {
    return this.get(`${this.session.endpoints.pd}/store/v1/order/${orderId}`);
  }

  async content(): Promise<RiotContentResponse> {
    return this.gateway.get(
      `${this.session.endpoints.shared}/content-service/v3/content`,
      this.session.headers(),
    );
  }

  async queueConfigs(): Promise<RiotQueueConfigsResponse> {
    return this.gateway.get(
      `${this.session.endpoints.glz}/matchmaking/v1/queues/configs`,
      this.session.headers(),
    );
  }

  async customGameConfigs(): Promise<RiotCustomGameConfigsResponse> {
    return this.gateway.get(
      `${this.session.endpoints.glz}/parties/v1/parties/customgameconfigs`,
      this.session.headers(),
    );
  }

  async leaderboard(
    seasonId: string,
    startIndex = 0,
    size = 100,
    query = "",
  ): Promise<RiotLeaderboardResponse> {
    const cappedSize = Math.min(Math.max(size, 1), 510);
    const queryParam = query ? `&query=${encodeURIComponent(query)}` : "&query=";
    const url = `${this.session.endpoints.pd}/mmr/v1/leaderboards/affinity/${this.session.region}/queue/competitive/season/${seasonId}?startIndex=${startIndex}&size=${cappedSize}${queryParam}`;
    return this.get(url);
  }

  async premierPlayer(puuid = this.session.puuid): Promise<unknown> {
    return this.get(`${this.session.endpoints.pd}/premier/v2/players/${puuid}`);
  }

  async premierEligibility(): Promise<unknown> {
    return this.get(`${this.session.endpoints.pd}/premier/v1/player/eligibility`);
  }

  async premierActiveSeason(region = this.session.region): Promise<unknown> {
    return this.get(
      `${this.session.endpoints.pd}/premier/v1/affinities/${region}/premier-seasons/active`,
    );
  }

  async premierConferences(region = this.session.region): Promise<unknown> {
    return this.get(`${this.session.endpoints.pd}/premier/v1/affinities/${region}/conferences`);
  }
}
