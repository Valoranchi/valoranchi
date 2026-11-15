import { describe, expect, it } from "vitest";
import { parseLockfile } from "../src/local/Lockfile.js";
import { RiotClientLocalApi, type LocalApiFetchFn } from "../src/local/RiotClientLocalApi.js";
import {
  gamePodRegion,
  parseRegionFromLog,
  resolveRegion,
  shardOf,
} from "../src/local/RegionResolver.js";
import {
  RegionUnknownError,
  RiotApiError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
} from "../src/errors.js";

describe("Lockfile", () => {
  it("parses valid lockfile content", () => {
    const parsed = parseLockfile("Riot Client:1234:5678:secret_pass:https");
    expect(parsed).toEqual({
      name: "Riot Client",
      pid: 1234,
      port: 5678,
      password: "secret_pass",
    });
  });

  it("returns null for malformed lockfile content", () => {
    expect(parseLockfile("")).toBeNull();
    expect(parseLockfile("invalid")).toBeNull();
    expect(parseLockfile("Riot Client:abc:5678:secret_pass")).toBeNull();
    expect(parseLockfile("Riot Client:1234:xyz:secret_pass")).toBeNull();
    expect(parseLockfile("Riot Client:1234:5678")).toBeNull();
  });
});

describe("RegionResolver", () => {
  it("computes shardOf with region overrides", () => {
    expect(shardOf("na")).toBe("na");
    expect(shardOf("eu")).toBe("eu");
    expect(shardOf("ap")).toBe("ap");
    expect(shardOf("kr")).toBe("kr");
    expect(shardOf("pbe")).toBe("pbe");
    expect(shardOf("latam")).toBe("na");
    expect(shardOf("br")).toBe("na");
    expect(shardOf("LATAM")).toBe("na");
  });

  it("parses region and shard from ShooterGame.log", () => {
    const logContent = `
[2026.03.20-10.00.00:000][  0]LogInit: Display: Running engine
[2026.03.20-10.00.01:000][  0]LogNet: CI: https://glz-latam-1.na.a.pvp.net/session/v1/sessions
`;
    const resolved = parseRegionFromLog(logContent);
    expect(resolved).toEqual({ region: "latam", shard: "na" });
  });

  it("returns null when log has no glz endpoint match", () => {
    expect(parseRegionFromLog("some random log without url")).toBeNull();
  });

  it("resolves region from primary external-sessions when available", async () => {
    const fakeApi = {
      valorantSession: async () => ({ region: "eu", shard: "eu" }),
    };
    const result = await resolveRegion(fakeApi, () => "https://glz-na-1.na.a.pvp.net");
    expect(result).toEqual({ region: "eu", shard: "eu" });
  });

  it("falls back to log when external-sessions returns null", async () => {
    const fakeApi = {
      valorantSession: async () => null,
    };
    const logText = "https://glz-ap-1.ap.a.pvp.net";
    const result = await resolveRegion(fakeApi, () => logText);
    expect(result).toEqual({ region: "ap", shard: "ap" });
  });

  it("throws RegionUnknownError when both sources fail", async () => {
    const fakeApi = {
      valorantSession: async () => null,
    };
    await expect(resolveRegion(fakeApi, () => null)).rejects.toThrow(RegionUnknownError);
  });
});

