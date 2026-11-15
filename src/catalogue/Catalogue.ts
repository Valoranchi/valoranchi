import type {
  ValorantApiAgent,
  ValorantApiBuddy,
  ValorantApiBuddyLevel,
  ValorantApiBundle,
  ValorantApiCatalogueData,
  ValorantApiChroma,
  ValorantApiContentTier,
  ValorantApiContract,
  ValorantApiCurrency,
  ValorantApiLevelBorder,
  ValorantApiMap,
  ValorantApiMission,
  ValorantApiPlayerCard,
  ValorantApiPlayerTitle,
  ValorantApiSeason,
  ValorantApiSkin,
  ValorantApiSkinLevel,
  ValorantApiSpray,
  ValorantApiTier,
  ValorantApiWeapon,
} from "./types.js";

export class Catalogue {
  readonly data: ValorantApiCatalogueData;
  readonly weapons: readonly ValorantApiWeapon[];
  readonly tiers: readonly ValorantApiTier[];
  readonly seasons: readonly ValorantApiSeason[];
  readonly levelBorders: readonly ValorantApiLevelBorder[];
  readonly contracts: readonly ValorantApiContract[];
  readonly missions: readonly ValorantApiMission[];
  private readonly weaponsByUuid = new Map<string, ValorantApiWeapon>();
  private readonly skinsByUuid = new Map<string, ValorantApiSkin>();
  private readonly skinLevelIndex = new Map<
    string,
    { weapon: ValorantApiWeapon; skin: ValorantApiSkin; level: ValorantApiSkinLevel }
  >();
  private readonly chromaIndex = new Map<
    string,
    { weapon: ValorantApiWeapon; skin: ValorantApiSkin; chroma: ValorantApiChroma }
  >();
  private readonly buddyLevelIndex = new Map<
    string,
    { buddy: ValorantApiBuddy; level: ValorantApiBuddyLevel }
  >();
  private readonly buddiesByUuid = new Map<string, ValorantApiBuddy>();
  private readonly cardsByUuid = new Map<string, ValorantApiPlayerCard>();
  private readonly titlesByUuid = new Map<string, ValorantApiPlayerTitle>();
  private readonly spraysByUuid = new Map<string, ValorantApiSpray>();
  private readonly agentsByUuid = new Map<string, ValorantApiAgent>();
  private readonly tiersByUuid = new Map<string, ValorantApiContentTier>();
  private readonly currenciesByUuid = new Map<string, ValorantApiCurrency>();
  private readonly bundlesByUuid = new Map<string, ValorantApiBundle>();
  private readonly mapsByPath = new Map<string, ValorantApiMap>();
  private readonly tierByNumber = new Map<number, ValorantApiTier>();
  private readonly seasonByUuid = new Map<string, ValorantApiSeason>();
  private readonly levelBordersByUuid = new Map<string, ValorantApiLevelBorder>();
  private readonly contractsByUuid = new Map<string, ValorantApiContract>();
  private readonly contractsByRelationUuid = new Map<string, ValorantApiContract>();
  private readonly missionsByUuid = new Map<string, ValorantApiMission>();

  constructor(data: ValorantApiCatalogueData) {
    this.data = data;
    this.weapons = data.weapons;
    this.tiers = data.tiers ?? [];
    this.seasons = data.seasons ?? [];
    this.levelBorders = data.levelBorders ?? [];
    this.contracts = data.contracts ?? [];
    this.missions = data.missions ?? [];
    this.indexWeapons(data.weapons);
    this.indexBuddies(data.buddies);
    this.indexOtherEntities(data);
    this.indexContractsAndMissions(this.contracts, this.missions);
  }

  private indexWeapons(weapons: ValorantApiWeapon[]): void {
    for (const weapon of weapons) {
      this.weaponsByUuid.set(weapon.uuid.toLowerCase(), weapon);
      for (const skin of weapon.skins) {
        this.skinsByUuid.set(skin.uuid.toLowerCase(), skin);
        for (const level of skin.levels) {
          this.skinLevelIndex.set(level.uuid.toLowerCase(), { weapon, skin, level });
        }
        for (const chroma of skin.chromas) {
          this.chromaIndex.set(chroma.uuid.toLowerCase(), { weapon, skin, chroma });
        }
      }
    }
  }

  private indexBuddies(buddies: ValorantApiBuddy[]): void {
    for (const buddy of buddies) {
      this.buddiesByUuid.set(buddy.uuid.toLowerCase(), buddy);
      for (const level of buddy.levels) {
        this.buddyLevelIndex.set(level.uuid.toLowerCase(), { buddy, level });
      }
    }
  }

  private indexOtherEntities(data: ValorantApiCatalogueData): void {
    for (const card of data.playerCards) {
      this.cardsByUuid.set(card.uuid.toLowerCase(), card);
    }
    for (const title of data.playerTitles) {
      this.titlesByUuid.set(title.uuid.toLowerCase(), title);
    }
    for (const spray of data.sprays) {
      this.spraysByUuid.set(spray.uuid.toLowerCase(), spray);
    }
    for (const agent of data.agents) {
      this.agentsByUuid.set(agent.uuid.toLowerCase(), agent);
    }
    for (const tier of data.contentTiers) {
      this.tiersByUuid.set(tier.uuid.toLowerCase(), tier);
    }
    for (const currency of data.currencies) {
      this.currenciesByUuid.set(currency.uuid.toLowerCase(), currency);
    }
    for (const bundle of data.bundles ?? []) {
      this.bundlesByUuid.set(bundle.uuid.toLowerCase(), bundle);
    }
    for (const map of data.maps ?? []) {
      if (map?.mapUrl) {
        this.mapsByPath.set(map.mapUrl.toLowerCase(), map);
      }
    }
    for (const tier of this.tiers) {
      this.tierByNumber.set(tier.tier, tier);
    }
    for (const season of this.seasons) {
      this.seasonByUuid.set(season.uuid.toLowerCase(), season);
    }
    for (const border of this.levelBorders) {
      this.levelBordersByUuid.set(border.uuid.toLowerCase(), border);
    }
  }

