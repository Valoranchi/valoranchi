import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { MatchesApi } from "../src/client/api.js";
import type { ClientContext } from "../src/client/ClientContext.js";
import { StoreService } from "../src/client/StoreService.js";
import {
  ForbiddenHostError,
  RiotApiError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
  ValidationError,
} from "../src/errors.js";
import { TypedEmitter } from "../src/events/TypedEmitter.js";
import type { RiotEventMap, RiotEvents } from "../src/events/RiotEvents.js";
import type { RiotClient } from "../src/RiotClient.js";
import { createRiotServer, isLoopback } from "../src/serve/index.js";
import type { ServerInstance } from "../src/serve/types.js";
import { MatchWatcher, FriendsWatcher } from "../src/watch/index.js";

function requestHttp(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method ?? "GET",
        headers: options.headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString("utf-8");
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data });
        });
      },
    );
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

describe("Serve Mode", () => {
  let serverInstance: ServerInstance;
  let testPort: number;

  const fakeEventsEmitter = new TypedEmitter<RiotEventMap>();
  const fakeEvents = fakeEventsEmitter as unknown as RiotEvents;
  fakeEvents.start = vi.fn().mockReturnValue(fakeEvents);
  fakeEvents.stop = vi.fn();

  const mockWhoami = vi.fn().mockResolvedValue({
    puuid: "self-puuid",
    gameName: "Tester",
    tagLine: "NA1",
    region: "na",
  });

  const mockFriends = vi
    .fn()
    .mockResolvedValue([{ puuid: "f-1", gameName: "FriendOne", tagLine: "001" }]);

  const mockListMatches = vi.fn().mockResolvedValue([{ id: "m-1", queue: "competitive" }]);

  const mockValidateEquip = vi.fn().mockResolvedValue({ valid: true });
  const mockEquip = vi.fn().mockResolvedValue({ Subject: "p-1", Version: 2 });

  const mockValidateDodge = vi.fn().mockResolvedValue({ method: "POST", path: "/dodge" });
  const mockDodge = vi.fn().mockResolvedValue({ dodged: true, matchId: "m-dodge" });

  const catalogueData = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData;
  const fixtureCatalogue = new Catalogue(catalogueData);
  const fixtureStoreService = new StoreService({
    catalogue: async () => fixtureCatalogue,
  } as unknown as ClientContext);

  const fakeClient = {
    account: {
      whoami: mockWhoami,
      validateEquip: mockValidateEquip,
      equip: mockEquip,
      validateSaveSettings: vi.fn().mockResolvedValue({}),
      saveSettings: vi.fn().mockResolvedValue({}),
    },
    social: {
      friends: mockFriends,
    },
    store: {
      current: vi.fn().mockResolvedValue({ daily: null }),
      validateBuy: vi.fn().mockResolvedValue({ valid: true }),
      buy: vi.fn().mockResolvedValue({ id: "order-1" }),
      wishlist: vi.fn().mockResolvedValue({ skins: [] }),
      wishlistCheck: vi.fn().mockResolvedValue({ checkedAt: "now", hits: [] }),
      wishlistAdd: vi
        .fn()
        .mockResolvedValue({ skins: [{ uuid: "s1", name: "Prime Vandal", addedAt: "now" }] }),
      wishlistRemove: vi.fn().mockResolvedValue({ skins: [] }),
      skins: vi.fn().mockImplementation(() => fixtureStoreService.skins()),
    },
    matches: {
      list: mockListMatches,
      validateDodge: mockValidateDodge,
      dodge: mockDodge,
      validateLeaveMatch: vi.fn().mockResolvedValue({}),
      leaveMatch: vi.fn().mockResolvedValue({ left: true }),
      live: vi.fn().mockResolvedValue({ phase: "none" }),
    },
    party: {
      current: vi.fn().mockResolvedValue({ id: "party-1" }),
    },
    events: () => fakeEvents,
    watch: {
      match: () => new MatchWatcher(fakeEvents, fakeClient.matches as unknown as MatchesApi),
      friends: () => new FriendsWatcher(fakeEvents),
    },
    close: vi.fn(),
  } as unknown as RiotClient;

  beforeAll(async () => {
    testPort = 48912;
    serverInstance = await createRiotServer(fakeClient, {
      port: testPort,
      host: "127.0.0.1",
    });
  });

  afterAll(async () => {
    await serverInstance.close();
  });

  it("checks loopback detection", () => {
    expect(isLoopback("127.0.0.1")).toBe(true);
    expect(isLoopback("localhost")).toBe(true);
    expect(isLoopback("::1")).toBe(true);
    expect(isLoopback("127.0.0.99")).toBe(true);
    expect(isLoopback("192.168.1.1")).toBe(false);
    expect(isLoopback("0.0.0.0")).toBe(false);
  });

  it("refuses to bind non-loopback host without allowRemote", async () => {
    await expect(
      createRiotServer(fakeClient, { port: 48999, host: "192.168.1.100", allowRemote: false }),
    ).rejects.toThrow(ForbiddenHostError);
  });

  it("serves dashboard HTML on GET / with CSP header", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.body).toContain("Valoranchi Dashboard");
  });

  it("serves dashboard assets with correct content types and CSP headers", async () => {
    const resCss = await requestHttp(`http://127.0.0.1:${testPort}/dashboard.css`);
    expect(resCss.status).toBe(200);
    expect(resCss.headers["content-type"]).toBe("text/css; charset=utf-8");
    expect(resCss.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(resCss.headers["x-content-type-options"]).toBe("nosniff");

    const resJs = await requestHttp(`http://127.0.0.1:${testPort}/dashboard.js`);
    expect(resJs.status).toBe(200);
    expect(resJs.headers["content-type"]).toBe("application/javascript; charset=utf-8");
    expect(resJs.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(resJs.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("serves API route list on GET /api", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Valoranchi Riot Client API");
    expect(res.body).toContain("/openapi.json");
    expect(res.body).toContain("/events");
  });

  it("returns only purchasable skins from fixture catalogue on GET /api/store/skins", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/store/skins`);
    expect(res.status).toBe(200);
    const skins = JSON.parse(res.body) as Array<{
      uuid: string;
      name: string;
      weapon: string;
      icon: string | null;
      tier: unknown;
    }>;
    expect(skins.length).toBeGreaterThan(0);
    expect(skins.some((s) => s.name === "Prime Vandal")).toBe(true);
    expect(skins.some((s) => s.name === "Standard Vandal")).toBe(false);
    expect(skins[0].weapon).toBe("Vandal");
  });

  it("serves OpenAPI 3.0 specification on GET /openapi.json", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/openapi.json`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    const parsed = JSON.parse(res.body) as { openapi: string; paths: Record<string, unknown> };
    expect(parsed.openapi).toBe("3.0.3");
    expect(parsed.paths["/api/account/whoami"]).toBeDefined();
    expect(parsed.paths["/api/matches/dodge"]).toBeDefined();
    expect(parsed.paths["/events"]).toBeDefined();
  });

  it("dispatches GET read requests to namespace methods", async () => {
    const resWhoami = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`);
    expect(resWhoami.status).toBe(200);
    expect(JSON.parse(resWhoami.body)).toEqual({
      puuid: "self-puuid",
      gameName: "Tester",
      tagLine: "NA1",
      region: "na",
    });

    const resMatches = await requestHttp(
      `http://127.0.0.1:${testPort}/api/matches/list?count=5&queue=competitive`,
    );
    expect(resMatches.status).toBe(200);
    expect(mockListMatches).toHaveBeenCalledWith({ count: 5, queue: "competitive" });
  });

  it("defaults to dry-run for writes without dryRun=0", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/account/equip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card: "card-123" }),
    });

    expect(res.status).toBe(200);
    expect(mockValidateEquip).toHaveBeenCalledWith({ card: "card-123" });
    expect(mockEquip).not.toHaveBeenCalled();
  });

  it("executes actual write when dryRun=0", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/account/equip?dryRun=0`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card: "card-123" }),
    });

    expect(res.status).toBe(200);
    expect(mockEquip).toHaveBeenCalledWith({ card: "card-123" });
  });

  it("enforces confirmation for confirm-gated routes when dryRun=0", async () => {
    // Missing X-Confirm and body confirm -> 400 validation error
    const resMissing = await requestHttp(
      `http://127.0.0.1:${testPort}/api/matches/dodge?dryRun=0`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(resMissing.status).toBe(400);
    const parsedErr = JSON.parse(resMissing.body);
    expect(parsedErr.error.code).toBe("VALIDATION");
    expect(parsedErr.error.reason).toBe("confirm-required");

    // With confirmation header and body -> 200 success
    const resConfirmed = await requestHttp(
      `http://127.0.0.1:${testPort}/api/matches/dodge?dryRun=0`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Confirm": "yes",
        },
        body: JSON.stringify({ confirm: true }),
      },
    );

    expect(resConfirmed.status).toBe(200);
    expect(mockDodge).toHaveBeenCalled();
  });

  it("maps error types to appropriate HTTP status codes", async () => {
    mockWhoami.mockRejectedValueOnce(new RiotClientNotRunningError());
    const res503 = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`);
    expect(res503.status).toBe(503);

    mockWhoami.mockRejectedValueOnce(new RiotClientNotReadyError());
    const res503Ready = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`);
    expect(res503Ready.status).toBe(503);

    mockWhoami.mockRejectedValueOnce(new ValidationError("invalid-param", "Invalid"));
    const res400 = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`);
    expect(res400.status).toBe(400);

    mockWhoami.mockRejectedValueOnce(new RiotApiError(403, "https://127.0.0.1/test"));
    const res502 = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`);
    expect(res502.status).toBe(502);

    mockWhoami.mockRejectedValueOnce(new Error("Database crash"));
    const res500 = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`);
    expect(res500.status).toBe(500);
  });

  it("dispatches wishlist routes", async () => {
    const getWishlist = await requestHttp(`http://127.0.0.1:${testPort}/api/store/wishlist`);
    expect(getWishlist.status).toBe(200);

    const checkWishlist = await requestHttp(`http://127.0.0.1:${testPort}/api/store/wishlistCheck`);
    expect(checkWishlist.status).toBe(200);

    const addWishlist = await requestHttp(`http://127.0.0.1:${testPort}/api/store/wishlistAdd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skin: "Prime Vandal" }),
    });
    expect(addWishlist.status).toBe(200);

    const removeWishlist = await requestHttp(
      `http://127.0.0.1:${testPort}/api/store/wishlistRemove`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skin: "Prime Vandal" }),
      },
    );
    expect(removeWishlist.status).toBe(200);
  });

  it("handles GET /events Server-Sent Events", async () => {
    const ssePromise = new Promise<string>((resolve) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: testPort,
          path: "/events?only=connected,message",
          method: "GET",
        },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-type"]).toBe("text/event-stream");

          let received = "";
          res.on("data", (chunk: Buffer) => {
            received += chunk.toString("utf-8");
            if (received.includes("connected")) {
              req.destroy();
              resolve(received);
            }
          });
        },
      );
      req.end();
    });

    await new Promise((r) => setTimeout(r, 50));
    fakeEventsEmitter.emit("connected");

    const result = await ssePromise;
    expect(result).toContain("event: connected");
  });

  it("rejects POST with foreign Origin with 403 without calling client method", async () => {
    mockEquip.mockClear();
    mockValidateEquip.mockClear();
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/account/equip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ card: "card-123" }),
    });
    expect(res.status).toBe(403);
    const parsed = JSON.parse(res.body);
    expect(parsed.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(mockValidateEquip).not.toHaveBeenCalled();
    expect(mockEquip).not.toHaveBeenCalled();
  });

  it("rejects POST with text/plain with 415", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/account/equip`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ card: "card-123" }),
    });
    expect(res.status).toBe(415);
    const parsed = JSON.parse(res.body);
    expect(parsed.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects request with wrong Host with 403", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`, {
      headers: { Host: "evil.example:48912" },
    });
    expect(res.status).toBe(403);
    const parsed = JSON.parse(res.body);
    expect(parsed.error.code).toBe("FORBIDDEN_HOST");
  });

  it("allows same-origin POST", async () => {
    mockValidateEquip.mockClear();
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/account/equip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `http://127.0.0.1:${testPort}`,
      },
      body: JSON.stringify({ card: "card-123" }),
    });
    expect(res.status).toBe(200);
    expect(mockValidateEquip).toHaveBeenCalled();
  });

  it("allows no-Origin GET", async () => {
    const res = await requestHttp(`http://127.0.0.1:${testPort}/api/account/whoami`);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).gameName).toBe("Tester");
  });
});

