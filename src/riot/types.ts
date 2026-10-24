export const ENTITLEMENT_ITEM_TYPES = {
  skinLevel: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
  skinChroma: "3ad1b2b2-acdb-4524-852f-954a76ddae0a",
  agent: "01bb38e1-da47-4e6a-9b3d-945fe4655707",
  contract: "f85cb6f7-33e5-4dc8-b609-ec7212301948",
  buddy: "dd3bf334-87f3-40bd-b043-682a57a8dc3a",
  spray: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
  flex: "03a572de-4234-31ed-d344-ababa488f981",
  playerCard: "3f296c07-64c3-494c-923b-fe692a4fa1bd",
  playerTitle: "de7caa6b-adf7-4588-bbd1-143831e786c6",
} as const;

export const CURRENCY_UUIDS = {
  valorantPoints: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
  radianite: "e59aa87c-4cbf-517a-5983-6e81511be9b7",
  kingdomCredits: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d",
} as const;

export interface RiotEntitlementItem {
  TypeID: string;
  ItemID: string;
  InstanceID?: string;
}

export interface RiotEntitlementsByType {
  ItemTypeID: string;
  Entitlements: RiotEntitlementItem[];
}

export interface RiotEntitlementsResponse {
  EntitlementsByTypes: RiotEntitlementsByType[];
}

export interface RiotLoadoutGun {
  ID: string;
  SkinID: string;
  SkinLevelID: string;
  ChromaID: string;
  CharmID?: string;
  CharmLevelID?: string;
  CharmInstanceID?: string;
  Attachments?: unknown[];
}

export interface RiotLoadoutSpray {
  EquipSlotID: string;
  SprayID: string;
  SprayLevelID?: string | null;
}

export interface RiotLoadoutIdentity {
  PlayerCardID: string;
  PlayerTitleID: string;
  AccountLevel: number;
  PreferredLevelBorderID?: string;
  HideAccountLevel: boolean;
}

export interface RiotActiveExpression {
  TypeID: string;
  AssetID: string;
}

export interface RiotLoadoutResponse {
  Subject?: string;
  Version?: number;
  Guns: RiotLoadoutGun[];
  ActiveExpressions?: RiotActiveExpression[];
  Sprays?: RiotLoadoutSpray[];
  Identity: RiotLoadoutIdentity;
  Incognito: boolean;
}

export interface RiotAccountXpSource {
  ID: "time-played" | "match-win" | "first-win-of-the-day" | string;
  Amount: number;
}

export interface RiotAccountXpHistoryItem {
  ID: string;
  MatchStart: string;
  StartProgress: { Level: number; XP: number };
  EndProgress: { Level: number; XP: number };
  XPDelta: number;
  XPSources?: RiotAccountXpSource[];
  XPMultipliers?: unknown[];
}

export interface RiotAccountXpResponse {
  Version?: number;
  Subject?: string;
  Progress: { Level: number; XP: number };
  History?: RiotAccountXpHistoryItem[];
  LastTimeGrantedFirstWin?: string;
  NextTimeFirstWinAvailable?: string;
}

export interface RiotWalletResponse {
  Balances: Record<string, number>;
}

export interface RiotNameResponse {
  Subject: string;
  GameName: string;
  TagLine: string;
}

export interface RiotStoreReward {
  ItemTypeID: string;
  ItemID: string;
  Quantity: number;
}

export interface RiotStoreOffer {
  OfferID: string;
  IsDirectPurchase?: boolean;
  StartDate?: string;
  Cost: Record<string, number>;
  Rewards: RiotStoreReward[];
}

export interface RiotSkinsPanelLayout {
  SingleItemOffers?: string[];
  SingleItemStoreOffers?: RiotStoreOffer[];
  SingleItemOffersRemainingDurationInSeconds?: number;
}

export interface RiotBonusStoreOffer {
  BonusOfferID: string;
  Offer: RiotStoreOffer;
  DiscountPercent: number;
  DiscountCosts: Record<string, number>;
  IsSeen: boolean;
}