describe("RiotClientLocalApi", () => {
  it("parses external-sessions arguments successfully", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        "session-1": {
          productId: "valorant",
          launchConfiguration: {
            arguments: ["-ares-deployment=latam", "-config-endpoint=https://shared.na.a.pvp.net"],
          },
        },
      }),
      text: async () => "",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
    });

    const session = await api.valorantSession();
    expect(session).toEqual({ region: "latam", shard: "na" });
  });

  it("retries on 'Entitlements token is not ready yet' and succeeds", async () => {
    let calls = 0;
    const mockFetch = async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 400,
          json: async () => ({}),
          text: async () => "Entitlements token is not ready yet",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: "mock-access",
          token: "mock-jwt",
          subject: "mock-puuid",
        }),
        text: async () => "",
      };
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    const token = await api.entitlementsToken();
    expect(calls).toBe(2);
    expect(token).toEqual({
      accessToken: "mock-access",
      token: "mock-jwt",
      subject: "mock-puuid",
    });
  });

  it("throws RiotClientNotRunningError when connection is refused", async () => {
    const connRefusedError = new Error("connect ECONNREFUSED 127.0.0.1:5678");
    (connRefusedError as { code?: string }).code = "ECONNREFUSED";

    const mockFetch = async () => {
      throw connRefusedError;
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    await expect(api.entitlementsToken()).rejects.toThrow(RiotClientNotRunningError);
  });

  it("throws RiotClientNotReadyError when retries are exhausted", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => "Invalid URI format",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    await expect(api.entitlementsToken()).rejects.toThrow(RiotClientNotReadyError);
  });

  it("returns parsed JSON on get with status 200", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ test: "data" }),
      text: async () => "",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
    });

    const res = await api.get<{ test: string }>("/chat/v4/friends");
    expect(res).toEqual({ test: "data" });
  });

  it("returns null on get when response is 404 without retrying", async () => {
    let calls = 0;
    const mockFetch = async () => {
      calls++;
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => "Not Found",
      };
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    const res = await api.get("/chat/v6/messages?cid=missing");
    expect(res).toBeNull();
    expect(calls).toBe(1);
  });

  it("retries on get when receiving 503 and succeeds", async () => {
    let calls = 0;
    const mockFetch = async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          json: async () => ({}),
          text: async () => "Service Unavailable",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ready: true }),
        text: async () => "",
      };
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    const res = await api.get<{ ready: boolean }>("/chat/v4/presences");
    expect(calls).toBe(2);
    expect(res).toEqual({ ready: true });
  });

  it("throws RiotClientNotRunningError on get when connection refused", async () => {
    const connRefusedError = new Error("connect ECONNREFUSED 127.0.0.1:5678");
    (connRefusedError as { code?: string }).code = "ECONNREFUSED";

    const mockFetch = async () => {
      throw connRefusedError;
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    await expect(api.get("/chat/v4/friends")).rejects.toThrow(RiotClientNotRunningError);
  });

  it("throws RiotClientNotReadyError on get when retries are exhausted", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "Internal Server Error",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    await expect(api.get("/chat/v4/friends")).rejects.toThrow(RiotClientNotReadyError);
  });

  it("sends POST with body, json header, auth header and returns parsed JSON", async () => {
    let capturedUrl = "";
    let capturedInit: unknown;

    const mockFetch = async (url: string, init?: unknown) => {
      capturedUrl = url;
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "msg-123" }),
        text: async () => JSON.stringify({ id: "msg-123" }),
      };
    };

    const api = new RiotClientLocalApi(5678, "secret_pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
    });

    const res = await api.post<{ id: string }>("/chat/v6/messages", {
      cid: "c1",
      message: "hello",
    });

    expect(res).toEqual({ id: "msg-123" });
    expect(capturedUrl).toBe("https://127.0.0.1:5678/chat/v6/messages");
    const typedInit = capturedInit as {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
    expect(typedInit.method).toBe("POST");
    expect(typedInit.headers["Content-Type"]).toBe("application/json");
    expect(typedInit.headers.Authorization).toBe(
      `Basic ${Buffer.from("riot:secret_pass").toString("base64")}`,
    );
    expect(typedInit.body).toBe(JSON.stringify({ cid: "c1", message: "hello" }));
  });

  it("sends DELETE with body and auth header", async () => {
    let capturedInit: unknown;

    const mockFetch = async (_url: string, init?: unknown) => {
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      };
    };

    const api = new RiotClientLocalApi(5678, "secret_pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
    });

    const res = await api.delete("/chat/v4/friends", { puuid: "p1" });
    expect(res).toEqual({});
    const typedInit = capturedInit as {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
    expect(typedInit.method).toBe("DELETE");
    expect(typedInit.headers.Authorization).toBe(
      `Basic ${Buffer.from("riot:secret_pass").toString("base64")}`,
    );
    expect(typedInit.body).toBe(JSON.stringify({ puuid: "p1" }));
  });

  it("throws RiotApiError on non-2xx status for post and delete", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => "Bad Request",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
      sleepFn: async () => {},
    });

    await expect(api.post("/chat/v4/blocked", { puuid: "p1" })).rejects.toThrow(RiotApiError);
    await expect(api.delete("/chat/v4/blocked", { puuid: "p1" })).rejects.toThrow(RiotApiError);
  });

  it("retries on 503 during warm-up for post and succeeds", async () => {
    let calls = 0;
    const mockFetch = async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          json: async () => ({}),
          text: async () => "Service Unavailable",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
        text: async () => JSON.stringify({ success: true }),
      };
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
      sleepFn: async () => {},
    });

    const res = await api.post<{ success: boolean }>("/chat/v4/friendrequests", { puuid: "p1" });
    expect(calls).toBe(2);
    expect(res).toEqual({ success: true });
  });

  it("throws RiotClientNotRunningError on post when connection refused", async () => {
    const connRefusedError = new Error("connect ECONNREFUSED 127.0.0.1:5678");
    (connRefusedError as { code?: string }).code = "ECONNREFUSED";

    const mockFetch = async () => {
      throw connRefusedError;
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
      sleepFn: async () => {},
    });

    await expect(api.post("/chat/v6/messages", {})).rejects.toThrow(RiotClientNotRunningError);
  });

  it("extracts gameAuthorization from external-sessions launch arguments", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        "session-val": {
          productId: "valorant",
          launchConfiguration: {
            arguments: [
              "-ares-deployment=na",
              "-remoting-auth-token=secret-game-token",
              "-app-port=1234",
            ],
          },
        },
      }),
      text: async () => "",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
    });

    const auth = await api.gameAuthorization();
    const expected = `Basic ${Buffer.from("riot:secret-game-token").toString("base64")}`;
    expect(auth).toBe(expected);
  });

  it("returns null for gameAuthorization when Valorant is not running", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        "session-other": {
          productId: "league_of_legends",
        },
      }),
      text: async () => "",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
    });

    const auth = await api.gameAuthorization();
    expect(auth).toBeNull();
  });

  it("sends PUT request with custom Authorization header", async () => {
    let capturedHeaders: Record<string, string> = {};
    const mockFetch = async (
      _url: string,
      init?: { headers?: Record<string, string>; method?: string },
    ) => {
      capturedHeaders = init?.headers ?? {};
      return {
        ok: true,
        status: 200,
        json: async () => ({ updated: true }),
        text: async () => JSON.stringify({ updated: true }),
      };
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
    });

    const res = await api.put<{ updated: boolean }>(
      "/player-preferences/v1/data-json/Ares.PlayerSettings",
      { data: {} },
      { Authorization: "Basic custom-auth" },
    );

    expect(res).toEqual({ updated: true });
    expect(capturedHeaders.Authorization).toBe("Basic custom-auth");
  });
});

describe("gamePodRegion", () => {
  it("reads the region out of a game pod id", () => {
    expect(gamePodRegion("aresriot.aws-scl1-prod.latam-gp-santiago-1")).toBe("latam");
    expect(gamePodRegion("aresriot.aws-sae1-prod.br-gp-saopaulo-1")).toBe("br");
    expect(gamePodRegion("aresriot.aws-scl1-prod.XX-gp-mars-1")).toBe("xx");
  });

  it("is null when the id has no region", () => {
    expect(gamePodRegion("nothing-useful")).toBeNull();
    expect(gamePodRegion(undefined)).toBeNull();
  });
});