  getLevelBorder(uuid: string): ValorantApiLevelBorder | undefined {
    return this.levelBordersByUuid.get(uuid.toLowerCase());
  }

  findSkinAndWeaponByLevel(levelUuid: string) {
    return this.skinLevelIndex.get(levelUuid.toLowerCase());
  }

  findSkinAndWeaponByChroma(chromaUuid: string) {
    return this.chromaIndex.get(chromaUuid.toLowerCase());
  }

  findBuddyByLevel(buddyLevelUuid: string) {
    return this.buddyLevelIndex.get(buddyLevelUuid.toLowerCase());
  }

  getWeapon(uuid: string): ValorantApiWeapon | undefined {
    return this.weaponsByUuid.get(uuid.toLowerCase());
  }

  getSkin(uuid: string): ValorantApiSkin | undefined {
    return this.skinsByUuid.get(uuid.toLowerCase());
  }

  findSkin(query: string): ValorantApiSkin | undefined {
    const q = query.trim().toLowerCase();
    const byUuid = this.skinsByUuid.get(q);
    if (byUuid) return byUuid;
    for (const skin of this.skinsByUuid.values()) {
      if (skin.displayName.toLowerCase() === q) return skin;
    }
    return undefined;
  }

  getBuddy(uuid: string): ValorantApiBuddy | undefined {
    return this.buddiesByUuid.get(uuid.toLowerCase());
  }

  getCard(uuid: string): ValorantApiPlayerCard | undefined {
    return this.cardsByUuid.get(uuid.toLowerCase());
  }

  getTitle(uuid: string): ValorantApiPlayerTitle | undefined {
    return this.titlesByUuid.get(uuid.toLowerCase());
  }

  getSpray(uuid: string): ValorantApiSpray | undefined {
    return this.spraysByUuid.get(uuid.toLowerCase());
  }

  getAgent(uuid: string): ValorantApiAgent | undefined {
    return this.agentsByUuid.get(uuid.toLowerCase());
  }

  findAgent(query: string): ValorantApiAgent | undefined {
    const q = query.trim().toLowerCase();
    const byUuid = this.agentsByUuid.get(q);
    if (byUuid) return byUuid;
    for (const agent of this.agentsByUuid.values()) {
      if (agent.displayName.toLowerCase() === q) return agent;
    }
    return undefined;
  }

  getTier(uuid: string): ValorantApiContentTier | undefined {
    return this.tiersByUuid.get(uuid.toLowerCase());
  }

  getCurrency(uuid: string): ValorantApiCurrency | undefined {
    return this.currenciesByUuid.get(uuid.toLowerCase());
  }

  getBundle(uuid: string): ValorantApiBundle | undefined {
    return this.bundlesByUuid.get(uuid.toLowerCase());
  }

  getMapByPath(path: string): ValorantApiMap | undefined {
    return this.mapsByPath.get(path.toLowerCase());
  }

  findMap(query: string): ValorantApiMap | undefined {
    const q = query.trim().toLowerCase();
    const byPath = this.mapsByPath.get(q);
    if (byPath) return byPath;
    for (const map of this.mapsByPath.values()) {
      if (map.displayName.toLowerCase() === q || map.uuid.toLowerCase() === q) return map;
    }
    return undefined;
  }

  getTierByNumber(tier: number): ValorantApiTier | undefined {
    return this.tierByNumber.get(tier);
  }

  getSeason(uuid: string): ValorantApiSeason | undefined {
    return this.seasonByUuid.get(uuid.toLowerCase());
  }

  currentAct(now: Date = new Date()): ValorantApiSeason | undefined {
    const nowTime = now.getTime();
    for (const season of this.seasons) {
      if (season.type === "EAresSeasonType::Act" && season.startTime && season.endTime) {
        const start = new Date(season.startTime).getTime();
        const end = new Date(season.endTime).getTime();
        if (start <= nowTime && nowTime < end) {
          return season;
        }
      }
    }
    return undefined;
  }

  private indexContractsAndMissions(
    contracts: readonly ValorantApiContract[],
    missions: readonly ValorantApiMission[],
  ): void {
    for (const contract of contracts) {
      this.contractsByUuid.set(contract.uuid.toLowerCase(), contract);
      if (contract.content?.relationUuid) {
        this.contractsByRelationUuid.set(contract.content.relationUuid.toLowerCase(), contract);
      }
    }
    for (const mission of missions) {
      this.missionsByUuid.set(mission.uuid.toLowerCase(), mission);
    }
  }

  getContract(uuid: string): ValorantApiContract | undefined {
    return this.contractsByUuid.get(uuid.toLowerCase());
  }

  getContractByRelation(relationUuid: string): ValorantApiContract | undefined {
    return this.contractsByRelationUuid.get(relationUuid.toLowerCase());
  }

  getMission(uuid: string): ValorantApiMission | undefined {
    return this.missionsByUuid.get(uuid.toLowerCase());
  }
}