export interface RiotBonusStore {
  BonusStoreOffers?: RiotBonusStoreOffer[];
  BonusStoreRemainingDurationInSeconds?: number;
}

export interface RiotBundleItem {
  Item: {
    ItemTypeID: string;
    ItemID: string;
    Amount: number;
  };
  BasePrice: number;
  CurrencyID: string;
  DiscountPercent: number;
  DiscountedPrice: number;
  IsPromoItem: boolean;
}

export interface RiotBundle {
  ID: string;
  DataAssetID: string;
  CurrencyID: string;
  Items: RiotBundleItem[];
  TotalBaseCost: Record<string, number> | null;
  TotalDiscountedCost: Record<string, number> | null;
  TotalDiscountPercent: number;
  DurationRemainingInSeconds: number;
  WholesaleOnly: boolean;
}

export interface RiotFeaturedBundle {
  Bundle?: RiotBundle;
  Bundles?: RiotBundle[];
  BundleRemainingDurationInSeconds?: number;
}

export interface RiotAccessoryStoreOffer {
  Offer: RiotStoreOffer;
  ContractID: string;
}

export interface RiotAccessoryStore {
  AccessoryStoreOffers?: RiotAccessoryStoreOffer[];
  AccessoryStoreRemainingDurationInSeconds?: number;
  StorefrontID?: string;
}

export interface RiotUpgradeCurrencyOffer {
  OfferID: string;
  StorefrontItemID: string;
  Offer: RiotStoreOffer;
  DiscountedPercent: number;
}

export interface RiotUpgradeCurrencyStore {
  UpgradeCurrencyOffers?: RiotUpgradeCurrencyOffer[];
}

export interface RiotStorefrontResponse {
  FeaturedBundle?: RiotFeaturedBundle;
  SkinsPanelLayout?: RiotSkinsPanelLayout;
  UpgradeCurrencyStore?: RiotUpgradeCurrencyStore;
  AccessoryStore?: RiotAccessoryStore;
  BonusStore?: RiotBonusStore;
}

export interface RiotMatchHistoryItem {
  MatchID: string;
  GameStartTime: number;
  QueueID: string;
}

export interface RiotMatchHistoryResponse {
  Subject: string;
  BeginIndex: number;
  EndIndex: number;
  Total: number;
  History: RiotMatchHistoryItem[];
}

export interface RiotMatchInfo {
  matchId: string;
  mapId: string;
  gamePodId?: string;
  gameLoopZone?: string;
  gameServerAddress?: string;
  gameVersion?: string;
  gameLengthMillis: number;
  gameStartMillis: number;
  provisioningFlowID?: string;
  isCompleted: boolean;
  customGameName?: string | null;
  queueID: string;
  gameMode?: string;
  isRanked: boolean;
  seasonId?: string;
  completionState?: string;
  isReplayRecorded?: boolean;
}

export interface RiotPlayerAbilityCasts {
  grenadeCasts?: number;
  ability1Casts?: number;
  ability2Casts?: number;
  ultimateCasts?: number;
}

export interface RiotPlayerStats {
  score: number;
  roundsPlayed: number;
  kills: number;
  deaths: number;
  assists: number;
  playtimeMillis?: number;
  abilityCasts?: RiotPlayerAbilityCasts;
}

export interface RiotMatchPlayer {
  subject: string;
  gameName: string;
  tagLine: string;
  teamId: string;
  partyId?: string;
  characterId: string;
  stats?: RiotPlayerStats | null;
  competitiveTier?: number;
  playerCard?: string;
  playerTitle?: string;
  accountLevel?: number;
}

export interface RiotMatchTeam {
  teamId: string;
  won: boolean;
  roundsPlayed: number;
  roundsWon: number;
  numPoints?: number;
}

export interface RiotFinishingDamage {
  damageType: string;
  damageItem: string;
  isSecondaryFireMode?: boolean;
}

export interface RiotKill {
  gameTime?: number;
  roundTime: number;
  killer: string;
  victim: string;
  victimLocation?: { x: number; y: number } | null;
  assistants?: string[];
  finishingDamage?: RiotFinishingDamage;
}

