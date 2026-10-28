import { describe, expect, it } from "vitest";
import { ChatApi } from "../src/local/ChatApi.js";
import { PlayerAccountApi } from "../src/local/PlayerAccountApi.js";
import { ProductLauncherApi } from "../src/local/ProductLauncherApi.js";
import { RiotClientLocalApi, type LocalApiFetchFn } from "../src/local/RiotClientLocalApi.js";

type Call = { url: string; method?: string; body?: string; signal?: AbortSignal };

const recorder = (answer: (call: Call) => { status: number; body?: unknown }) => {
  const calls: Call[] = [];
  const fetchFn: LocalApiFetchFn = async (url, init) => {
    const call = { url, method: init?.method, body: init?.body, signal: init?.signal };
    calls.push(call);
    const { status, body } = answer(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  };
  return { calls, fetchFn };
};

const noSleep = async () => {};

describe("ChatApi.markRead", () => {
  it("posts the conversation and the last message read", async () => {
    const { calls, fetchFn } = recorder(() => ({ status: 204 }));
    const chat = new ChatApi(new RiotClientLocalApi(1, "p", { fetchFn, sleepFn: noSleep }));

    await chat.markRead("friend@la1.pvp.net", "1792690274874:2");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://127.0.0.1:1/chat/v7/conversations/read");
    expect(calls[0].method).toBe("POST");
    expect(JSON.parse(calls[0].body ?? "")).toEqual({
      cid: "friend@la1.pvp.net",
      id: "1792690274874:2",
    });
  });
});

describe("ChatApi.session", () => {
  it("asks once with a deadline when given a timeout", async () => {
    const { calls, fetchFn } = recorder(() => ({ status: 503 }));
    const chat = new ChatApi(new RiotClientLocalApi(1, "p", { fetchFn, sleepFn: noSleep }));

    expect(await chat.session({ timeoutMs: 1500 })).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("answers the session when the probe gets one", async () => {
    const session = { puuid: "me", game_name: "Name", game_tag: "TAG", state: "connected" };
    const { fetchFn } = recorder(() => ({ status: 200, body: session }));
    const chat = new ChatApi(new RiotClientLocalApi(1, "p", { fetchFn, sleepFn: noSleep }));

    expect(await chat.session({ timeoutMs: 1500 })).toEqual(session);
  });

  it("answers null when the probe cannot reach the client", async () => {
    const fetchFn: LocalApiFetchFn = async () => {
      throw new Error("ECONNREFUSED");
    };
    const chat = new ChatApi(new RiotClientLocalApi(1, "p", { fetchFn, sleepFn: noSleep }));

    expect(await chat.session({ timeoutMs: 1500 })).toBeNull();
  });
});

describe("PlayerAccountApi", () => {
  it("looks a riot id up with both parts encoded", async () => {
    const { calls, fetchFn } = recorder(() => ({
      status: 200,
      body: [{ alias: { game_name: "Ñandú Rojo" }, puuid: "p1" }],
    }));
    const accounts = new PlayerAccountApi(new RiotClientLocalApi(1, "p", { fetchFn }));

    expect(await accounts.puuidOf("Ñandú Rojo", "#AR1")).toBe("p1");
    expect(new URL(calls[0].url).searchParams.get("gameName")).toBe("Ñandú Rojo");
    expect(new URL(calls[0].url).searchParams.get("tagLine")).toBe("#AR1");
  });

  it("answers null for a riot id nobody holds", async () => {
    const { fetchFn } = recorder(() => ({ status: 200, body: [] }));
    const accounts = new PlayerAccountApi(new RiotClientLocalApi(1, "p", { fetchFn }));

    expect(await accounts.puuidOf("nobody", "0000")).toBeNull();
  });
});

describe("ProductLauncherApi", () => {
  it("launches Valorant on the live patchline by default", async () => {
    const { calls, fetchFn } = recorder(() => ({ status: 204 }));
    const launcher = new ProductLauncherApi(new RiotClientLocalApi(1, "p", { fetchFn }));

    await launcher.launch();

    expect(calls[0].url).toBe(
      "https://127.0.0.1:1/product-launcher/v1/products/valorant/patchlines/live",
    );
    expect(calls[0].method).toBe("POST");
  });

  it("throws when the client refuses to launch", async () => {
    const { fetchFn } = recorder(() => ({ status: 400 }));
    const launcher = new ProductLauncherApi(new RiotClientLocalApi(1, "p", { fetchFn }));

    await expect(launcher.launch()).rejects.toThrow();
  });
});
