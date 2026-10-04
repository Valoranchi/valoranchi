import type {
  AccountXp,
  BlockedPlayer,
  CatalogSkin,
  ClientInfo,
  CollectionValue,
  Content,
  ContractProgress,
  Conversation,
  CustomGameConfigs,
  CustomGameSettings,
  Favourite,
  Friend,
  FriendRequest,
  GameSession,
  Leaderboard,
  LiveMatch,
  Loadout,
  LoadoutDiff,
  Match,
  MatchSummary,
  MatchSyncResult,
  Message,
  Mission,
  Mmr,
  OfficialAccount,
  OfficialProfile,
  Offer,
  Order,
  OwnedItems,
  Participant,
  Party,
  PartyInvite,
  PartyRequest,
  Penalty,
  PerformanceSummary,
  Player,
  PlayerAssessment,
  PlayerSettings,
  Premier,
  QueueConfig,
  RankChange,
  RatingTrend,
  Store,
  StoreHistory,
  StoreSeen,
  Wallet,
  Wishlist,
  WishlistCheck,
} from "../model/index.js";
import type { OfficialPlatformData } from "../official/types.js";
import type { RiotLoadoutResponse } from "../riot/types.js";
import type { LoadoutChange } from "./LoadoutValidator.js";
import type { PartyActionRequest } from "./PartyValidator.js";
import type { BuyTarget, BuyValidationResult } from "./StoreValidator.js";

export interface AccountApi {
  whoami(): Promise<Player>;
  ownedItems(options?: { language?: string }): Promise<OwnedItems>;
  loadout(): Promise<Loadout>;
  equip(change: LoadoutChange): Promise<Loadout>;
  validateEquip(change: LoadoutChange): Promise<RiotLoadoutResponse>;
  equipCollection(skinUuids: string[]): Promise<Loadout>;
  validateEquipCollection(skinUuids: string[]): Promise<RiotLoadoutResponse>;
  diffLoadout(target: LoadoutChange | Loadout): Promise<LoadoutDiff>;
  equipPreset(preset: LoadoutChange): Promise<Loadout>;
  validateEquipPreset(preset: LoadoutChange): Promise<RiotLoadoutResponse>;
  exportLoadout(): Promise<LoadoutChange>;
  collectionValue(): Promise<CollectionValue>;
  wallet(): Promise<Wallet>;
  xp(): Promise<AccountXp>;
  contracts(): Promise<ContractProgress[]>;
  missions(): Promise<Mission[]>;
  activateContract(uuid: string): Promise<ContractProgress[]>;
  validateActivateContract(uuid: string): Promise<{ contractId: string }>;
  penalties(): Promise<Penalty[]>;
  favourites(): Promise<Favourite[]>;
  addFavourite(skin: string): Promise<Favourite[]>;
  validateAddFavourite(skin: string): Promise<{ ItemID: string }>;
  removeFavourite(skin: string): Promise<Favourite[]>;
  validateRemoveFavourite(skin: string): Promise<{ itemIdWithoutDashes: string }>;
  setActRankBadgeHidden(hidden: boolean): Promise<boolean>;
  validateSetActRankBadgeHidden(hidden: boolean): Promise<{ HideActRankBadge: boolean }>;
  setLeaderboardAnonymized(anonymized: boolean): Promise<boolean>;
  validateSetLeaderboardAnonymized(
    anonymized: boolean,
  ): Promise<{ seasonId: string; Anonymize: boolean }>;
  session(): Promise<GameSession>;
  config(): Promise<Record<string, unknown>>;
  settings(): Promise<PlayerSettings>;
  validateSaveSettings(
    data: unknown,
    options?: { confirm?: boolean },
  ): Promise<{ type: string; data: Record<string, unknown> }>;
  saveSettings(data: unknown, options?: { confirm?: boolean }): Promise<PlayerSettings>;
  client(): Promise<ClientInfo>;
}

