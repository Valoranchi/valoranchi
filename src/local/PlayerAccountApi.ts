import type { RiotClientLocalApi } from "./RiotClientLocalApi.js";

export interface RawAliasLookupEntry {
  puuid?: string;
  alias?: Record<string, unknown>;
}

export class PlayerAccountApi {
  private readonly localApi: RiotClientLocalApi;

  constructor(localApi: RiotClientLocalApi) {
    this.localApi = localApi;
  }

  async lookup(gameName: string, tagLine: string): Promise<RawAliasLookupEntry[]> {
    const query = new URLSearchParams({ gameName, tagLine });
    const res = await this.localApi.get<RawAliasLookupEntry[]>(
      `/player-account/aliases/v1/lookup?${query.toString()}`,
    );
    return Array.isArray(res) ? res : [];
  }

  async puuidOf(gameName: string, tagLine: string): Promise<string | null> {
    const entries = await this.lookup(gameName, tagLine);
    return entries.find((entry) => entry.puuid)?.puuid ?? null;
  }
}
