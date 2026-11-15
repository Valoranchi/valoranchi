export interface ValorantApiSkinLevel {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
}

export interface ValorantApiChroma {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  swatch: string | null;
}

export interface ValorantApiSkin {
  uuid: string;
  displayName: string;
  contentTierUuid: string | null;
  displayIcon: string | null;
  levels: ValorantApiSkinLevel[];
  chromas: ValorantApiChroma[];
}

export interface ValorantApiWeapon {
  uuid: string;
  displayName: string;
  category: string;
  shopData?: {
    categoryText?: string;
  } | null;
  skins: ValorantApiSkin[];
}

export interface ValorantApiPlayerCard {
  uuid: string;
  displayName: string;
  smallArt: string | null;
  wideArt: string | null;
  largeArt: string | null;
}

export interface ValorantApiPlayerTitle {
  uuid: string;
  displayName: string;
  titleText: string | null;
}

export interface ValorantApiSpray {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  fullTransparentIcon: string | null;
}

export interface ValorantApiBuddyLevel {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
}

export interface ValorantApiBuddy {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  levels: ValorantApiBuddyLevel[];
}

export interface ValorantApiAgent {
  uuid: string;
  displayName: string;
  role: {
    displayName?: string;
  } | null;
  displayIcon: string | null;
  isPlayableCharacter: boolean;
  isBaseContent?: boolean;
}

export interface ValorantApiContentTier {
  uuid: string;
  displayName: string;
  rank: number;
  displayIcon: string | null;
}

export interface ValorantApiCurrency {
  uuid: string;
  displayName: string;
}

export interface ValorantApiBundle {
  uuid: string;
  displayName: string;
  displayNameSubText: string | null;
  description: string | null;
  displayIcon: string | null;
  displayIcon2: string | null;
  verticalPromoImage: string | null;
}

export interface ValorantApiMapCallout {
  regionName: string;
  superRegionName: string;
  location: { x: number; y: number };
}

export interface ValorantApiMap {
  uuid: string;
  displayName: string;
  mapUrl: string;
  displayIcon: string | null;
  listViewIcon: string | null;
  splash?: string | null;
  xMultiplier?: number | null;
  yMultiplier?: number | null;
  xScalarToAdd?: number | null;
  yScalarToAdd?: number | null;
  callouts?: ValorantApiMapCallout[] | null;
}

export interface ValorantApiFlex {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
}

export interface ValorantApiTheme {
  uuid: string;
  displayName: string;
}

export interface ValorantApiTier {
  tier: number;
  tierName: string;
  divisionName: string | null;
  color: string | null;
  smallIcon: string | null;
  largeIcon: string | null;
}

export interface ValorantApiSeason {
  uuid: string;
  displayName: string;
  type: string | null;
  startTime: string;
  endTime: string;
  parentUuid: string | null;
}

export interface ValorantApiLevelBorder {
  uuid: string;
  startingLevel: number;
}

export interface ValorantApiContractLevelReward {
  type: string;
  uuid: string;
  amount: number;
  isHighlighted: boolean;
}

export interface ValorantApiContractLevel {
  reward: ValorantApiContractLevelReward;
  xp: number;
  vpCost: number;
  isPurchasableWithVP: boolean;
  doughCost: number;
  isPurchasableWithDough: boolean;
}

export interface ValorantApiContractChapter {
  isEpilogue: boolean;
  levels: ValorantApiContractLevel[];
  freeRewards?: ValorantApiContractLevelReward[] | null;
}

export interface ValorantApiContractContent {
  relationType: "Agent" | "Season" | "Event" | string;
  relationUuid: string;
  chapters: ValorantApiContractChapter[];
}

export interface ValorantApiContract {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  content: ValorantApiContractContent | null;
}

export interface ValorantApiMissionObjective {
  objectiveUuid: string;
  value: number;
}

export interface ValorantApiMission {
  uuid: string;
  displayName: string | null;
  title: string | null;
  type: string | null;
  progressToComplete: number;
  objectives?: ValorantApiMissionObjective[] | null;
}

export interface ValorantApiCatalogueData {
  weapons: ValorantApiWeapon[];
  playerCards: ValorantApiPlayerCard[];
  playerTitles: ValorantApiPlayerTitle[];
  sprays: ValorantApiSpray[];
  buddies: ValorantApiBuddy[];
  agents: ValorantApiAgent[];
  contentTiers: ValorantApiContentTier[];
  currencies: ValorantApiCurrency[];
  bundles: ValorantApiBundle[];
  maps: ValorantApiMap[];
  tiers?: ValorantApiTier[];
  seasons?: ValorantApiSeason[];
  levelBorders?: ValorantApiLevelBorder[];
  contracts?: ValorantApiContract[];
  missions?: ValorantApiMission[];
  flex?: ValorantApiFlex[];
  themes?: ValorantApiTheme[];
}