export interface RiotDamage {
  receiver: string;
  damage: number;
  legshots: number;
  bodyshots: number;
  headshots: number;
}

export interface RiotRoundPlayerStats {
  subject: string;
  kills?: RiotKill[];
  damage?: RiotDamage[];
  score?: number;
}

export interface RiotRoundResult {
  roundNum: number;
  roundResult: string;
  roundCeremony?: string | null;
  winningTeam: string;
  bombPlanter?: string | null;
  bombDefuser?: string | null;
  plantRoundTime?: number | null;
  plantSite?: string | null;
  defuseRoundTime?: number | null;
  playerStats?: RiotRoundPlayerStats[];
}

export interface RiotMatchDetailsResponse {
  matchInfo: RiotMatchInfo;
  players: RiotMatchPlayer[];
  teams: RiotMatchTeam[] | null;
  roundResults?: RiotRoundResult[] | null;
}

export interface RiotSeasonalInfo {
  SeasonID?: string;
  NumberOfWins?: number;
  NumberOfWinsWithPlacements?: number;
  NumberOfGames?: number;
  Rank?: number;
  CapstoneWins?: number;
  LeaderboardRank?: number;
  CompetitiveTier?: number;
  RankedRating?: number;
  WinsByTier?: Record<string, number> | null;
  GamesNeededForRating?: number;
  TotalWinsNeededForRank?: number;
}

export interface RiotCompetitiveUpdate {
  MatchID: string;
  MapID: string;
  SeasonID: string;
  MatchStartTime: number;
  TierAfterUpdate: number;
  TierBeforeUpdate: number;
  RankedRatingAfterUpdate: number;
  RankedRatingBeforeUpdate: number;
  RankedRatingEarned: number;
  RankedRatingPerformanceBonus: number;
  CompetitiveMovement: string;
  AFKPenalty: number;
}

export interface RiotQueueSkills {
  TotalGamesNeededForRating?: number;
  TotalGamesNeededForLeaderboard?: number;
  CurrentSeasonGamesNeededForRating?: number;
  SeasonalInfoBySeasonID?: Record<string, RiotSeasonalInfo>;
}

export interface RiotMmrResponse {
  Subject?: string;
  Version?: number;
  QueueSkills?: {
    competitive?: RiotQueueSkills;
    [queue: string]: unknown;
  };
  LatestCompetitiveUpdate?: RiotCompetitiveUpdate | null;
  IsLeaderboardAnonymized?: boolean;
  IsActRankBadgeHidden?: boolean;
}

export interface RiotCompetitiveUpdatesResponse {
  Matches: RiotCompetitiveUpdate[];
}

export interface RiotPregamePlayerResponse {
  Subject: string;
  MatchID: string;
  Version: number;
}

export interface RiotPregamePlayer {
  Subject: string;
  CharacterID: string;
  CharacterSelectionState: string;
  PregamePlayerState?: string;
  CompetitiveTier?: number;
  PlayerIdentity?: {
    Subject?: string;
    PlayerCardID?: string;
    PlayerTitleID?: string;
    AccountLevel?: number;
    Incognito?: boolean;
    HideAccountLevel?: boolean;
  };
}

export interface RiotPregameMatchResponse {
  ID: string;
  AllyTeam?: {
    TeamID: string;
    Players: RiotPregamePlayer[];
  };
  EnemyTeam?: {
    TeamID: string;
    Players: RiotPregamePlayer[];
  } | null;
  EnemyTeamSize?: number;
  EnemyTeamLockCount?: number;
  MapID?: string;
  QueueID?: string;
  Mode?: string;
  IsRanked?: boolean;
  PhaseTimeRemainingNS?: number;
  ProvisioningFlowID?: string;
}

export interface RiotCoreGamePlayerResponse {
  Subject: string;
  MatchID: string;
  Version: number;
}

export interface RiotCoreGamePlayer {
  Subject: string;
  TeamID?: string;
  CharacterID: string;
  PlayerIdentity?: {
    PlayerCardID?: string;
    PlayerTitleID?: string;
    AccountLevel?: number;
    Incognito?: boolean;
    HideAccountLevel?: boolean;
  };
}

