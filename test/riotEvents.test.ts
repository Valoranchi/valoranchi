import { beforeEach, describe, expect, it, vi } from "vitest";
import { RiotEvents, toFriendRequest } from "../src/events/RiotEvents.js";
import type { ChatApi } from "../src/local/ChatApi.js";
import type {
  RawChatFriend,
  RawChatMessage,
  RawChatPresence,
  RawChatSession,
  RawFriendRequest,
} from "../src/local/chatTypes.js";
import type { RiotFrame, RiotSocket } from "../src/local/RiotSocket.js";
import type { Friend, FriendRequest, Message, ValorantPresence } from "../src/model/index.js";

class FakeSocket {
  frameHandler: ((frame: RiotFrame) => void) | null = null;
  statusHandler: ((connected: boolean) => void) | null = null;
  started = false;
  stopped = false;

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }

  onFrame(listener: (frame: RiotFrame) => void): () => void {
    this.frameHandler = listener;
    return () => {
      this.frameHandler = null;
    };
  }

  onStatus(listener: (connected: boolean) => void): () => void {
    this.statusHandler = listener;
    return () => {
      this.statusHandler = null;
    };
  }

  sendFrame(frame: RiotFrame): void {
    this.frameHandler?.(frame);
  }

  sendStatus(connected: boolean): void {
    this.statusHandler?.(connected);
  }
}

function makeFriend(puuid: string, name: string): RawChatFriend {
  return {
    puuid,
    game_name: name,
    game_tag: "TAG",
    name,
    note: null,
    pid: `${puuid}@riot`,
    region: "na",
    group: "ungrouped",
    displayGroup: "ungrouped",
    activePlatform: null,
    last_online_ts: null,
  };
}

