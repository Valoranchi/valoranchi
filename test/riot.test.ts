import { describe, expect, it, vi } from "vitest";
import { Session } from "../src/riot/Session.js";
import { HttpGateway } from "../src/riot/HttpGateway.js";
import { RiotApi } from "../src/riot/RiotApi.js";
import type { FileResponseCache } from "../src/riot/ResponseCache.js";
import { ForbiddenHostError, RiotApiError } from "../src/errors.js";

describe("Session", () => {
  const session = new Session({
    puuid: "puuid-1234",
    accessToken: "access-token-xyz",
    entitlementsToken: "entitlements-jwt-abc",
    region: "latam",
    shard: "na",
    clientVersion: "release-09.00-shipping-123",
  });

  it("constructs endpoints based on region and shard", () => {
    expect(session.endpoints.pd).toBe("https://pd.na.a.pvp.net");
    expect(session.endpoints.glz).toBe("https://glz-latam-1.na.a.pvp.net");
    expect(session.endpoints.shared).toBe("https://shared.na.a.pvp.net");
  });

  it("includes the four required headers and decodes platform JSON", () => {
    const headers = session.headers();
    expect(headers["Authorization"]).toBe("Bearer access-token-xyz");
    expect(headers["X-Riot-Entitlements-JWT"]).toBe("entitlements-jwt-abc");
    expect(headers["X-Riot-ClientVersion"]).toBe("release-09.00-shipping-123");

    const platformRaw = headers["X-Riot-ClientPlatform"];
    expect(platformRaw).toBeDefined();
    const decoded = JSON.parse(Buffer.from(platformRaw, "base64").toString("utf-8"));
    expect(decoded).toEqual({
      platformType: "PC",
      platformOS: "Windows",
      platformOSVersion: "10.0.19042.1.256.64bit",
      platformChipset: "Unknown",
    });
  });
});

describe("HttpGateway", () => {
  it("rejects untrusted host before calling fetch", async () => {
    const mockFetch = vi.fn();
    const gateway = new HttpGateway(mockFetch);

    await expect(gateway.get("https://evil.example/x")).rejects.toThrow(ForbiddenHostError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects token headers sent to valorant-api.com", async () => {
    const mockFetch = vi.fn();
    const gateway = new HttpGateway(mockFetch);

    await expect(
      gateway.get("https://valorant-api.com/v1/version", {
        Authorization: "Bearer secret",
      }),
    ).rejects.toThrow(ForbiddenHostError);

    await expect(
      gateway.get("https://valorant-api.com/v1/version", {
        "X-Riot-Entitlements-JWT": "jwt-secret",
      }),
    ).rejects.toThrow(ForbiddenHostError);

    await expect(
      gateway.get("https://valorant-api.com/v1/version", {
        "X-Riot-Token": "rgapi-secret",
      }),
    ).rejects.toThrow(ForbiddenHostError);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("allows requests to valorant-api.com without auth headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 200, data: { riotClientVersion: "1.0.0" } }), {
        status: 200,
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    const result = await gateway.get<{ status: number }>("https://valorant-api.com/v1/version");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
  });

  it("allows requests to *.pvp.net with auth headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    await gateway.get("https://pd.na.a.pvp.net/store/v1/wallet/123", {
      Authorization: "Bearer secret",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("makes POST requests with serialized body and content-type", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: true }), {
        status: 200,
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    const res = await gateway.post<{ created: boolean }>(
      "https://pd.na.a.pvp.net/store/v3/storefront/123",
      {},
      { Authorization: "Bearer secret" },
    );

    expect(res).toEqual({ created: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/store/v3/storefront/123",
      expect.objectContaining({
        method: "POST",
        body: "{}",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer secret",
        }),
      }),
    );
  });

  it("maps non-2xx responses to RiotApiError with sanitized url", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Not Found", {
        status: 404,
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    const error = await gateway
      .get("https://pd.na.a.pvp.net/store/v1/wallet/123?param=secret")
      .catch((e) => e);

    expect(error).toBeInstanceOf(RiotApiError);
    expect((error as RiotApiError).status).toBe(404);
    expect((error as RiotApiError).url).toBe("https://pd.na.a.pvp.net/store/v1/wallet/123");
  });

  it("extracts retry-after header on rate limit 429", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Rate limited", {
        status: 429,
        headers: { "Retry-After": "7" },
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    const error = await gateway.get("https://americas.api.riotgames.com/test").catch((e) => e);

    expect(error).toBeInstanceOf(RiotApiError);
    expect((error as RiotApiError).status).toBe(429);
    expect((error as RiotApiError).retryAfterSeconds).toBe(7);
  });

  it("returns payload on 200 for getOrNull", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );
    const gateway = new HttpGateway(mockFetch);
    const res = await gateway.getOrNull<{ ok: boolean }>("https://pd.na.a.pvp.net/test");
    expect(res).toEqual({ ok: true });
  });

  it("returns null on 404 for getOrNull", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("not found", {
        status: 404,
      }),
    );
    const gateway = new HttpGateway(mockFetch);
    const res = await gateway.getOrNull("https://pd.na.a.pvp.net/missing");
    expect(res).toBeNull();
  });

  it("rethrows non-404 errors for getOrNull", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("internal error", {
        status: 500,
      }),
    );
    const gateway = new HttpGateway(mockFetch);
    await expect(gateway.getOrNull("https://pd.na.a.pvp.net/error")).rejects.toThrow(RiotApiError);
  });

  it("makes DELETE requests and handles empty body responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    const gateway = new HttpGateway(mockFetch);

    const res = await gateway.delete<unknown>("https://pd.na.a.pvp.net/item/123", {
      Authorization: "Bearer secret",
    });

    expect(res).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/item/123",
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: "Bearer secret" },
      }),
    );
  });
});

