import type { RiotFrame } from "./RiotSocket.js";

export type RiotFrameKind =
  | "chat-session"
  | "chat-message"
  | "chat-conversation"
  | "friend-requests"
  | "friends"
  | "presences"
  | "party"
  | "pregame"
  | "coregame"
  | "match-details"
  | "heartbeat"
  | "other";

interface FrameRule {
  kind: RiotFrameKind;
  on: "uri" | "resource";
  test: (subject: string) => boolean;
}

const startingWith =
  (...prefixes: string[]) =>
  (subject: string): boolean =>
    prefixes.some((prefix) => subject.startsWith(prefix));

const containing =
  (...fragments: string[]) =>
  (subject: string): boolean =>
    fragments.some((fragment) => subject.includes(fragment));

// The order is the precedence: the first rule that matches wins.
const RULES: readonly FrameRule[] = [
  { kind: "heartbeat", on: "uri", test: startingWith("/product-session/v1/session-heartbeats/") },
  { kind: "chat-session", on: "uri", test: (uri) => uri === "/chat/v1/session" },
  { kind: "chat-message", on: "uri", test: startingWith("/chat/v6/messages") },
  {
    kind: "chat-conversation",
    on: "uri",
    test: startingWith("/chat/v6/conversations", "/chat/v7/conversations"),
  },
  { kind: "friend-requests", on: "uri", test: startingWith("/chat/v4/friendrequests") },
  { kind: "friends", on: "uri", test: startingWith("/chat/v4/friends") },
  { kind: "presences", on: "uri", test: startingWith("/chat/v4/presences") },
  { kind: "party", on: "resource", test: containing("ares-parties", "/parties/v1/parties/") },
  { kind: "pregame", on: "resource", test: containing("ares-pregame", "/pregame/") },
  { kind: "coregame", on: "resource", test: containing("ares-core-game", "/core-game/") },
  { kind: "match-details", on: "uri", test: containing("/match-details/v1/matches") },
];

export function frameResource(frame: RiotFrame): string {
  const data = frame.data as { resource?: unknown } | null | undefined;
  return typeof data?.resource === "string" ? data.resource : frame.uri;
}

export function classifyFrame(frame: RiotFrame): RiotFrameKind {
  const resource = frameResource(frame);
  const rule = RULES.find((candidate) =>
    candidate.test(candidate.on === "uri" ? frame.uri : resource),
  );
  return rule?.kind ?? "other";
}
