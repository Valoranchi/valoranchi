export type Player = {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  shard: string;
  accountLevel: number;
};

export type Image = string | null;

export type Tier = {
  uuid: string;
  name: string;
  rank: number;
  icon: Image;
};

export type OwnedSkinLevel = {
  uuid: string;
  name: string;
  owned: boolean;
};

export type OwnedChroma = {
  uuid: string;
  name: string;
  owned: boolean;
  swatch: Image;
};

export type OwnedSkin = {
  uuid: string;
  name: string;
  tier: Tier | null;
  icon: Image;
  levels: OwnedSkinLevel[];
  chromas: OwnedChroma[];
};

export type OwnedWeapon = {
  uuid: string;
  name: string;
  category: string;
  skinsOwned: number;
  skinsTotal: number;
  skins: OwnedSkin[];
};

export type OwnedCard = {
  uuid: string;
  name: string;
  small: Image;
  wide: Image;
  large: Image;
};

export type OwnedTitle = {
  uuid: string;
  name: string;
  text: string | null;
};

export type OwnedSpray = {
  uuid: string;
  name: string;
  icon: Image;
};

export type OwnedBuddy = {
  uuid: string;
  name: string;
  icon: Image;
  instances: number;
};

export type OwnedAgent = {
  uuid: string;
  name: string;
  role: string | null;
  icon: Image;
};

export type OwnedItems = {
  player: Player;
  language: string;
  generatedAt: string;
  weapons: OwnedWeapon[];
  cards: OwnedCard[];
  titles: OwnedTitle[];
  sprays: OwnedSpray[];
  buddies: OwnedBuddy[];
  agents: OwnedAgent[];
};

export type LoadoutGun = {
  weapon: { uuid: string; name: string };
  skin: { uuid: string; name: string; icon: Image };
  level: { uuid: string; name: string };
  chroma: { uuid: string; name: string };
  buddy: { uuid: string; name: string; icon: Image } | null;
};

export type Loadout = {
  player: Player;
  guns: LoadoutGun[];
  sprays: Array<{ slot: string; uuid: string; name: string; icon: Image }>;
  flex: { uuid: string; name: string; icon: Image } | null;
  card: OwnedCard | null;
  title: OwnedTitle | null;
  incognito: boolean;
};

export type Wallet = {
  valorantPoints: number;
  radianite: number;
  kingdomCredits: number;
};

export type PresenceState = "online" | "away" | "busy" | "mobile" | "offline";

export type ValorantPresence = {
  state: "menus" | "pregame" | "ingame" | null;
  queue: string | null;
  map: { path: string; name: string | null } | null;
  party: { id: string | null; size: number | null; max: number | null; owner: boolean | null };
  competitiveTier: number | null;
  leaderboardPosition: number | null;
  accountLevel: number | null;
  card: { uuid: string; name: string; small: Image } | null;
  title: { uuid: string; name: string; text: string | null } | null;
  score: { ally: number; enemy: number } | null;
};

export type Friend = {
  puuid: string;
  gameName: string;
  tagLine: string;
  note: string | null;
  group: string;
  region: string;
  lastOnline: string | null;
  presence: {
    state: PresenceState;
    product: string | null;
    since: string | null;
    valorant: ValorantPresence | null;
  };
};

export type FriendRequest = {
  puuid: string;
  gameName: string;
  tagLine: string;
  direction: "incoming" | "outgoing";
};

export type BlockedPlayer = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type Conversation = {
  id: string;
  kind: "whisper" | "party" | "pregame" | "team" | "all";
  unread: number;
  muted: boolean;
  with: { puuid: string; gameName: string; tagLine: string } | null;
};

export type Message = {
  id: string;
  conversationId: string;
  from: { puuid: string; gameName: string; tagLine: string };
  body: string;
  at: string;
  read: boolean;
  kind: "whisper" | "room";
};

export type Cost = {
  currency: string;
  currencyUuid: string;
  amount: number;
};

export type StoreItem =
  | {
      kind: "skin";
      uuid: string;
      name: string;
      weapon: string;
      tier: Tier | null;
      icon: Image;
      levelUuid: string;
    }
  | {
      kind: "buddy" | "spray" | "card" | "title" | "agent" | "flex";
      uuid: string;
      name: string;
      icon: Image;
    }
  | { kind: "currency"; uuid: string; name: string; amount: number }
  | { kind: "other"; uuid: string; typeUuid: string; name: null };

export type CatalogSkin = {
  uuid: string;
  name: string;
  weapon: string;
  icon: Image;
  tier: Tier | null;
};

export type DailyOffer = {
  offerId: string;
  item: StoreItem;
  cost: Cost;
};

export type NightMarketOffer = {
  offerId: string;
  item: StoreItem;
  cost: Cost;
  discountedCost: Cost;
  discountPercent: number;
  seen: boolean;
};