describe("RiotApi", () => {
  const session = new Session({
    puuid: "puuid-1234",
    accessToken: "access-token-xyz",
    entitlementsToken: "entitlements-jwt-abc",
    region: "latam",
    shard: "na",
    clientVersion: "release-09.00-shipping-123",
  });

  it("calls entitlements endpoint with session headers and puuid", async () => {
    const mockGet = vi.fn().mockResolvedValue({ EntitlementsByTypes: [] });
    const fakeGateway = {
      get: mockGet,
      put: vi.fn(),
      post: vi.fn(),
    } as unknown as HttpGateway;

    const api = new RiotApi(fakeGateway, session);
    await api.entitlements();

    expect(mockGet).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/store/v1/entitlements/puuid-1234",
      expect.objectContaining({
        Authorization: "Bearer access-token-xyz",
      }),
    );
  });

  it("authenticates the shared config and content requests", async () => {
    const mockGet = vi.fn().mockResolvedValue({});
    const fakeGateway = { get: mockGet, put: vi.fn(), post: vi.fn() } as unknown as HttpGateway;

    const api = new RiotApi(fakeGateway, session);
    await api.clientConfig();
    await api.content();

    const auth = expect.objectContaining({ Authorization: "Bearer access-token-xyz" });
    expect(mockGet).toHaveBeenCalledWith("https://shared.na.a.pvp.net/v1/config/latam", auth);
    expect(mockGet).toHaveBeenCalledWith(
      "https://shared.na.a.pvp.net/content-service/v3/content",
      auth,
    );
  });

  it("calls storefront endpoint with POST and empty object", async () => {
    const mockPost = vi.fn().mockResolvedValue({ SkinsPanelLayout: {} });
    const fakeGateway = {
      get: vi.fn(),
      put: vi.fn(),
      post: mockPost,
    } as unknown as HttpGateway;

    const api = new RiotApi(fakeGateway, session);
    const res = await api.storefront();

    expect(res).toEqual({ SkinsPanelLayout: {} });
    expect(mockPost).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/store/v3/storefront/puuid-1234",
      {},
      expect.objectContaining({
        Authorization: "Bearer access-token-xyz",
      }),
    );
  });

  it("calls names endpoint with PUT and puuids array", async () => {
    const mockPut = vi
      .fn()
      .mockResolvedValue([{ Subject: "puuid-1234", GameName: "Jett", TagLine: "1234" }]);
    const fakeGateway = {
      get: vi.fn(),
      put: mockPut,
      post: vi.fn(),
    } as unknown as HttpGateway;

    const api = new RiotApi(fakeGateway, session);
    const names = await api.names(["puuid-1234"]);

    expect(mockPut).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/name-service/v2/players",
      ["puuid-1234"],
      expect.objectContaining({
        Authorization: "Bearer access-token-xyz",
      }),
    );
    expect(names[0].GameName).toBe("Jett");
  });

  it("calls matchHistory with pagination and optional queue", async () => {
    const mockGet = vi.fn().mockResolvedValue({ History: [] });
    const fakeGateway = { get: mockGet } as unknown as HttpGateway;
    const api = new RiotApi(fakeGateway, session);

    await api.matchHistory(0, 20, "competitive");
    expect(mockGet).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/match-history/v1/history/puuid-1234?startIndex=0&endIndex=20&queue=competitive",
      expect.any(Object),
    );
  });

  it("calls matchDetails and caches with long TTL", async () => {
    const mockGet = vi.fn().mockResolvedValue({ matchInfo: { matchId: "m1" } });
    const fakeGateway = { get: mockGet } as unknown as HttpGateway;
    const mockCache = {
      through: vi.fn().mockImplementation((_k, fetcher) => fetcher()),
    } as unknown as FileResponseCache;

    const api = new RiotApi(fakeGateway, session, mockCache);
    await api.matchDetails("m1");

    expect(mockCache.through).toHaveBeenCalledWith("matchDetails m1", expect.any(Function), {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
    });
    expect(mockGet).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/match-details/v1/matches/m1",
      expect.any(Object),
    );
  });

  it("calls mmr and competitiveUpdates endpoints", async () => {
    const mockGet = vi.fn().mockResolvedValue({});
    const fakeGateway = { get: mockGet } as unknown as HttpGateway;
    const api = new RiotApi(fakeGateway, session);

    await api.mmr("other-puuid");
    expect(mockGet).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/mmr/v1/players/other-puuid",
      expect.any(Object),
    );

    await api.competitiveUpdates(0, 10, "competitive");
    expect(mockGet).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/mmr/v1/players/puuid-1234/competitiveupdates?startIndex=0&endIndex=10&queue=competitive",
      expect.any(Object),
    );
  });

  it("calls pregame, coreGame, and party endpoints on glz", async () => {
    const mockGet = vi.fn().mockResolvedValue({});
    const mockGetOrNull = vi.fn().mockResolvedValue(null);
    const fakeGateway = { get: mockGet, getOrNull: mockGetOrNull } as unknown as HttpGateway;
    const api = new RiotApi(fakeGateway, session);

    await api.pregamePlayer();
    expect(mockGetOrNull).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/pregame/v1/players/puuid-1234",
      expect.any(Object),
    );

    await api.pregameMatch("pre-1");
    expect(mockGet).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/pregame/v1/matches/pre-1",
      expect.any(Object),
    );

    await api.coreGamePlayer();
    expect(mockGetOrNull).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/core-game/v1/players/puuid-1234",
      expect.any(Object),
    );

    await api.coreGameMatch("core-1");
    expect(mockGet).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/core-game/v1/matches/core-1",
      expect.any(Object),
    );

    await api.coreGameLoadouts("core-1");
    expect(mockGet).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/core-game/v1/matches/core-1/loadouts",
      expect.any(Object),
    );

    await api.partyPlayer();
    expect(mockGetOrNull).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/players/puuid-1234",
      expect.any(Object),
    );

    await api.party("party-1");
    expect(mockGet).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/party-1",
      expect.any(Object),
    );
  });

  it("calls party write endpoints with correct methods, paths, and payloads", async () => {
    const mockPost = vi.fn().mockResolvedValue({});
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const fakeGateway = { post: mockPost, delete: mockDelete } as unknown as HttpGateway;
    const api = new RiotApi(fakeGateway, session);

    await api.inviteToParty("p1", "Jett", "1234");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/invites/name/Jett/tag/1234",
      undefined,
      expect.any(Object),
    );

    await api.createPartyInviteCode("p1");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/invitecode",
      undefined,
      expect.any(Object),
    );

    await api.revokePartyInviteCode("p1");
    expect(mockDelete).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/invitecode",
      expect.any(Object),
    );

    await api.joinPartyByCode("ABC123");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/players/joinbycode/ABC123",
      undefined,
      expect.any(Object),
    );

    await api.kickFromParty("p1", "target-puuid");
    expect(mockDelete).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/members/target-puuid",
      expect.any(Object),
    );

    await api.promotePartyMember("p1", "target-puuid");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/members/target-puuid/owner",
      undefined,
      expect.any(Object),
    );

    await api.setPartyReady("p1", "target-puuid", true);
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/members/target-puuid/setReady",
      { ready: true },
      expect.any(Object),
    );

    await api.setPartyQueue("p1", "competitive");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/queue",
      { queueID: "competitive" },
      expect.any(Object),
    );

    await api.setPartyAccessibility("p1", "OPEN");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/accessibility",
      { accessibility: "OPEN" },
      expect.any(Object),
    );

    await api.startPartyMatchmaking("p1");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/matchmaking/join",
      undefined,
      expect.any(Object),
    );

    await api.stopPartyMatchmaking("p1");
    expect(mockPost).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/parties/p1/matchmaking/leave",
      undefined,
      expect.any(Object),
    );

    await api.leaveParty("self-puuid");
    expect(mockDelete).toHaveBeenCalledWith(
      "https://glz-latam-1.na.a.pvp.net/parties/v1/players/self-puuid",
      expect.any(Object),
    );
  });

  it("maps a fetch timeout to RiotApiError 408", async () => {
    const gateway = new HttpGateway(async () => {
      throw new DOMException("aborted", "TimeoutError");
    });
    const error = await gateway.get("https://pd.na.a.pvp.net/x?y=1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RiotApiError);
    expect((error as RiotApiError).status).toBe(408);
    expect((error as RiotApiError).url).toBe("https://pd.na.a.pvp.net/x");
  });
});
