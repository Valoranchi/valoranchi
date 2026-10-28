import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { AccountService } from "../src/client/AccountService.js";
import type { ClientContext } from "../src/client/ClientContext.js";
import { RiotApiError, RiotClientNotRunningError, ValidationError } from "../src/errors.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";
import { PreferenceCodec } from "../src/riot/PreferenceCodec.js";
import { RiotApi } from "../src/riot/RiotApi.js";
import { Session } from "../src/riot/Session.js";

const PD = "https://pd.na.a.pvp.net";
const PUUID = "11111111-2222-4333-8444-555555555555";
const MATCH = "ec8f25d1-075d-45e5-84ae-ef3891b73827";

const PLAYER_PATH = `/bloomline/v0/players/${PUUID}`;
const MASTERY_MATCH_PATH = `${PLAYER_PATH}/matches/${MATCH}`;
const CONTRACTS_MATCH_PATH = `/contracts/v1/players/${PUUID}/matches/${MATCH}`;
const TICKET_PATH = `/daily-ticket/v1/${PUUID}`;
const QUEUE_CONFIG_PATH = "/daily-ticket/v1/queue-config";

function fixture(name: string): unknown {
  const file = path.join(import.meta.dirname, "fixtures", "progression", `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

const catalogue = new Catalogue(
  JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData,
);

function notFound(requestPath: string): RiotApiError {
  return new RiotApiError(404, `${PD}${requestPath}`);
}

function createService(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    [PLAYER_PATH]: fixture("bloomlinePlayer"),
    [MASTERY_MATCH_PATH]: fixture("bloomlineMatchNoBonus"),
    [CONTRACTS_MATCH_PATH]: fixture("contractsMatch"),
    [TICKET_PATH]: fixture("dailyTicket"),
    [QUEUE_CONFIG_PATH]: fixture("dailyTicketQueueConfig"),
    ...overrides,
  };
  const get = vi.fn(async (url: string) => {
    const response = responses[url.slice(PD.length)];
    if (response === undefined) throw new Error(`Unexpected request to ${url}`);
    if (response instanceof Error) throw response;
    return response;
  });
  const session = new Session({
    puuid: PUUID,
    accessToken: "token",
    entitlementsToken: "jwt",
    region: "latam",
    shard: "na",
    clientVersion: "release-1.0",
  });
  const api = new RiotApi({ get } as unknown as HttpGateway, session);
  const context: ClientContext = {
    language: "en-US",
    sessions: { session: async () => session } as never,
    valorantApi: {} as never,
    api: () => api,
    catalogue: async () => catalogue,
    player: () => ({}) as never,
  };
  return { service: new AccountService(context), get };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AccountService agent mastery", () => {
  it("lists the mastery of every agent from the most points to the least", async () => {
    const { service } = createService();

    const mastery = await service.agentMastery();

    expect(mastery).toHaveLength(29);
    expect(mastery[0]).toMatchObject({ agentName: "Phoenix", points: 5969 });
    expect(mastery.at(-1)?.points).toBe(0);
  });
});

describe("AccountService.matchProgress", () => {
  it("combines the mastery, the contract grants and the daily ticket of a match", async () => {
    const { service } = createService();

    const progress = await service.matchProgress(MATCH);

    expect(progress.matchId).toBe(MATCH);
    expect(progress.agentMastery).toMatchObject({ agentName: "Phoenix", earned: 2017 });
    expect(progress.contracts?.xp.total).toBe(2500);
    expect(progress.daily).toEqual({
      progressBefore: 0,
      progressAfter: 4,
      xp: 2000,
      kingdomCredits: 300,
    });
  });

  it("asks Riot for the progression of the match with the lowercase id", async () => {
    const { service, get } = createService();

    const progress = await service.matchProgress(MATCH.toUpperCase());

    expect(progress.matchId).toBe(MATCH);
    expect(get.mock.calls.map(([url]) => url.slice(PD.length)).sort()).toEqual(
      [MASTERY_MATCH_PATH, CONTRACTS_MATCH_PATH, TICKET_PATH].sort(),
    );
  });

  it("returns no mastery when Riot has no mastery for the match", async () => {
    const { service } = createService({ [MASTERY_MATCH_PATH]: notFound(MASTERY_MATCH_PATH) });

    const progress = await service.matchProgress(MATCH);

    expect(progress.agentMastery).toBeNull();
    expect(progress.contracts).not.toBeNull();
    expect(progress.daily).not.toBeNull();
  });

  it("returns no contract grants when Riot has none for the match", async () => {
    const { service } = createService({ [CONTRACTS_MATCH_PATH]: notFound(CONTRACTS_MATCH_PATH) });

    const progress = await service.matchProgress(MATCH);

    expect(progress.contracts).toBeNull();
    expect(progress.agentMastery).not.toBeNull();
    expect(progress.daily).not.toBeNull();
  });

  it("still reports the daily progress of a match that is too old for the other two", async () => {
    const { service } = createService({
      [MASTERY_MATCH_PATH]: notFound(MASTERY_MATCH_PATH),
      [CONTRACTS_MATCH_PATH]: notFound(CONTRACTS_MATCH_PATH),
    });

    const progress = await service.matchProgress(MATCH);

    expect(progress).toMatchObject({ agentMastery: null, contracts: null });
    expect(progress.daily?.xp).toBe(2000);
  });

  it("does not hide a failure that is not a missing match", async () => {
    const { service } = createService({
      [MASTERY_MATCH_PATH]: new RiotApiError(500, `${PD}${MASTERY_MATCH_PATH}`),
    });

    await expect(service.matchProgress(MATCH)).rejects.toMatchObject({ status: 500 });
  });

  it.each(["", "not-a-uuid", "../../contracts", `${MATCH}/extra`, MATCH.replaceAll("-", "")])(
    "rejects the match id %j before calling Riot",
    async (matchId) => {
      const { service, get } = createService();

      const error = await service.matchProgress(matchId).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ reason: "invalid-match-id" });
      expect(get).not.toHaveBeenCalled();
    },
  );
});

describe("AccountService.matchProgress without a match id", () => {
  it("answers with a validation error when the HTTP or MCP argument is missing", async () => {
    const { service, get } = createService();

    const error = await service
      .matchProgress(undefined as unknown as string)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ reason: "invalid-match-id" });
    expect(get).not.toHaveBeenCalled();
  });
});

describe("AccountService.dailyCheckpoints", () => {
  it("builds the checkpoints and the queue rules from the ticket", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T22:00:00.000Z"));
    const { service } = createService();

    const daily = await service.dailyCheckpoints();

    expect(daily.checkpoints.map((checkpoint) => checkpoint.progress)).toEqual([4, 4, 4, 0]);
    expect(daily.expiresAt).toBe("2026-10-25T10:49:00.000Z");
    expect(daily.queues.competitive).toEqual({ perRoundWon: true, perMatch: 0 });
    expect(daily.default).toEqual({ perRoundWon: false, perMatch: 0 });
  });
});

describe("AccountService player settings", () => {
  const withoutGame = {
    entitlementsToken: async () => ({ accessToken: "access", token: "jwt", subject: PUUID }),
    gameAuthorization: async () => null,
  };

  function settingsService(localApi: Record<string, unknown>) {
    const context = { sessions: { localApi: () => localApi } } as unknown as ClientContext;
    return new AccountService(context);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the settings from Riot's preferences service while the game is closed", async () => {
    const cloud = { actionMappings: [{ actionName: "Fire", key: "Mouse1", bindIndex: 1 }] };
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ data: PreferenceCodec.encode(cloud) })),
    );

    const settings = await settingsService(withoutGame).settings();

    expect(settings.binds).toEqual([
      {
        command: "Fire",
        key: "Mouse1",
        alt: false,
        ctrl: false,
        shift: false,
        agent: null,
        slot: 1,
      },
    ]);
    expect(settings.raw).toEqual(cloud);
  });

  it("saves through the service and answers the settings it reads back", async () => {
    let stored: Record<string, unknown> = { actionMappings: [] };
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") {
        stored = PreferenceCodec.decode((JSON.parse(String(init.body)) as { data: string }).data);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ data: PreferenceCodec.encode(stored) }));
    });
    vi.stubGlobal("fetch", fetchFn);
    const edited = { raw: { actionMappings: [{ actionName: "Jump", key: "Space" }] } };

    const saved = await settingsService(withoutGame).saveSettings(edited, { confirm: true });

    expect(saved.binds.map((bind) => bind.command)).toEqual(["Jump"]);
    expect(fetchFn.mock.calls.map(([, init]) => init?.method)).toEqual(["PUT", "GET"]);
  });

  it("fails with preferences-unavailable when neither the service nor the game answers", async () => {
    const service = settingsService({
      entitlementsToken: async () => {
        throw new RiotClientNotRunningError();
      },
      gameAuthorization: async () => null,
    });

    await expect(service.settings()).rejects.toMatchObject({ reason: "preferences-unavailable" });
    await expect(service.saveSettings({}, { confirm: true })).rejects.toMatchObject({
      reason: "preferences-unavailable",
    });
  });

  it("still asks for confirmation before it reaches for any source", async () => {
    const service = settingsService({});

    await expect(service.saveSettings({}, {})).rejects.toMatchObject({
      reason: "confirm-required",
    });
  });
});
