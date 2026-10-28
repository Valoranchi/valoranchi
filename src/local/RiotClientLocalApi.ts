import { Agent, fetch as undiciFetch } from "undici";
import { RiotApiError, RiotClientNotReadyError, RiotClientNotRunningError } from "../errors.js";

export interface LocalEntitlementsToken {
  accessToken: string;
  token: string;
  subject: string;
}

export interface LocalSessionInfo {
  region: string;
  shard: string;
}

export interface LocalApiResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type LocalApiFetchFn = (
  url: string,
  init?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    dispatcher?: Agent;
    signal?: AbortSignal;
  },
) => Promise<LocalApiResponse>;

interface ExternalSessionEntry {
  productId?: string;
  launchConfiguration?: {
    arguments?: string[];
  };
}

type AttemptResult<T> = { kind: "ok"; value: T } | { kind: "not-ready" } | { kind: "refused" };

export class RiotClientLocalApi {
  private readonly port: number;
  private readonly authorization: string;
  private readonly agent: Agent;
  private readonly fetchFn: LocalApiFetchFn;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(
    port: number,
    password: string,
    options?: {
      agent?: Agent;
      fetchFn?: LocalApiFetchFn;
      sleepFn?: (ms: number) => Promise<void>;
    },
  ) {
    this.port = port;
    this.authorization = `Basic ${Buffer.from(`riot:${password}`).toString("base64")}`;
    this.agent =
      options?.agent ??
      new Agent({
        connect: {
          rejectUnauthorized: false,
        },
      });
    this.fetchFn = options?.fetchFn ?? (undiciFetch as unknown as LocalApiFetchFn);
    this.sleepFn =
      options?.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async entitlementsToken(): Promise<LocalEntitlementsToken> {
    return this.withWarmupRetry<LocalEntitlementsToken>(
      async (): Promise<AttemptResult<LocalEntitlementsToken>> => {
        const url = `https://127.0.0.1:${this.port}/entitlements/v1/token`;
        try {
          const response = await this.fetchFn(url, {
            headers: { Authorization: this.authorization },
            dispatcher: this.agent,
          });

          if (response.ok) {
            const data = (await response.json()) as {
              accessToken?: string;
              token?: string;
              subject?: string;
            };
            if (data.accessToken && data.token && data.subject) {
              return {
                kind: "ok",
                value: {
                  accessToken: data.accessToken,
                  token: data.token,
                  subject: data.subject,
                },
              };
            }
          }

          return { kind: "not-ready" };
        } catch (error) {
          if (this.isConnectionRefused(error)) {
            return { kind: "refused" };
          }
          return { kind: "not-ready" };
        }
      },
    );
  }

  async probe<T>(path: string, timeoutMs: number): Promise<T | null> {
    try {
      const response = await this.fetchFn(this.url(path), {
        method: "GET",
        headers: { Authorization: this.authorization },
        dispatcher: this.agent,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.ok ? ((await response.json()) as T) : null;
    } catch {
      return null;
    }
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T | null> {
    return this.request<T>("GET", path, undefined, headers);
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return (await this.request<T>("POST", path, body, headers)) as T;
  }

  async put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return (await this.request<T>("PUT", path, body, headers)) as T;
  }

  async delete<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return (await this.request<T>("DELETE", path, body, headers)) as T;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>,
  ): Promise<T | null> {
    const url = this.url(path);
    const serializedBody =
      body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined;

    const headers: Record<string, string> = {
      Authorization: this.authorization,
      ...(serializedBody !== undefined ? { "Content-Type": "application/json" } : {}),
      ...customHeaders,
    };

    return this.withWarmupRetry<T | null>(async (attempt, maxRetries) => {
      try {
        const response = await this.fetchFn(url, {
          method,
          headers,
          body: serializedBody,
          dispatcher: this.agent,
        });

        if (method === "GET") {
          if (response.status === 404) {
            return { kind: "ok", value: null };
          }
          if (response.ok) {
            const data = (await response.json()) as T;
            return { kind: "ok", value: data };
          }
          return { kind: "not-ready" };
        }

        if (response.ok) {
          const text = await response.text();
          if (!text || text.trim().length === 0) {
            return { kind: "ok", value: {} as T };
          }
          try {
            return { kind: "ok", value: JSON.parse(text) as T };
          } catch {
            return { kind: "ok", value: text as unknown as T };
          }
        }

        if (attempt < maxRetries && response.status === 503) {
          return { kind: "not-ready" };
        }

        throw new RiotApiError(response.status, url);
      } catch (error) {
        if (error instanceof RiotApiError) {
          throw error;
        }
        if (this.isConnectionRefused(error)) {
          return { kind: "refused" };
        }
        return { kind: "not-ready" };
      }
    });
  }

  private url(path: string): string {
    return `https://127.0.0.1:${this.port}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private async withWarmupRetry<T>(
    operation: (attempt: number, maxRetries: number) => Promise<AttemptResult<T>>,
  ): Promise<T> {
    const maxRetries = 5;
    const retryDelayMs = 1500;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await operation(attempt, maxRetries);
      switch (result.kind) {
        case "ok":
          return result.value;
        case "refused":
          throw new RiotClientNotRunningError();
        case "not-ready":
          if (attempt < maxRetries) {
            await this.sleepFn(retryDelayMs);
            break;
          }
          throw new RiotClientNotReadyError();
      }
    }

    throw new RiotClientNotReadyError();
  }

  async close(): Promise<void> {
    await this.agent.close();
  }

  async valorantSession(): Promise<LocalSessionInfo | null> {
    const url = `https://127.0.0.1:${this.port}/product-session/v1/external-sessions`;
    try {
      const response = await this.fetchFn(url, {
        headers: { Authorization: this.authorization },
        dispatcher: this.agent,
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as Record<string, ExternalSessionEntry>;
      return this.parseExternalSessions(data);
    } catch {
      return null;
    }
  }

  async gameAuthorization(): Promise<string | null> {
    const url = `https://127.0.0.1:${this.port}/product-session/v1/external-sessions`;
    try {
      const response = await this.fetchFn(url, {
        headers: { Authorization: this.authorization },
        dispatcher: this.agent,
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as Record<string, ExternalSessionEntry>;
      return this.extractGameAuth(data);
    } catch {
      return null;
    }
  }

  private extractGameAuth(sessions: Record<string, ExternalSessionEntry>): string | null {
    const valorant = Object.values(sessions).find(
      (entry) => entry.productId?.toLowerCase() === "valorant",
    );
    const args = valorant?.launchConfiguration?.arguments;
    if (!args || !Array.isArray(args)) {
      return null;
    }
    const tokenArg = args.find((a) => a.startsWith("-remoting-auth-token="));
    if (!tokenArg) {
      return null;
    }
    const token = tokenArg.slice("-remoting-auth-token=".length).trim();
    if (!token) {
      return null;
    }
    return `Basic ${Buffer.from(`riot:${token}`).toString("base64")}`;
  }

  private parseExternalSessions(
    sessions: Record<string, ExternalSessionEntry>,
  ): LocalSessionInfo | null {
    const valorant = Object.values(sessions).find(
      (entry) => entry.productId?.toLowerCase() === "valorant",
    );
    const args = valorant?.launchConfiguration?.arguments;
    if (!args || !Array.isArray(args)) {
      return null;
    }

    const regionArg = args.find((a) => a.startsWith("-ares-deployment="));
    const endpointArg = args.find((a) => a.startsWith("-config-endpoint="));
    if (!regionArg || !endpointArg) {
      return null;
    }

    const region = regionArg.split("=")[1]?.trim().toLowerCase();
    const shardMatch = endpointArg.match(/shared\.([a-z0-9]+)\.a\.pvp\.net/i);
    const shard = shardMatch?.[1]?.trim().toLowerCase();
    if (!region || !shard) {
      return null;
    }

    return { region, shard };
  }

  private isConnectionRefused(error: unknown): boolean {
    const err = error as { code?: string; cause?: { code?: string } };
    return err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED";
  }
}
