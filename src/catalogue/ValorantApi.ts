import type { HttpGateway } from "../riot/HttpGateway.js";
import { Catalogue } from "./Catalogue.js";
import type { FileCatalogueStore } from "./CatalogueStore.js";
import type {
  ValorantApiAgent,
  ValorantApiBuddy,
  ValorantApiBundle,
  ValorantApiCatalogueData,
  ValorantApiContentTier,
  ValorantApiContract,
  ValorantApiCurrency,
  ValorantApiFlex,
  ValorantApiLevelBorder,
  ValorantApiMap,
  ValorantApiMission,
  ValorantApiPlayerCard,
  ValorantApiPlayerTitle,
  ValorantApiSeason,
  ValorantApiSpray,
  ValorantApiTheme,
  ValorantApiTier,
  ValorantApiWeapon,
} from "./types.js";

interface ValorantApiTierGroup {
  uuid: string;
  tiers: ValorantApiTier[];
}

interface ApiResponse<T> {
  status: number;
  data: T;
}

interface VersionData {
  riotClientVersion: string;
}

export class MemoryCatalogueCache {
  private clientVersion: string | null = null;
  private readonly catalogues = new Map<string, Catalogue>();

  getVersion(): string | null {
    return this.clientVersion;
  }

  setVersion(version: string): void {
    this.clientVersion = version;
  }

  getCatalogue(language: string): Catalogue | undefined {
    return this.catalogues.get(language);
  }

  setCatalogue(language: string, catalogue: Catalogue): void {
    this.catalogues.set(language, catalogue);
  }

  clear(): void {
    this.clientVersion = null;
    this.catalogues.clear();
  }
}

const GLOBAL_CACHE = new MemoryCatalogueCache();

export class ValorantApi {
  private readonly gateway: HttpGateway;
  private readonly cache: MemoryCatalogueCache;
  private readonly store: FileCatalogueStore | null;

  constructor(
    gateway: HttpGateway,
    cache: MemoryCatalogueCache = GLOBAL_CACHE,
    store: FileCatalogueStore | null = null,
  ) {
    this.gateway = gateway;
    this.cache = cache;
    this.store = store;
  }

  async getClientVersion(): Promise<string> {
    return this.cache.getVersion() || this.fetchClientVersion();
  }

  async getCatalogue(language = "en-US"): Promise<Catalogue> {
    const cached = this.cache.getCatalogue(language);
    if (cached) {
      return cached;
    }

    const catalogue = new Catalogue(await this.loadCatalogueData(language));
    this.cache.setCatalogue(language, catalogue);
    return catalogue;
  }

  // Past the memory cache and the store: for a consumer that knows the catalogue is out of date.
  async refreshCatalogue(language = "en-US"): Promise<Catalogue> {
    const [data, version] = await Promise.all([
      this.fetchCatalogueData(language),
      this.fetchClientVersion(),
    ]);
    this.store?.write(language, { version, data });
    const catalogue = new Catalogue(data);
    this.cache.setCatalogue(language, catalogue);
    return catalogue;
  }

  private async fetchClientVersion(): Promise<string> {
    const response = await this.gateway.get<ApiResponse<VersionData>>(
      "https://valorant-api.com/v1/version",
    );
    const version = response.data.riotClientVersion;
    this.cache.setVersion(version);
    return version;
  }

  private async loadCatalogueData(language: string): Promise<ValorantApiCatalogueData> {
    if (!this.store) {
      return this.fetchCatalogueData(language);
    }
    const version = await this.getClientVersion();
    const stored = this.store.read(language);
    if (
      stored?.version === version &&
      Array.isArray(stored.data?.bundles) &&
      Array.isArray(stored.data?.maps) &&
      Array.isArray(stored.data?.tiers) &&
      Array.isArray(stored.data?.seasons) &&
      Array.isArray(stored.data?.contracts) &&
      Array.isArray(stored.data?.missions) &&
      Array.isArray(stored.data?.flex) &&
      Array.isArray(stored.data?.themes)
    ) {
      return stored.data;
    }
    const data = await this.fetchCatalogueData(language);
    this.store.write(language, { version, data });
    return data;
  }

