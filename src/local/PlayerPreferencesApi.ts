import { RiotClientError } from "../errors.js";
import type { HttpFetchFn } from "../riot/HttpGateway.js";
import { isPreferenceBlob, PreferenceCodec, type PreferenceBlob } from "../riot/PreferenceCodec.js";
import type { RiotClientLocalApi } from "./RiotClientLocalApi.js";

export const PLAYER_SETTINGS_TYPE = "Ares.PlayerSettings";

// The host the Riot Client asks itself. Checked on NA only; the game fallback covers other regions.
const DEFAULT_HOST = "https://usw2.pp.sgp.pvp.net";
const REQUEST_TIMEOUT_MS = 10_000;

export type PreferenceSource = "service" | "game";

export interface PreferenceRead {
  data: PreferenceBlob;
  source: PreferenceSource;
}

export interface PlayerPreferencesOptions {
  host?: string;
  fetchFn?: HttpFetchFn;
}

interface PreferenceBackend {
  readonly source: PreferenceSource;
  read(type: string): Promise<PreferenceBlob | null>;
  write(type: string, data: PreferenceBlob): Promise<boolean>;
}

async function fallbackOnClientError<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RiotClientError) return fallback;
    throw error;
  }
}

class ServiceBackend implements PreferenceBackend {
  readonly source = "service";

  constructor(
    private readonly localApi: RiotClientLocalApi,
    private readonly host: string,
    private readonly fetchFn: HttpFetchFn,
  ) {}

  async read(type: string): Promise<PreferenceBlob | null> {
    const body = await this.send("GET", `/playerPref/v3/getPreference/${encodeURIComponent(type)}`);
    if (body === null) return null;
    try {
      const { data } = JSON.parse(body) as { data?: unknown };
      return typeof data === "string" ? PreferenceCodec.decode(data) : null;
    } catch {
      return null;
    }
  }

  async write(type: string, data: PreferenceBlob): Promise<boolean> {
    if (!PreferenceCodec.roundTrips(data)) return false;
    const body = await this.send("PUT", "/playerPref/v3/savePreference", {
      type,
      data: PreferenceCodec.encode(data),
    });
    return body !== null;
  }

  // Saving is a PUT: the route answers a POST with 405.
  private async send(method: "GET" | "PUT", path: string, body?: unknown): Promise<string | null> {
    const credentials = await this.credentials();
    if (!credentials) return null;
    try {
      const response = await this.fetchFn(`${this.host}${path}`, {
        method,
        headers:
          body === undefined ? credentials : { ...credentials, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      return response.ok ? text : null;
    } catch {
      return null;
    }
  }

  private credentials(): Promise<Record<string, string> | null> {
    return fallbackOnClientError(async () => {
      const { accessToken, token } = await this.localApi.entitlementsToken();
      return { Authorization: `Bearer ${accessToken}`, "X-Riot-Entitlements-JWT": token };
    }, null);
  }
}

class GameBackend implements PreferenceBackend {
  readonly source = "game";

  constructor(private readonly localApi: RiotClientLocalApi) {}

  async read(type: string): Promise<PreferenceBlob | null> {
    const headers = await this.authorization();
    if (!headers) return null;
    return fallbackOnClientError(async () => {
      const response = await this.localApi.get<{ data?: unknown }>(this.path(type), headers);
      return isPreferenceBlob(response?.data) ? response.data : null;
    }, null);
  }

  // The local route takes the settings object itself, not a { type, data } wrapper.
  async write(type: string, data: PreferenceBlob): Promise<boolean> {
    const headers = await this.authorization();
    if (!headers) return false;
    return fallbackOnClientError(async () => {
      await this.localApi.put(this.path(type), data, headers);
      return true;
    }, false);
  }

  private async authorization(): Promise<Record<string, string> | null> {
    const authorization = await this.localApi.gameAuthorization();
    return authorization ? { Authorization: authorization } : null;
  }

  private path(type: string): string {
    return `/player-preferences/v1/data-json/${encodeURIComponent(type)}`;
  }
}

export class PlayerPreferencesApi {
  private readonly backends: PreferenceBackend[];

  constructor(localApi: RiotClientLocalApi, options: PlayerPreferencesOptions = {}) {
    this.backends = [
      new ServiceBackend(
        localApi,
        options.host ?? DEFAULT_HOST,
        options.fetchFn ?? globalThis.fetch,
      ),
      new GameBackend(localApi),
    ];
  }

  async read(type = PLAYER_SETTINGS_TYPE): Promise<PreferenceRead | null> {
    for (const backend of this.backends) {
      const data = await backend.read(type);
      if (data) return { data, source: backend.source };
    }
    return null;
  }

  async write(data: PreferenceBlob, type = PLAYER_SETTINGS_TYPE): Promise<PreferenceSource | null> {
    for (const backend of this.backends) {
      if (await backend.write(type, data)) return backend.source;
    }
    return null;
  }
}