export interface RiotCoreGameMatchResponse {
  MatchID: string;
  State?: string;
  MapID?: string;
  ModeID?: string;
  ProvisioningFlow?: string;
  Players: RiotCoreGamePlayer[];
  MatchmakingData?: {
    QueueID?: string;
    IsRanked?: boolean;
  } | null;
}

export interface RiotCoreGameSocketItem {
  ID: string;
  Item?: {
    ID: string;
    TypeID?: string;
  };
}

export interface RiotCoreGameLoadoutItem {
  ID: string;
  TypeID?: string;
  Sockets?: Record<string, RiotCoreGameSocketItem>;
}

export interface RiotCoreGameLoadoutEntry {
  CharacterID?: string;
  Loadout: {
    Subject: string;
    Items: Record<string, RiotCoreGameLoadoutItem>;
  };
}

export interface RiotCoreGameLoadoutsResponse {
  Loadouts: RiotCoreGameLoadoutEntry[];
}

export interface RiotPartyPlayerInvite {
  ID: string;
  PartyID: string;
  RequestedBy?: string;
  CreatedAt?: string;
  [key: string]: unknown;
}

export interface RiotPartyPlayerResponse {
  Subject: string;
  Version?: number;
  CurrentPartyID: string;
  Invites?: RiotPartyPlayerInvite[] | null;
  Requests?: unknown[] | null;
  PlatformInfo?: unknown;
  PingMap?: Record<string, number>;
  [key: string]: unknown;
}

export interface RiotPartyMember {
  Subject: string;
  CompetitiveTier?: number;
  PlayerIdentity?: {
    PlayerCardID?: string;
    PlayerTitleID?: string;
    AccountLevel?: number;
    Incognito?: boolean;
  };
  IsOwner?: boolean;
  IsReady?: boolean;
  IsModerator?: boolean;
}

export interface RiotPartyRequestItem {
  ID: string;
  RequestedBy?: string;
  CreatedAt?: string;
  [key: string]: unknown;
}

export interface RiotPartyCustomGameMembership {
  TeamOne?: Array<{ Subject: string }>;
  TeamTwo?: Array<{ Subject: string }>;
  TeamSpectate?: Array<{ Subject: string }>;
  TeamOneCoaches?: Array<{ Subject: string }>;
  TeamTwoCoaches?: Array<{ Subject: string }>;
}

export interface RiotPartyCustomGameData {
  Settings?: {
    Map?: string;
    Mode?: string;
    UseBots?: boolean;
    GamePod?: string;
    GameRules?: Record<string, string>;
  };
  Membership?: RiotPartyCustomGameMembership;
}

export interface RiotPartyResponse {
  ID: string;
  State: string;
  Accessibility: "OPEN" | "CLOSED" | string;
  MatchmakingData?: {
    QueueID?: string;
  } | null;
  EligibleQueues?: string[];
  QueueIneligibilities?: unknown[];
  InviteCode?: string | null;
  Invites?: unknown[] | null;
  Requests?: RiotPartyRequestItem[] | null;
  CustomGameData?: RiotPartyCustomGameData | null;
  RestrictedSeconds?: number;
  QueueEntryTime?: string | null;
  Members: RiotPartyMember[];
}

export interface RiotContractItem {
  ContractDefinitionID: string;
  ContractProgression?: {
    TotalProgressionEarned?: number;
    TotalProgressionEarnedVersion?: number;
    HighestRewardedLevel?: Record<string, { Amount: number; Version: number }>;
  };
  ProgressionLevelReached: number;
  ProgressionTowardsNextLevel: number;
}

export interface RiotMissionItem {
  ID: string;
  Objectives: Record<string, number>;
  Complete: boolean;
  ExpirationTime: string;
}

export interface RiotContractsResponse {
  Version?: number;
  Subject?: string;
  Contracts: RiotContractItem[];
  ProcessedMatches?: unknown[];
  ActiveSpecialContract: string | null;
  Missions: RiotMissionItem[];
  MissionMetadata?: {
    NPECompleted?: boolean;
    WeeklyCheckpoint?: string;
    WeeklyRefillTime?: string;
  };
}