  private async fetchCatalogueData(language: string): Promise<ValorantApiCatalogueData> {
    const [base, extra] = await Promise.all([
      this.fetchBaseCatalogue(language),
      this.fetchExtraCatalogue(language),
    ]);
    return { ...base, ...extra };
  }

  private async fetchBaseCatalogue(
    language: string,
  ): Promise<
    Omit<
      ValorantApiCatalogueData,
      "tiers" | "seasons" | "levelBorders" | "contracts" | "missions" | "flex" | "themes"
    >
  > {
    const [
      weaponsRes,
      cardsRes,
      titlesRes,
      spraysRes,
      buddiesRes,
      agentsRes,
      tiersRes,
      curRes,
      bunRes,
      mapsRes,
    ] = await Promise.all([
      this.fetchEndpoint<ValorantApiWeapon[]>("weapons", language),
      this.fetchEndpoint<ValorantApiPlayerCard[]>("playerCards", language),
      this.fetchEndpoint<ValorantApiPlayerTitle[]>("playerTitles", language),
      this.fetchEndpoint<ValorantApiSpray[]>("sprays", language),
      this.fetchEndpoint<ValorantApiBuddy[]>("buddies", language),
      this.fetchEndpoint<ValorantApiAgent[]>("agents", language),
      this.fetchEndpoint<ValorantApiContentTier[]>("contentTiers", language),
      this.fetchEndpoint<ValorantApiCurrency[]>("currencies", language),
      this.fetchEndpoint<ValorantApiBundle[]>("bundles", language),
      this.fetchEndpoint<ValorantApiMap[]>("maps", language),
    ]);
    return {
      weapons: weaponsRes.data,
      playerCards: cardsRes.data,
      playerTitles: titlesRes.data,
      sprays: spraysRes.data,
      buddies: buddiesRes.data,
      agents: agentsRes.data,
      contentTiers: tiersRes.data,
      currencies: curRes.data,
      bundles: bunRes.data,
      maps: mapsRes.data,
    };
  }

  private async fetchExtraCatalogue(
    language: string,
  ): Promise<
    Pick<
      ValorantApiCatalogueData,
      "tiers" | "seasons" | "levelBorders" | "contracts" | "missions" | "flex" | "themes"
    >
  > {
    const [compTiersRes, seasonsRes, bordersRes, contractsRes, missionsRes, flexRes, themesRes] =
      await Promise.all([
        this.fetchEndpoint<ValorantApiTierGroup[]>("competitivetiers", language),
        this.fetchEndpoint<ValorantApiSeason[]>("seasons", language),
        this.fetchEndpoint<ValorantApiLevelBorder[]>("levelborders", language),
        this.fetchEndpoint<ValorantApiContract[]>("contracts", language),
        this.fetchEndpoint<ValorantApiMission[]>("missions", language),
        this.fetchEndpoint<ValorantApiFlex[]>("flex", language),
        this.fetchEndpoint<ValorantApiTheme[]>("themes", language),
      ]);
    const tierGroups = compTiersRes.data ?? [];
    const lastGroup = tierGroups[tierGroups.length - 1];
    return {
      tiers: lastGroup?.tiers ?? [],
      seasons: seasonsRes.data,
      levelBorders: bordersRes.data,
      contracts: contractsRes.data,
      missions: missionsRes.data,
      flex: flexRes.data,
      themes: themesRes.data,
    };
  }

  private async fetchEndpoint<T>(endpoint: string, language: string): Promise<ApiResponse<T>> {
    const url = `https://valorant-api.com/v1/${endpoint}?language=${encodeURIComponent(language)}`;
    return this.gateway.get<ApiResponse<T>>(url);
  }
}
