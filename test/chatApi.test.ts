import { describe, expect, it } from "vitest";
import { ChatApi } from "../src/local/ChatApi.js";
import { RiotClientLocalApi, type LocalApiFetchFn } from "../src/local/RiotClientLocalApi.js";

describe("ChatApi", () => {
  it("fetches friends, presences, requests, and blocked players", async () => {
    const mockFetch = async (url: string) => {
      if (url.includes("/chat/v4/friends")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ friends: [{ puuid: "p1", game_name: "Friend1" }] }),
          text: async () => "",
        };
      }
      if (url.includes("/chat/v4/presences")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ presences: [{ puuid: "p1", product: "valorant" }] }),
          text: async () => "",
        };
      }
      if (url.includes("/chat/v4/friendrequests")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ requests: [{ puuid: "p2", subscription: "pending_in" }] }),
          text: async () => "",
        };
      }
      if (url.includes("/chat/v4/blocked")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ blocked: [{ puuid: "p3", game_name: "Blocked1" }] }),
          text: async () => "",
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };

    const localApi = new RiotClientLocalApi(5678, "pass", { fetchFn: mockFetch });
    const chatApi = new ChatApi(localApi);

    const friends = await chatApi.friends();
    const presences = await chatApi.presences();
    const requests = await chatApi.friendRequests();
    const blocked = await chatApi.blocked();

    expect(friends).toEqual([{ puuid: "p1", game_name: "Friend1" }]);
    expect(presences).toEqual([{ puuid: "p1", product: "valorant" }]);
    expect(requests).toEqual([{ puuid: "p2", subscription: "pending_in" }]);
    expect(blocked).toEqual([{ puuid: "p3", game_name: "Blocked1" }]);
  });

  it("merges conversations from all 4 endpoints and deduplicates by cid", async () => {
    const mockFetch = async (url: string) => {
      if (url.endsWith("/chat/v7/conversations")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              { cid: "user1@la1.pvp.net", type: "chat" },
              { cid: "dup@la1.pvp.net", type: "chat" },
            ],
          }),
          text: async () => "",
        };
      }
      if (url.endsWith("/chat/v7/conversations/ares-parties")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [
              { cid: "party-room@ares-parties.la1", type: "groupchat" },
              { cid: "dup@la1.pvp.net", type: "chat" },
            ],
          }),
          text: async () => "",
        };
      }
      if (url.endsWith("/chat/v7/conversations/ares-pregame")) {
        // Simulating 404 or empty outside game
        return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
      }
      if (url.endsWith("/chat/v7/conversations/ares-coregame")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            conversations: [{ cid: "match-room-all@ares-coregame.la1", type: "groupchat" }],
          }),
          text: async () => "",
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };

    const localApi = new RiotClientLocalApi(5678, "pass", { fetchFn: mockFetch });
    const chatApi = new ChatApi(localApi);

    const conversations = await chatApi.conversations();
    expect(conversations).toHaveLength(4);
    expect(conversations.map((c) => c.cid)).toEqual([
      "user1@la1.pvp.net",
      "dup@la1.pvp.net",
      "party-room@ares-parties.la1",
      "match-room-all@ares-coregame.la1",
    ]);
  });

  it("returns messages or empty list on 404", async () => {
    const mockFetch = async (url: string) => {
      if (url.includes("cid=existing")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            messages: [{ id: "m1", cid: "existing", body: "hello", time: "12345678" }],
          }),
          text: async () => "",
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };

    const localApi = new RiotClientLocalApi(5678, "pass", { fetchFn: mockFetch });
    const chatApi = new ChatApi(localApi);

    const existing = await chatApi.messages("existing");
    expect(existing).toEqual([{ id: "m1", cid: "existing", body: "hello", time: "12345678" }]);

    const missing = await chatApi.messages("non-existent");
    expect(missing).toEqual([]);
  });

  it("fetches chat session or returns null on failure", async () => {
    const mockFetch = async (url: string) => {
      if (url.includes("/chat/v1/session")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            puuid: "my-puuid",
            game_name: "MyName",
            game_tag: "TAG",
          }),
          text: async () => "",
        };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    };

    const localApi = new RiotClientLocalApi(5678, "pass", { fetchFn: mockFetch });
    const chatApi = new ChatApi(localApi);

    const session = await chatApi.session();
    expect(session).toEqual({
      puuid: "my-puuid",
      game_name: "MyName",
      game_tag: "TAG",
    });

    const failingApi = new RiotClientLocalApi(5678, "pass", {
      fetchFn: async () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => "",
      }),
    });
    const failingChatApi = new ChatApi(failingApi);
    expect(await failingChatApi.session()).toBeNull();
  });

  it("calls write endpoints correctly", async () => {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    const mockFetch = async (url: string, init?: unknown) => {
      const typed = init as { method: string; body?: string };
      calls.push({
        method: typed.method,
        url,
        body: typed.body ? JSON.parse(typed.body) : undefined,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => JSON.stringify({ ok: true }),
      };
    };

    const localApi = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch as unknown as LocalApiFetchFn,
    });
    const chatApi = new ChatApi(localApi);

    await chatApi.sendMessage("cid1", "hello", "chat");
    await chatApi.sendFriendRequest("Player", "NA1");
    await chatApi.deleteFriendRequest("p1");
    await chatApi.removeFriend("p2");
    await chatApi.blockPlayer("p3");
    await chatApi.unblockPlayer("p4");

    expect(calls).toEqual([
      {
        method: "POST",
        url: "https://127.0.0.1:5678/chat/v6/messages",
        body: { cid: "cid1", message: "hello", type: "chat" },
      },
      {
        method: "POST",
        url: "https://127.0.0.1:5678/chat/v4/friendrequests",
        body: { game_name: "Player", game_tag: "NA1" },
      },
      {
        method: "DELETE",
        url: "https://127.0.0.1:5678/chat/v4/friendrequests",
        body: { puuid: "p1" },
      },
      {
        method: "DELETE",
        url: "https://127.0.0.1:5678/chat/v4/friends",
        body: { puuid: "p2" },
      },
      {
        method: "POST",
        url: "https://127.0.0.1:5678/chat/v4/blocked",
        body: { puuid: "p3" },
      },
      {
        method: "DELETE",
        url: "https://127.0.0.1:5678/chat/v4/blocked",
        body: { puuid: "p4" },
      },
    ]);
  });
});