export type BundleItem = {
  item: StoreItem;
  amount: number;
  basePrice: number;
  discountedPrice: number;
  discountPercent: number;
  promo: boolean;
};

export type Bundle = {
  uuid: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  icon: Image;
  promoImage: Image;
  currency: string;
  totalBase: number | null;
  totalDiscounted: number | null;
  discountPercent: number;
  wholesaleOnly: boolean;
  endsAt: string | null;
  items: BundleItem[];
};

export type AccessoryOffer = {
  offerId: string;
  item: StoreItem;
  cost: Cost;
  contractUuid: string;
};

export type RadianiteOffer = {
  offerId: string;
  amount: number;
  cost: Cost;
  discountPercent: number;
};

export type Store = {
  player: Player;
  fetchedAt: string;
  daily: { endsAt: string; offers: DailyOffer[] } | null;
  nightMarket: { endsAt: string; offers: NightMarketOffer[] } | null;
  bundles: { endsAt: string | null; items: Bundle[] } | null;
  accessories: { endsAt: string; offers: AccessoryOffer[] } | null;
  radianite: RadianiteOffer[];
};

export type Agent = { uuid: string; name: string; icon: Image; role: string | null } | null;

export type RankMovement = "promoted" | "demoted" | "up" | "down" | "same";

export type Rank = {
  tier: number;
  name: string;
  division: string | null;
  icon: Image;
  rating: number | null;
};

export type MatchSummary = {
  id: string;
  startedAt: string;
  queue: string;
  map: { uuid: string | null; name: string | null; path: string };
};

export type MatchPlayer = {
  puuid: string;
  gameName: string;
  tagLine: string;
  team: "Blue" | "Red" | string;
  partyId: string | null;
  agent: Agent;
  rank: Rank | null;
  accountLevel: number;
  card: OwnedCard | null;
  title: OwnedTitle | null;
  stats: {
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    roundsPlayed: number;
    headshots: number;
    bodyshots: number;
    legshots: number;
    damage: number;
    firstBloods: number;
    plants: number;
    defuses: number;
    abilityCasts: { c: number; q: number; e: number; x: number };
  } | null;
};

export type MatchRound = {
  number: number;
  winner: string;
  result: string;
  ceremony: string | null;
  site: string | null;
  planter: string | null;
  defuser: string | null;
  plantedAt: number | null;
  defusedAt: number | null;
  kills: Array<{
    at: number;
    roundTime: number;
    killer: string;
    victim: string;
    assistants: string[];
    weapon: { uuid: string; name: string | null; kind: string };
    location: { x: number; y: number } | null;
  }>;
};

export type Match = {
  id: string;
  startedAt: string;
  lengthMs: number;
  completed: boolean;
  queue: string;
  ranked: boolean;
  custom: boolean;
  customName: string | null;
  map: { uuid: string | null; name: string | null; path: string };
  mode: string;
  season: { uuid: string; name: string | null };
  teams: Array<{ id: string; won: boolean; roundsWon: number; roundsPlayed: number }>;
  players: MatchPlayer[];
  rounds: MatchRound[];
  self: { team: string; won: boolean | null } | null;
  replayRecorded: boolean;
};

export type RankFit = {
  verdict: "above" | "fit" | "below" | null;
  ranksAbove: -1 | 0 | 1 | 2;
  expected: Rank | null;
  averageGain: number | null;
  averageLoss: number | null;
  sample: number;
};

export type Mmr = {
  current: Rank | null;
  fit: RankFit;
  peak: (Rank & { act: { uuid: string; name: string | null } }) | null;
  act: {
    uuid: string;
    name: string | null;
    games: number;
    wins: number;
    gamesNeededForRating: number;
  } | null;
  lastUpdate: {
    matchId: string;
    at: string;
    before: Rank | null;
    after: Rank | null;
    earned: number;
    movement: RankMovement;
  } | null;
  leaderboardAnonymized: boolean;
};

export type RankChange = {
  matchId: string;
  at: string;
  map: { name: string | null; path: string };
  before: Rank;
  after: Rank;
  earned: number;
  bonus: number;
  movement: RankMovement;
  afkPenalty: number;
};

export type LiveMatchPlayer = {
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
  incognito: boolean;
  team: string;
  agent: Agent;
  selection: "none" | "selected" | "locked" | null;
  accountLevel: number | null;
  card: OwnedCard | null;
  title: OwnedTitle | null;
  rank: Rank | null;
  partyId: string | null;
  loadout: Array<{
    weapon: { uuid: string; name: string | null };
    skin: { uuid: string; name: string | null; icon: Image } | null;
    buddy: { uuid: string; name: string | null; icon: Image } | null;
  }> | null;
  warnings: string[];
};