export interface SocialApi {
  friends(): Promise<Friend[]>;
  friendRequests(): Promise<FriendRequest[]>;
  blocked(): Promise<BlockedPlayer[]>;
  conversations(): Promise<Conversation[]>;
  messages(conversationId?: string): Promise<Message[]>;
  sendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<Message>;
  validateSendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<{ cid: string; message: string; type: "chat" | "groupchat" }>;
  sendFriendRequest(riotId: string): Promise<FriendRequest[]>;
  validateSendFriendRequest(riotId: string): Promise<{ game_name: string; game_tag: string }>;
  acceptFriendRequest(puuid: string): Promise<Friend[]>;
  validateAcceptFriendRequest(puuid: string): Promise<{ game_name: string; game_tag: string }>;
  declineFriendRequest(puuid: string): Promise<FriendRequest[]>;
  validateDeclineFriendRequest(puuid: string): Promise<{ puuid: string }>;
  cancelFriendRequest(puuid: string): Promise<FriendRequest[]>;
  validateCancelFriendRequest(puuid: string): Promise<{ puuid: string }>;
  removeFriend(puuid: string): Promise<Friend[]>;
  validateRemoveFriend(puuid: string): Promise<{ puuid: string }>;
  blockPlayer(target: string): Promise<BlockedPlayer[]>;
  validateBlockPlayer(target: string): Promise<{ puuid: string }>;
  unblockPlayer(puuid: string): Promise<BlockedPlayer[]>;
  validateUnblockPlayer(puuid: string): Promise<{ puuid: string }>;
  participants(cid?: string): Promise<Participant[]>;
}

export interface StoreApi {
  current(options?: { language?: string }): Promise<Store>;
  offers(): Promise<Offer[]>;
  revealNightMarket(): Promise<Store>;
  validateRevealNightMarket(): Promise<{ url: string }>;
  buy(target: BuyTarget, options?: { confirm?: boolean }): Promise<Order>;
  validateBuy(target: BuyTarget, options?: { confirm?: boolean }): Promise<BuyValidationResult>;
  order(id: string): Promise<Order>;
  history(options?: { days?: number }): Promise<StoreHistory>;
  seen(skin: string): Promise<StoreSeen>;
  wishlist(): Promise<Wishlist>;
  wishlistAdd(skin: string): Promise<Wishlist>;
  wishlistRemove(skin: string): Promise<Wishlist>;
  wishlistCheck(): Promise<WishlistCheck>;
  skins(): Promise<CatalogSkin[]>;
}

export interface MatchesApi {
  list(options?: { count?: number; queue?: string }): Promise<MatchSummary[]>;
  sync(options?: { maxPages?: number }): Promise<MatchSyncResult>;
  known(puuid?: string): Promise<MatchSummary[]>;
  get(id: string): Promise<Match>;
  mmr(): Promise<Mmr>;
  rankHistory(options?: { count?: number }): Promise<RankChange[]>;
  live(options?: { ranks?: boolean; loadouts?: boolean }): Promise<LiveMatch>;
  listFor(puuid: string, options?: { count?: number; queue?: string }): Promise<MatchSummary[]>;
  mmrFor(puuid: string): Promise<Mmr>;
  rankHistoryFor(puuid: string, options?: { count?: number }): Promise<RankChange[]>;
  leaderboard(options?: {
    season?: string;
    start?: number;
    size?: number;
    query?: string;
  }): Promise<Leaderboard>;
  content(): Promise<Content>;
  premier(): Promise<Premier>;
  selectAgent(agent: string): Promise<LiveMatch>;
  validateSelectAgent(
    agent: string,
  ): Promise<{ method: string; path: string; matchId: string; agentUuid: string }>;
  lockAgent(agent: string): Promise<LiveMatch>;
  validateLockAgent(
    agent: string,
  ): Promise<{ method: string; path: string; matchId: string; agentUuid: string }>;
  dodge(options?: { confirm?: boolean }): Promise<{ dodged: boolean; matchId: string }>;
  validateDodge(options?: {
    confirm?: boolean;
  }): Promise<{ method: string; path: string; matchId: string }>;
  leaveMatch(options?: { confirm?: boolean }): Promise<{ left: boolean; matchId: string }>;
  validateLeaveMatch(options?: {
    confirm?: boolean;
  }): Promise<{ method: string; path: string; matchId: string; puuid: string }>;
  trend(options?: { count?: number; puuid?: string }): Promise<RatingTrend>;
  summary(options?: {
    count?: number;
    queue?: string;
    puuid?: string;
    onProgress?: (done: number, total: number) => void;
  }): Promise<PerformanceSummary>;
  assess(puuid?: string): Promise<PlayerAssessment>;
}