describe("RiotEvents", () => {
  let fakeSocket: FakeSocket;
  let mockChatApi: Partial<ChatApi>;
  let catalogueLoader: () => Promise<null>;
  let puuidResolver: () => Promise<string | null>;
  let friendsRoster: RawChatFriend[];

  beforeEach(() => {
    fakeSocket = new FakeSocket();
    friendsRoster = [makeFriend("f-1", "FriendOne")];

    mockChatApi = {
      friends: vi.fn().mockImplementation(async () => friendsRoster),
      session: vi.fn().mockResolvedValue({
        puuid: "self-puuid",
        game_name: "Self",
        game_tag: "ME1",
      } as RawChatSession),
    };

    catalogueLoader = vi.fn().mockResolvedValue(null);
    puuidResolver = vi.fn().mockResolvedValue("self-puuid");
  });

  it("converts raw friend request accurately with toFriendRequest", () => {
    const rawIn: RawFriendRequest = {
      puuid: "req-1",
      game_name: "Req",
      game_tag: "123",
      name: "req#123",
      note: null,
      pid: "pid",
      region: "na",
      subscription: "pending_in",
    };
    expect(toFriendRequest(rawIn)).toEqual({
      puuid: "req-1",
      gameName: "Req",
      tagLine: "123",
      direction: "incoming",
    });

    const rawOut = { ...rawIn, subscription: "pending_out" };
    expect(toFriendRequest(rawOut).direction).toBe("outgoing");
  });

  it("forwards every valid frame to raw listener", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    const rawFrames: RiotFrame[] = [];
    events.on("raw", (f) => rawFrames.push(f));

    const frame: RiotFrame = {
      uri: "/product-session/v1/session-heartbeats/1",
      eventType: "Update",
      data: { phase: "Menus" },
    };

    fakeSocket.sendFrame(frame);
    expect(rawFrames).toHaveLength(1);
    expect(rawFrames[0]).toEqual(frame);
  });

  it("handles friend presence update and offline delete", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    // Initial roster population via connect
    fakeSocket.sendStatus(true);
    await new Promise((r) => setTimeout(r, 10));

    const emitted: Array<{ friend: Friend; change: "update" | "offline" }> = [];
    events.on("friend:presence", (payload) => emitted.push(payload));

    const valorantPrivate = Buffer.from(JSON.stringify({ sessionLoopState: "INGAME" })).toString(
      "base64",
    );

    const updatePresence: RawChatPresence = {
      puuid: "f-1",
      game_name: "FriendOne",
      game_tag: "TAG",
      pid: "p",
      product: "valorant",
      state: "chat",
      private: valorantPrivate,
      time: 123456789,
    };

    fakeSocket.sendFrame({
      uri: "/chat/v4/presences",
      eventType: "Update",
      data: { presences: [updatePresence] },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.change).toBe("update");
    expect(emitted[0]!.friend.gameName).toBe("FriendOne");
    expect(emitted[0]!.friend.presence.valorant?.state).toBe("ingame");

    // Offline event (Delete)
    fakeSocket.sendFrame({
      uri: "/chat/v4/presences",
      eventType: "Delete",
      data: { presences: [updatePresence] },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(emitted).toHaveLength(2);
    expect(emitted[1]!.change).toBe("offline");
    expect(emitted[1]!.friend.presence.state).toBe("offline");
  });

  it("enforces self:state change-only rule and ignores non-valorant self presence", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    fakeSocket.sendStatus(true);
    await new Promise((r) => setTimeout(r, 10));

    const states: Array<{ state: string | null; presence: ValorantPresence | null }> = [];
    events.on("self:state", (s) => states.push(s));

    const menusPrivate = Buffer.from(JSON.stringify({ sessionLoopState: "MENUS" })).toString(
      "base64",
    );

    // 1. Initial menus presence
    fakeSocket.sendFrame({
      uri: "/chat/v4/presences",
      eventType: "Update",
      data: {
        presences: [
          {
            puuid: "self-puuid",
            game_name: "Self",
            game_tag: "ME1",
            pid: "p",
            product: "valorant",
            state: "chat",
            private: menusPrivate,
            time: 1,
          },
        ],
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(states).toHaveLength(1);
    expect(states[0]!.state).toBe("menus");

    // 2. Duplicate menus presence -> not emitted
    fakeSocket.sendFrame({
      uri: "/chat/v4/presences",
      eventType: "Update",
      data: {
        presences: [
          {
            puuid: "self-puuid",
            game_name: "Self",
            game_tag: "ME1",
            pid: "p",
            product: "valorant",
            state: "chat",
            private: menusPrivate,
            time: 2,
          },
        ],
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(states).toHaveLength(1);

    // 3. Non-valorant presence -> not emitted
    fakeSocket.sendFrame({
      uri: "/chat/v4/presences",
      eventType: "Update",
      data: {
        presences: [
          {
            puuid: "self-puuid",
            game_name: "Self",
            game_tag: "ME1",
            pid: "p",
            product: "league_of_legends",
            state: "chat",
            private: null,
            time: 3,
          },
        ],
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(states).toHaveLength(1);

    // 4. Ingame transition -> emitted
    const ingamePrivate = Buffer.from(JSON.stringify({ sessionLoopState: "INGAME" })).toString(
      "base64",
    );
    fakeSocket.sendFrame({
      uri: "/chat/v4/presences",
      eventType: "Update",
      data: {
        presences: [
          {
            puuid: "self-puuid",
            game_name: "Self",
            game_tag: "ME1",
            pid: "p",
            product: "valorant",
            state: "chat",
            private: ingamePrivate,
            time: 4,
          },
        ],
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(states).toHaveLength(2);
    expect(states[1]!.state).toBe("ingame");
  });

  it("handles friend:added and friend:removed on /chat/v4/friends", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    const added: Friend[] = [];
    const removed: Array<{ puuid: string }> = [];
    events.on("friend:added", (f) => added.push(f));
    events.on("friend:removed", (r) => removed.push(r));

    const newFriend = makeFriend("f-new", "BrandNew");

    fakeSocket.sendFrame({
      uri: "/chat/v4/friends",
      eventType: "Create",
      data: { friends: [newFriend] },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(added).toHaveLength(1);
    expect(added[0]!.puuid).toBe("f-new");
    expect(added[0]!.gameName).toBe("BrandNew");

    fakeSocket.sendFrame({
      uri: "/chat/v4/friends",
      eventType: "Delete",
      data: { friends: [{ puuid: "f-new" }] },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(removed).toEqual([{ puuid: "f-new" }]);
  });

  it("handles friend:request on /chat/v4/friendrequests", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    const requests: Array<{ request: FriendRequest; change: "created" | "resolved" }> = [];
    events.on("friend:request", (r) => requests.push(r));

    const req: RawFriendRequest = {
      puuid: "req-abc",
      game_name: "Someone",
      game_tag: "EUW",
      name: "Someone#EUW",
      note: null,
      pid: "pid",
      region: "eu",
      subscription: "pending_in",
    };

    fakeSocket.sendFrame({
      uri: "/chat/v4/friendrequests",
      eventType: "Create",
      data: { requests: [req] },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.change).toBe("created");
    expect(requests[0]!.request.puuid).toBe("req-abc");

    fakeSocket.sendFrame({
      uri: "/chat/v4/friendrequests",
      eventType: "Delete",
      data: { requests: [req] },
    });
    expect(requests).toHaveLength(2);
    expect(requests[1]!.change).toBe("resolved");
  });

  it("translates chat messages on /chat/v6/messages", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    fakeSocket.sendStatus(true);
    await new Promise((r) => setTimeout(r, 10));

    const messages: Message[] = [];
    events.on("message", (m) => messages.push(m));

    const rawMsg: RawChatMessage = {
      id: "msg-1",
      cid: "room-1@ares-parties.na1.pvp.net",
      puuid: "f-1",
      game_name: "FriendOne",
      game_tag: "TAG",
      name: "FriendOne#TAG",
      pid: "pid",
      region: "na",
      body: "Hello party!",
      read: true,
      time: "1700000000000",
      type: "groupchat",
    };

    fakeSocket.sendFrame({
      uri: "/chat/v6/messages",
      eventType: "Create",
      data: { messages: [rawMsg] },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(messages).toHaveLength(1);
    expect(messages[0]!.body).toBe("Hello party!");
    expect(messages[0]!.kind).toBe("room");
    expect(messages[0]!.from.gameName).toBe("FriendOne");
  });

  it("emits conversation with the unread count of each conversation in the frame", () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    const conversations: Array<{ cid: string; unreadCount: number }> = [];
    events.on("conversation", (c) => conversations.push(c));

    fakeSocket.sendFrame({
      uri: "/chat/v7/conversations",
      eventType: "Update",
      data: {
        conversations: [
          { cid: "friend@la1.pvp.net", type: "chat", unread_count: 3 },
          { type: "chat", unread_count: 9 },
          { cid: "quiet@la1.pvp.net", type: "chat" },
        ],
      },
    });

    expect(conversations).toEqual([
      { cid: "friend@la1.pvp.net", unreadCount: 3 },
      { cid: "quiet@la1.pvp.net", unreadCount: 0 },
    ]);

    fakeSocket.sendFrame({
      uri: "/chat/v6/conversations",
      eventType: "Update",
      data: { conversations: "none" },
    });
    fakeSocket.sendFrame({ uri: "/chat/v6/conversations", eventType: "Update", data: null });
    expect(conversations).toHaveLength(2);
  });

  it("handles game and party transitions and dedupes plural relay duplicates", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    const gameEvents: Array<{ phase: "pregame" | "ingame"; matchId: string }> = [];
    const partyEvents: Array<{ partyId: string }> = [];
    events.on("game", (g) => gameEvents.push(g));
    events.on("party", (p) => partyEvents.push(p));

    const matchUuid = "89736e63-1234-4567-89ab-cdef01234567";

    // 1. Singular game match event
    fakeSocket.sendFrame({
      uri: `/riot-messaging-service/v1/message/ares-pregame/pregame/v1/matches/${matchUuid}`,
      eventType: "Create",
      data: {
        resource: `ares-pregame/pregame/v1/matches/${matchUuid}`,
        timestamp: 1000,
      },
    });
    expect(gameEvents).toHaveLength(1);
    expect(gameEvents[0]).toEqual({ phase: "pregame", matchId: matchUuid });

    // 2. Plural duplicate with same resource and timestamp -> deduped
    fakeSocket.sendFrame({
      uri: `/riot-messaging-service/v1/messages/ares-pregame/pregame/v1/matches/${matchUuid}`,
      eventType: "Create",
      data: {
        resource: `ares-pregame/pregame/v1/matches/${matchUuid}`,
        timestamp: 1000,
      },
    });
    expect(gameEvents).toHaveLength(1);

    // 3. Player entry -> ignored
    fakeSocket.sendFrame({
      uri: `/riot-messaging-service/v1/message/ares-pregame/pregame/v1/players/${matchUuid}`,
      eventType: "Create",
      data: {
        resource: `ares-pregame/pregame/v1/players/${matchUuid}`,
        timestamp: 2000,
      },
    });
    expect(gameEvents).toHaveLength(1);

    // 4. Coregame match event
    fakeSocket.sendFrame({
      uri: `/riot-messaging-service/v1/message/ares-core-game/core-game/v1/matches/${matchUuid}`,
      eventType: "Create",
      data: {
        resource: `ares-core-game/core-game/v1/matches/${matchUuid}`,
        timestamp: 3000,
      },
    });
    expect(gameEvents).toHaveLength(2);
    expect(gameEvents[1]).toEqual({ phase: "ingame", matchId: matchUuid });

    // 5. Party event
    const partyUuid = "11112222-3333-4444-5555-666677778888";
    fakeSocket.sendFrame({
      uri: `/riot-messaging-service/v1/message/ares-parties/parties/v1/parties/${partyUuid}`,
      eventType: "Create",
      data: {
        resource: `ares-parties/parties/v1/parties/${partyUuid}`,
        timestamp: 4000,
      },
    });
    expect(partyEvents).toEqual([{ partyId: partyUuid }]);
  });

  it("emits error when a listener throws and keeps processing next frames", async () => {
    const events = new RiotEvents(
      fakeSocket as unknown as RiotSocket,
      mockChatApi as ChatApi,
      catalogueLoader,
      puuidResolver,
    );

    const errors: Error[] = [];
    events.on("error", (err) => errors.push(err));

    let count = 0;
    events.on("party", () => {
      count++;
      if (count === 1) {
        throw new Error("Party listener failure");
      }
    });

    fakeSocket.sendFrame({
      uri: "/riot-messaging-service/v1/message/ares-parties/parties/v1/parties/party-1",
      eventType: "Create",
      data: { timestamp: 1 },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("Party listener failure");

    // Next frame continues to be delivered normally
    fakeSocket.sendFrame({
      uri: "/riot-messaging-service/v1/message/ares-parties/parties/v1/parties/party-2",
      eventType: "Create",
      data: { timestamp: 2 },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(count).toBe(2);
    expect(errors).toHaveLength(1);
  });
});