export type LiveMatch =
  | { phase: "none" }
  | { phase: "range"; matchId: string }
  | {
      phase: "pregame" | "ingame";
      matchId: string;
      queue: string | null;
      ranked: boolean;
      map: { uuid: string | null; name: string | null; path: string };
      mode: string | null;
      phaseEndsInMs: number | null;
      allies: LiveMatchPlayer[];
      enemies: LiveMatchPlayer[];
      self: LiveMatchPlayer | null;
    };

export type PartyMember = {
  puuid: string;
  gameName: string | null;
  tagLine: string | null;
  owner: boolean;
  ready: boolean;
  rank: Rank | null;
  accountLevel: number | null;
  card: OwnedCard | null;
  title: OwnedTitle | null;
  incognito: boolean;
};

export type Party = {
  id: string;
  state: string;
  accessibility: "open" | "closed";
  queue: string | null;
  inviteCode: string | null;
  queueEnteredAt: string | null;
  members: PartyMember[];
} | null;

export type AccountXpHistoryEntry = {
  matchId: string;
  at: string;
  before: { level: number; xp: number };
  after: { level: number; xp: number };
  delta: number;
  sources: {
    timePlayed: number;
    matchWin: number;
    firstWinOfTheDay: number;
  };
};

export type AccountXp = {
  level: number;
  xp: number;
  history: AccountXpHistoryEntry[];
  nextFirstWinAt: string | null;
};

export type ContractReward = {
  level: number;
  type: string;
  uuid: string;
  name: string;
  icon: Image;
  unlocked: boolean;
};

export type ContractProgress = {
  uuid: string;
  name: string;
  kind: "agent" | "season" | "event";
  level: number;
  progress: number;
  nextLevelAt: number | null;
  active: boolean;
  rewards: ContractReward[];
};

export type Mission = {
  uuid: string;
  title: string;
  progress: number;
  target: number;
  complete: boolean;
  expiresAt: string | null;
};

export type Penalty = {
  id: string;
  reason: string;
  expiresAt: string;
};

export type Favourite = {
  skinUuid: string;
  name: string;
  weapon: string;
};

export type LeaderboardEntry = {
  rank: number;
  puuid: string;
  gameName: string;
  tagLine: string;
  anonymized: boolean;
  banned: boolean;
  rating: number;
  wins: number;
  tier: Rank;
};

export type Leaderboard = {
  season: string;
  total: number;
  entries: LeaderboardEntry[];
  tierThresholds: Record<string, number>;
};

export type Offer = {
  id: string;
  item: StoreItem;
  cost: Cost;
  startedAt: string | null;
};

export type Order = {
  id: string;
  status: string;
  item: StoreItem | null;
  cost: Cost | null;
};

export type GameSession = {
  state: string;
  clientVersion: string;
  playtimeMinutes: number;
  restricted: boolean;
};