export interface RiotDailyTicketMilestone {
  Progress: number;
  BonusApplied: boolean;
}

export interface RiotDailyTicketResponse {
  Version?: number;
  DailyRewards: {
    RemainingLifetimeSeconds: number;
    BonusMilestonesPending: number;
    Milestones: RiotDailyTicketMilestone[];
  };
  ProcessedMatches?: unknown[];
}

export interface RiotPenaltyItem {
  ID: string;
  Expiry: string;
  Reason: string;
}

export interface RiotPenaltiesResponse {
  Subject?: string;
  Penalties: RiotPenaltyItem[];
  Version?: number;
}

export interface RiotFavoriteItem {
  FavoriteID: string;
  ItemID: string;
}

export interface RiotFavoritesResponse {
  Subject?: string;
  FavoritedContent: Record<string, RiotFavoriteItem>;
}

export interface RiotLeaderboardPlayer {
  PlayerCardID?: string;
  TitleID?: string;
  IsBanned: boolean;
  IsAnonymized: boolean;
  puuid: string;
  gameName: string;
  tagLine: string;
  leaderboardRank: number;
  rankedRating: number;
  numberOfWins: number;
  competitiveTier: number;
}

export interface RiotTierDetail {
  rankedRatingThreshold: number;
  startingPage: number;
  startingIndex: number;
}

export interface RiotLeaderboardResponse {
  Deployment?: string;
  QueueID: string;
  SeasonID: string;
  Players: RiotLeaderboardPlayer[];
  totalPlayers: number;
  immortalStartingPage?: number;
  immortalStartingIndex?: number;
  topTierRRThreshold?: number;
  tierDetails?: Record<string, RiotTierDetail>;
  startIndex: number;
  query: string;
}

export interface RiotOffersResponse {
  Offers: RiotStoreOffer[];
  UpgradeCurrencyOffers?: unknown[];
}

export interface RiotOrderResponse {
  ID?: string;
  id?: string;
  Status?: string;
  status?: string;
  ItemTypeID?: string;
  ItemID?: string;
  BundleID?: string;
  Cost?: Record<string, number>;
  CurrencyID?: string;
  CurrencyCost?: number;
  TotalCost?: Record<string, number>;
}

export interface RiotSessionResponse {
  subject: string;
  cxnState?: string;
  clientID?: string;
  clientVersion: string;
  loopState: "MENUS" | "PREGAME" | "INGAME" | string;
  loopStateMetadata?: unknown;
  version?: number;
  lastHeartbeatTime?: string;
  expiredTime?: string;
  heartbeatIntervalMillis?: number;
  playtimeNotification?: unknown;
  playtimeMinutes: number;
  isRestricted: boolean;
  userinfoValidTime?: string;
  restrictionType?: string;
  clientPlatformInfo?: unknown;
}

export interface RiotClientConfigResponse {
  Collapsed?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RiotContentSeason {
  ID: string;
  Name: string;
  Type: "act" | "episode" | string;
  StartTime: string;
  EndTime: string;
  IsActive: boolean;
}

export interface RiotContentEvent {
  ID: string;
  Name: string;
  StartTime: string;
  EndTime: string;
  IsActive: boolean;
}

export interface RiotContentResponse {
  DisabledIDs?: string[];
  Seasons: RiotContentSeason[];
  Events: RiotContentEvent[];
}

export interface RiotQueueConfigItem {
  QueueID: string;
  Enabled: boolean;
  TeamSize: number;
  NumTeams: number;
  MaxPartySize: number;
  MinPartySize: number;
  Mode: string;
  IsRanked: boolean;
  RequireRoster?: boolean;
}

export interface RiotQueueConfigsResponse {
  Queues: RiotQueueConfigItem[];
}

export interface RiotCustomGameConfigsResponse {
  Enabled: boolean;
  EnabledMaps: string[];
  EnabledModes: string[];
  Queues: string[];
  GamePodPingServiceInfo: unknown;
}
