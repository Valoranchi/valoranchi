import { deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { RiotApiError, RiotClientNotRunningError } from "../src/errors.js";
import { PlayerPreferencesApi } from "../src/local/PlayerPreferencesApi.js";
import type { RiotClientLocalApi } from "../src/local/RiotClientLocalApi.js";
import type { HttpFetchFn } from "../src/riot/HttpGateway.js";
import { PreferenceCodec } from "../src/riot/PreferenceCodec.js";

const HOST = "https://usw2.pp.sgp.pvp.net";
const LOCAL_PATH = "/player-preferences/v1/data-json/Ares.PlayerSettings";
const SETTINGS = { actionMappings: [{ actionName: "Fire", key: "Mouse1" }], boolSettings: [] };
const CREDENTIALS = { Authorization: "Bearer access", "X-Riot-Entitlements-JWT": "jwt" };

function localApi(overrides: Record<string, unknown> = {}) {
  return {
    entitlementsToken: vi
      .fn()
      .mockResolvedValue({ accessToken: "access", token: "jwt", subject: "me" }),
    gameAuthorization: vi.fn().mockResolvedValue("Basic game"),
    get: vi.fn().mockResolvedValue({ type: "Ares.PlayerSettings", modified: 1, data: SETTINGS }),
    put: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function preferences(local: ReturnType<typeof localApi>, fetchFn: HttpFetchFn) {
  return new PlayerPreferencesApi(local as unknown as RiotClientLocalApi, { fetchFn });
}

const packed = (settings: Record<string, unknown>) =>
  new Response(JSON.stringify({ data: PreferenceCodec.encode(settings) }));

const serving = (response: () => Response) => vi.fn<HttpFetchFn>(async () => response());

describe("PlayerPreferencesApi.read", () => {
  it("reads the settings from Riot's preferences service first", async () => {
    const local = localApi();
    const fetchFn = serving(() => packed(SETTINGS));

    const result = await preferences(local, fetchFn).read();

    expect(result).toEqual({ data: SETTINGS, source: "service" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      `${HOST}/playerPref/v3/getPreference/Ares.PlayerSettings`,
      expect.objectContaining({ method: "GET", headers: CREDENTIALS }),
    );
    expect(local.get).not.toHaveBeenCalled();
  });

  it("asks for the preference type it is given", async () => {
    const fetchFn = serving(() => packed(SETTINGS));

    await preferences(localApi(), fetchFn).read("Ares.Other");

    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${HOST}/playerPref/v3/getPreference/Ares.Other`);
  });

  it("falls back to the game when the service answers an error status", async () => {
    const local = localApi();
    const fetchFn = serving(() => new Response("unavailable", { status: 503 }));

    const result = await preferences(local, fetchFn).read();

    expect(result).toEqual({ data: SETTINGS, source: "game" });
    expect(local.get).toHaveBeenCalledWith(LOCAL_PATH, { Authorization: "Basic game" });
  });

  it("falls back to the game when the request to the service fails", async () => {
    const fetchFn = vi.fn<HttpFetchFn>().mockRejectedValue(new TypeError("fetch failed"));

    const result = await preferences(localApi(), fetchFn).read();

    expect(result?.source).toBe("game");
  });

  it("falls back to the game when the Riot Client has no credentials to give", async () => {
    const local = localApi({
      entitlementsToken: vi.fn().mockRejectedValue(new RiotClientNotRunningError()),
    });
    const fetchFn = serving(() => packed(SETTINGS));

    const result = await preferences(local, fetchFn).read();

    expect(result?.source).toBe("game");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ["is not a packed string", JSON.stringify({ data: { not: "a string" } })],
    ["is not deflated", JSON.stringify({ data: "bm90IGRlZmxhdGVk" })],
    ["is not a JSON object", JSON.stringify({ data: deflateRawSync("[1]").toString("base64") })],
    ["is not JSON at all", "<html>gateway</html>"],
  ])("falls back to the game when the service payload %s", async (_case, body) => {
    const fetchFn = serving(() => new Response(body));

    const result = await preferences(localApi(), fetchFn).read();

    expect(result).toEqual({ data: SETTINGS, source: "game" });
  });

  it("answers null when neither the service nor the game answers", async () => {
    const local = localApi({ gameAuthorization: vi.fn().mockResolvedValue(null) });
    const fetchFn = serving(() => new Response("unavailable", { status: 503 }));

    expect(await preferences(local, fetchFn).read()).toBeNull();
    expect(local.get).not.toHaveBeenCalled();
  });

  it("answers null when the game refuses the read", async () => {
    const local = localApi({ get: vi.fn().mockRejectedValue(new RiotApiError(403, LOCAL_PATH)) });
    const fetchFn = serving(() => new Response("forbidden", { status: 403 }));

    expect(await preferences(local, fetchFn).read()).toBeNull();
  });

  it("answers null when the game has no settings stored", async () => {
    const local = localApi({ get: vi.fn().mockResolvedValue(null) });
    const fetchFn = serving(() => new Response("missing", { status: 404 }));

    expect(await preferences(local, fetchFn).read()).toBeNull();
  });

  it("lets programming errors through", async () => {
    const local = localApi({ entitlementsToken: vi.fn().mockRejectedValue(new Error("bug")) });

    await expect(
      preferences(
        local,
        serving(() => packed(SETTINGS)),
      ).read(),
    ).rejects.toThrow("bug");
  });
});

describe("PlayerPreferencesApi.write", () => {
  it("saves through the service with a PUT carrying both credentials and the packed settings", async () => {
    const local = localApi();
    const fetchFn = serving(() => new Response(null, { status: 204 }));

    const source = await preferences(local, fetchFn).write(SETTINGS);

    expect(source).toBe("service");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${HOST}/playerPref/v3/savePreference`);
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({ ...CREDENTIALS, "Content-Type": "application/json" });
    const sent = JSON.parse(String(init?.body)) as { type: string; data: string };
    expect(sent.type).toBe("Ares.PlayerSettings");
    expect(PreferenceCodec.decode(sent.data)).toEqual(SETTINGS);
    expect(local.put).not.toHaveBeenCalled();
  });

  it("does not call the service when the settings do not survive the round trip", async () => {
    const local = localApi();
    const fetchFn = serving(() => new Response(null, { status: 204 }));
    const unpackable = { value: 10n };

    const source = await preferences(local, fetchFn).write(unpackable);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(source).toBe("game");
    expect(local.put).toHaveBeenCalledWith(LOCAL_PATH, unpackable, { Authorization: "Basic game" });
  });

  it("falls back to the game, with the settings as they are, when the service refuses the save", async () => {
    const local = localApi();
    const fetchFn = serving(() => new Response("method not allowed", { status: 405 }));

    const source = await preferences(local, fetchFn).write(SETTINGS);

    expect(source).toBe("game");
    expect(local.put).toHaveBeenCalledWith(LOCAL_PATH, SETTINGS, { Authorization: "Basic game" });
  });

  it("falls back to the game when the request to the service fails", async () => {
    const fetchFn = vi.fn<HttpFetchFn>().mockRejectedValue(new TypeError("fetch failed"));

    expect(await preferences(localApi(), fetchFn).write(SETTINGS)).toBe("game");
  });

  it("answers null when neither the service nor the game accepts the save", async () => {
    const local = localApi({ put: vi.fn().mockRejectedValue(new RiotApiError(500, LOCAL_PATH)) });
    const fetchFn = serving(() => new Response("unavailable", { status: 503 }));

    expect(await preferences(local, fetchFn).write(SETTINGS)).toBeNull();
  });

  it("answers null without the game running when the service is out of reach", async () => {
    const local = localApi({ gameAuthorization: vi.fn().mockResolvedValue(null) });
    const fetchFn = serving(() => new Response("unavailable", { status: 503 }));

    expect(await preferences(local, fetchFn).write(SETTINGS)).toBeNull();
    expect(local.put).not.toHaveBeenCalled();
  });
});

describe("PreferenceCodec", () => {
  it("packs settings as base64 of raw deflate and unpacks them", () => {
    const packedSettings = PreferenceCodec.encode(SETTINGS);

    expect(inflateRawSync(Buffer.from(packedSettings, "base64")).toString("utf8")).toBe(
      JSON.stringify(SETTINGS),
    );
    expect(PreferenceCodec.decode(packedSettings)).toEqual(SETTINGS);
  });

  it("refuses a payload that does not unpack to a JSON object", () => {
    expect(() => PreferenceCodec.decode("bm90IGRlZmxhdGVk")).toThrow();
    expect(() => PreferenceCodec.decode(deflateRawSync("[1]").toString("base64"))).toThrow(
      TypeError,
    );
  });

  it("tells settings that survive the trip from the ones that do not", () => {
    expect(PreferenceCodec.roundTrips(SETTINGS)).toBe(true);
    expect(PreferenceCodec.roundTrips({ value: 10n })).toBe(false);
  });
});