export type ContentSeason = {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

export type ContentEvent = {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

export type Content = {
  act: ContentSeason | null;
  episode: ContentSeason | null;
  events: ContentEvent[];
};

export type QueueConfig = {
  id: string;
  enabled: boolean;
  ranked: boolean;
  teamSize: number;
  minPartySize: number;
  maxPartySize: number;
  mode: string;
};

export type Premier = {
  eligible: boolean | null;
  roster: unknown;
  season: unknown;
  conferences: unknown;
};

export type PartyInvite = {
  id: string;
  partyId: string;
  from: {
    puuid: string;
    gameName: string;
    tagLine: string;
  } | null;
  at: string;
};

export type PartyRequest = {
  id: string;
  from: {
    puuid: string;
    gameName: string;
    tagLine: string;
  } | null;
  at: string;
};

export type CustomGameRules = {
  allowGameModifiers?: boolean | string;
  playOutAllRounds?: boolean | string;
  skipMatchHistory?: boolean | string;
  tournamentMode?: boolean | string;
  isOvertimeWinByTwo?: boolean | string;
  [key: string]: unknown;
};

export type CustomGameSettings = {
  map: string;
  mode: string;
  server: string | null;
  rules: CustomGameRules;
};

export type CustomGameConfigs = {
  maps: Array<{ path: string; name: string }>;
  modes: Array<{ path: string; name: string }>;
  servers: Array<{ id: string; name: string; ping: number | null }>;
};

export type PlayerSettingsBind = {
  command: string;
  key: string;
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  agent: string | null;
  slot: number;
};

export type PlayerSettingsMouse = {
  sensitivity: number | null;
  scopedSensitivityMultiplier: number | null;
  invertY: boolean | null;
  rawInputBuffer: boolean | null;
};

export type PlayerSettings = {
  binds: PlayerSettingsBind[];
  mouse: PlayerSettingsMouse;
  raw: Record<string, unknown>;
};

export type ClientInfo = {
  locale: string;
  region: string;
  riotId: {
    gameName: string;
    tagLine: string;
  };
  valorantRunning: boolean;
  valorantVersion: string | null;
  patchline: string | null;
};

export type Participant = {
  cid: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  name: string;
  pid: string;
  region: string;
  muted: boolean;
  activePlatform: string | null;
};

export type RatingStreak = {
  kind: "win" | "loss" | null;
  length: number;
};

export type RatingNet = {
  last5: number;
  last10: number;
  last20: number;
};

export type RatingAverages = {
  averageGain: number | null;
  averageLoss: number | null;
};

export type RatingTarget = {
  rating: number;
  winsAtCurrentPace: number | null;
};

export type DemotionTarget = {
  rating: number;
  lossesAtCurrentPace: number | null;
};

export type RatingPace = "climbing" | "holding" | "falling";

export type RatingTrend = {
  streak: RatingStreak;
  net: RatingNet;
  winRate: number;
  perGame: RatingAverages;
  toNextRank: RatingTarget;
  toDemotion: DemotionTarget;
  pace: RatingPace;
};

export type PerformanceStats = {
  games: number;
  wins: number;
  winRate: number;
  kd: number;
  kda: number;
  headshotRate: number;
  averageScore: number;
  averageDamagePerRound: number;
  firstBloodsPerGame: number;
  plantsPerGame: number;
  defusesPerGame: number;
};

export type AgentPerformance = PerformanceStats & {
  uuid: string;
  name: string;
  icon: Image;
};

export type MapPerformance = PerformanceStats & {
  uuid: string | null;
  name: string;
  icon: Image;
};

export type PerformanceConsistency = {
  scoreStdDev: number;
  gamesNonNegative: number;
  longestNonNegativeStreak: number;
};

export type PerformanceSummary = {
  overall: PerformanceStats;
  byAgent: AgentPerformance[];
  byMap: MapPerformance[];
  best: {
    agent: AgentPerformance | null;
    map: MapPerformance | null;
  };
  worst: {
    agent: AgentPerformance | null;
    map: MapPerformance | null;
  };
  consistency: PerformanceConsistency;
};

export type AssessmentFlag =
  "low-level-high-rank" | "inflated" | "underranked" | "long-streak" | "new-act";

export type AssessmentWarning = {
  flag: AssessmentFlag;
  reason: string;
};

export type PlayerAssessment = {
  puuid: string;
  accountLevel: number;
  flags: AssessmentWarning[];
  warnings: string[];
};

export type LoadoutDiffItem = {
  slot: string;
  slotId: string;
  from: { id: string; name?: string };
  to: { id: string; name?: string };
};

export type LoadoutDiff = {
  guns: LoadoutDiffItem[];
  sprays: LoadoutDiffItem[];
  identity: LoadoutDiffItem[];
  totalChanges: number;
};

export type CollectionValueItem = {
  skin: { uuid: string; name: string; icon: Image };
  weapon: { uuid: string; name: string };
  tier: Tier | null;
  vp: number | null;
  radianite: number;
  source: "offer" | "bundle" | "unknown";
};

export type CollectionValueGroup = {
  name: string;
  uuid: string | null;
  vp: number;
  radianite: number;
  items: number;
  priced: number;
};

export type CollectionValue = {
  total: {
    vp: number;
    radianite: number;
    priced: number;
    totalItems: number;
  };
  byWeapon: CollectionValueGroup[];
  byTier: CollectionValueGroup[];
  items: CollectionValueItem[];
};

export type StoreHistoryDay = {
  day: string;
  daily: string[];
  nightMarket: string[] | null;
  bundles: string[] | null;
};

export type StoreSeen = {
  lastSeen: string | null;
  times: number;
};

export type StoreHistory = {
  days: StoreHistoryDay[];
};

export type MatchSyncResult = {
  added: MatchSummary[];
  total: number;
};

export type OfficialAccount = {
  puuid: string;
  gameName: string;
  tagLine: string;
  shard: string;
};

export type OfficialProfile = {
  account: OfficialAccount;
  accountLevel: number | null;
  rank: Rank | null;
  lastPlayedAt: string | null;
  summary: PerformanceSummary;
};

export type WishlistEntry = {
  uuid: string;
  name: string;
  addedAt: string;
};

export type Wishlist = {
  skins: WishlistEntry[];
};

export type WishlistHit = {
  skin: {
    uuid: string;
    name: string;
    weapon: string;
    icon: Image;
  };
  where: "daily" | "night-market" | "bundle";
  price: number;
  discountedPrice: number | null;
  bundleName: string | null;
  endsAt: string | null;
};

export type WishlistCheck = {
  checkedAt: string;
  hits: WishlistHit[];
};
