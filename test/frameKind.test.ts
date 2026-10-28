import { describe, expect, it } from "vitest";
import { classifyFrame, frameResource, type RiotFrameKind } from "../src/local/FrameKind.js";
import type { RiotFrame } from "../src/local/RiotSocket.js";

const MATCH = "89736e63-1234-4567-89ab-cdef01234567";
const RELAY = "/riot-messaging-service/v1/message";

const frame = (uri: string, data?: unknown): RiotFrame => ({ uri, eventType: "Update", data });

describe("classifyFrame", () => {
  it.each<[RiotFrameKind, string]>([
    ["chat-session", "/chat/v1/session"],
    ["chat-message", "/chat/v6/messages"],
    ["chat-conversation", "/chat/v6/conversations"],
    ["chat-conversation", "/chat/v7/conversations/ares-parties"],
    ["friend-requests", "/chat/v4/friendrequests"],
    ["friends", "/chat/v4/friends"],
    ["presences", "/chat/v4/presences"],
    ["party", `${RELAY}/ares-parties/parties/v1/parties/${MATCH}`],
    ["party", `${RELAY}/other/parties/v1/parties/${MATCH}`],
    ["party", `${RELAY}/ares-parties/anything`],
    ["pregame", `${RELAY}/ares-pregame/pregame/v1/matches/${MATCH}`],
    ["pregame", `${RELAY}/other/pregame/v1/matches/${MATCH}`],
    ["pregame", `${RELAY}/ares-pregame/anything`],
    ["coregame", `${RELAY}/ares-core-game/core-game/v1/matches/${MATCH}`],
    ["coregame", `${RELAY}/other/core-game/v1/matches/${MATCH}`],
    ["coregame", `${RELAY}/ares-core-game/anything`],
    ["match-details", `${RELAY}/ares-match-details/match-details/v1/matches/${MATCH}`],
    ["match-details", "/match-details/v1/matches"],
    ["heartbeat", "/product-session/v1/session-heartbeats/1"],
    ["other", "/riot-messaging-service/v1/message/ares-something/else"],
    ["other", "/chat/v5/participants"],
  ])("sorts a %s frame by its uri %s", (kind, uri) => {
    expect(classifyFrame(frame(uri))).toBe(kind);
  });

  it("tells friend requests apart from the friends list", () => {
    expect(classifyFrame(frame("/chat/v4/friendrequests"))).toBe("friend-requests");
    expect(classifyFrame(frame("/chat/v4/friendrequests/p1"))).toBe("friend-requests");
    expect(classifyFrame(frame("/chat/v4/friends"))).toBe("friends");
    expect(classifyFrame(frame("/chat/v4/friends/p1"))).toBe("friends");
  });

  it("takes the chat session only when the uri is exactly that", () => {
    expect(classifyFrame(frame("/chat/v1/session/extra"))).toBe("other");
  });

  it("gives data.resource precedence over the uri for party, pregame and core game", () => {
    const relay = `${RELAY}/ares-pregame/pregame/v1/matches/${MATCH}`;

    expect(
      classifyFrame(frame(relay, { resource: `ares-parties/parties/v1/parties/${MATCH}` })),
    ).toBe("party");
    expect(classifyFrame(frame(`${RELAY}/x`, { resource: "ares-core-game/core-game/v1" }))).toBe(
      "coregame",
    );
  });

  it("falls back to the uri when data.resource is not a string", () => {
    const relay = `${RELAY}/ares-pregame/pregame/v1/matches/${MATCH}`;

    expect(classifyFrame(frame(relay, { resource: 42 }))).toBe("pregame");
    expect(classifyFrame(frame(relay, null))).toBe("pregame");
    expect(classifyFrame(frame(relay, "text"))).toBe("pregame");
    expect(classifyFrame(frame(relay))).toBe("pregame");
  });

  it("checks the uri kinds before the resource", () => {
    const resource = { resource: `ares-parties/parties/v1/parties/${MATCH}` };

    expect(classifyFrame(frame("/chat/v4/presences", resource))).toBe("presences");
    expect(classifyFrame(frame("/product-session/v1/session-heartbeats/1", resource))).toBe(
      "heartbeat",
    );
  });

  it("checks party before pregame and pregame before core game", () => {
    expect(classifyFrame(frame(`${RELAY}/x`, { resource: "ares-pregame ares-parties" }))).toBe(
      "party",
    );
    expect(classifyFrame(frame(`${RELAY}/x`, { resource: "ares-core-game ares-pregame" }))).toBe(
      "pregame",
    );
  });

  it("looks for match details in the uri only", () => {
    expect(classifyFrame(frame(`${RELAY}/x`, { resource: "/match-details/v1/matches" }))).toBe(
      "other",
    );
  });
});

describe("frameResource", () => {
  it("is data.resource when it is a string and the uri otherwise", () => {
    expect(frameResource(frame("/uri", { resource: "resource" }))).toBe("resource");
    expect(frameResource(frame("/uri", { resource: 1 }))).toBe("/uri");
    expect(frameResource(frame("/uri", null))).toBe("/uri");
  });
});