export interface PartyApi {
  current(): Promise<Party>;
  invite(riotId: string): Promise<Party>;
  validateInvite(riotId: string): Promise<PartyActionRequest>;
  kick(puuid: string): Promise<Party>;
  validateKick(puuid: string): Promise<PartyActionRequest>;
  promote(puuid: string): Promise<Party>;
  validatePromote(puuid: string): Promise<PartyActionRequest>;
  createInviteCode(): Promise<Party>;
  validateCreateInviteCode(): Promise<PartyActionRequest>;
  revokeInviteCode(): Promise<Party>;
  validateRevokeInviteCode(): Promise<PartyActionRequest>;
  joinByCode(code: string): Promise<Party>;
  validateJoinByCode(code: string): Promise<PartyActionRequest>;
  setReady(ready: boolean): Promise<Party>;
  validateSetReady(ready: boolean): Promise<PartyActionRequest>;
  setQueue(queue: string): Promise<Party>;
  validateSetQueue(queue: string): Promise<PartyActionRequest>;
  setAccessibility(accessibility: "open" | "closed"): Promise<Party>;
  validateSetAccessibility(accessibility: "open" | "closed"): Promise<PartyActionRequest>;
  startMatchmaking(): Promise<Party>;
  validateStartMatchmaking(): Promise<PartyActionRequest>;
  stopMatchmaking(): Promise<Party>;
  validateStopMatchmaking(): Promise<PartyActionRequest>;
  leave(): Promise<Party>;
  validateLeave(): Promise<PartyActionRequest>;
  queues(): Promise<QueueConfig[]>;
  customGameConfigs(): Promise<CustomGameConfigs>;
  join(partyId: string): Promise<Party>;
  validateJoin(partyId: string): Promise<{ partyId: string }>;
  declineInvite(inviteId: string): Promise<{ declined: boolean; inviteId: string }>;
  validateDeclineInvite(inviteId: string): Promise<{ partyId: string; inviteId: string }>;
  requestToJoin(partyId: string): Promise<{ requested: boolean; partyId: string }>;
  validateRequestToJoin(partyId: string): Promise<{ method: string; path: string; body: unknown }>;
  declineRequest(requestId: string): Promise<{ declined: boolean; requestId: string }>;
  validateDeclineRequest(requestId: string): Promise<{ partyId: string; requestId: string }>;
  invites(): Promise<PartyInvite[]>;
  requests(): Promise<PartyRequest[]>;
  makeCustomGame(): Promise<Party>;
  validateMakeCustomGame(): Promise<{ partyId: string }>;
  makeDefault(queue: string): Promise<Party>;
  validateMakeDefault(queue: string): Promise<{ partyId: string; queue: string }>;
  setCustomGameSettings(settings: CustomGameSettings): Promise<Party>;
  validateSetCustomGameSettings(settings: CustomGameSettings): Promise<Record<string, unknown>>;
  setTeam(puuid: string, team: string): Promise<Party>;
  validateSetTeam(
    puuid: string,
    team: string,
  ): Promise<{ partyId: string; team: string; puuid: string }>;
  startCustomGame(): Promise<Party>;
  validateStartCustomGame(): Promise<{ partyId: string }>;
  balanceTeams(): Promise<Party>;
  validateBalanceTeams(): Promise<{ partyId: string }>;
  setPreferredServers(ids: string[]): Promise<Party>;
  validateSetPreferredServers(ids: string[]): Promise<{ partyId: string; gamePodIds: string[] }>;
  setModerator(puuid: string, isModerator: boolean): Promise<Party>;
  validateSetModerator(
    puuid: string,
    isModerator: boolean,
  ): Promise<{ partyId: string; puuid: string; isModerator: boolean }>;
  refresh(): Promise<Party>;
  validateRefresh(): Promise<{ method: string; paths: string[] }>;
}

export interface LocalRawApi {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string, body?: unknown): Promise<T>;
}

export interface RiotRawApi {
  get<T = unknown>(
    url: string,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T>;
  post<T = unknown>(
    url: string,
    body?: unknown,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T>;
  put<T = unknown>(
    url: string,
    body?: unknown,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T>;
  delete<T = unknown>(
    url: string,
    options?: { headers?: Record<string, string> } | Record<string, string>,
  ): Promise<T>;
}

export interface OfficialApi {
  account(riotId: string): Promise<OfficialAccount>;
  matches(riotId: string, options?: { queue?: string; count?: number }): Promise<MatchSummary[]>;
  match(matchId: string, options: { shard: string; self?: string }): Promise<Match>;
  leaderboard(options: {
    shard: string;
    act?: string;
    start?: number;
    size?: number;
  }): Promise<Leaderboard>;
  status(shard: string): Promise<OfficialPlatformData>;
  summary(
    riotId: string,
    options?: { queue?: string; count?: number },
  ): Promise<PerformanceSummary>;
  profile(riotId: string, options?: { count?: number }): Promise<OfficialProfile>;
}
