import type { Catalogue } from "../catalogue/Catalogue.js";
import { FriendsBuilder } from "../collection/FriendsBuilder.js";
import { MessagesBuilder } from "../collection/MessagesBuilder.js";
import type { ChatApi } from "../local/ChatApi.js";
import type {
  RawChatFriend,
  RawChatMessage,
  RawChatPresence,
  RawChatSession,
  RawConversationsResponse,
  RawFriendRequest,
} from "../local/chatTypes.js";
import { classifyFrame, frameResource } from "../local/FrameKind.js";
import { decodeValorantPresence } from "../local/Presence.js";
import type { RiotFrame, RiotSocket } from "../local/RiotSocket.js";
import type { Friend, FriendRequest, Message, ValorantPresence } from "../model/index.js";
import { TypedEmitter } from "./TypedEmitter.js";

export type RiotEventMap = {
  connected: [];
  disconnected: [];
  "friend:presence": [{ friend: Friend; change: "update" | "offline" }];
  "friend:added": [Friend];
  "friend:removed": [{ puuid: string }];
  "friend:request": [{ request: FriendRequest; change: "created" | "resolved" }];
  message: [Message];
  conversation: [{ cid: string; unreadCount: number }];
  party: [{ partyId: string }];
  game: [{ phase: "pregame" | "ingame"; matchId: string }];
  "self:state": [
    { state: "menus" | "pregame" | "ingame" | null; presence: ValorantPresence | null },
  ];
  raw: [RiotFrame];
  error: [Error];
};

export type CatalogueLoader = () => Promise<Catalogue | null>;
export type PuuidResolver = () => Promise<string | null>;

export function toFriendRequest(raw: RawFriendRequest): FriendRequest {
  return {
    puuid: raw.puuid,
    gameName: raw.game_name,
    tagLine: raw.game_tag,
    direction: raw.subscription === "pending_in" ? "incoming" : "outgoing",
  };
}

function extractLastUuid(str: string): string | null {
  const matches = str.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  return matches && matches.length > 0 ? matches[matches.length - 1]!.toLowerCase() : null;
}

export class RiotEvents extends TypedEmitter<RiotEventMap> {
  private readonly socket: RiotSocket;
  private readonly chatApi: ChatApi;
  private readonly catalogueLoader: CatalogueLoader;
  private readonly puuidResolver: PuuidResolver;

  private readonly rawFriendsByPuuid = new Map<string, RawChatFriend>();
  private readonly recentRelayKeys = new Set<string>();

  private unsubStatus: (() => void) | null = null;
  private unsubFrame: (() => void) | null = null;

  private catalogue: Catalogue | null = null;
  private cataloguePromise: Promise<Catalogue | null> | null = null;
  private cachedPuuid: string | null = null;
  private chatSession: RawChatSession | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastSelfState: "menus" | "pregame" | "ingame" | null | undefined = undefined;

  constructor(
    socket: RiotSocket,
    chatApi: ChatApi,
    catalogueLoader: CatalogueLoader,
    puuidResolver: PuuidResolver,
  ) {
    super();
    this.socket = socket;
    this.chatApi = chatApi;
    this.catalogueLoader = catalogueLoader;
    this.puuidResolver = puuidResolver;

    this.bindSocket();
  }

  start(): this {
    this.socket.start();
    return this;
  }

  stop(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.unsubStatus?.();
    this.unsubStatus = null;
    this.unsubFrame?.();
    this.unsubFrame = null;
    this.socket.stop();
  }

  async refreshFriends(): Promise<void> {
    try {
      const friends = await this.chatApi.friends();
      this.rawFriendsByPuuid.clear();
      for (const f of friends) {
        if (f.puuid) {
          this.rawFriendsByPuuid.set(f.puuid, f);
        }
      }
    } catch {}
  }

  private bindSocket(): void {
    this.unsubStatus = this.socket.onStatus((connected) => {
      if (connected) {
        this.emit("connected");
        void this.onConnected();
      } else {
        this.lastSelfState = undefined;
        this.emit("disconnected");
      }
    });

    this.unsubFrame = this.socket.onFrame((frame) => {
      void this.dispatchFrame(frame);
    });
  }

  private async onConnected(): Promise<void> {
    this.chatSession = null;
    this.lastSelfState = undefined;
    await Promise.all([this.refreshFriends(), this.resolvePuuid()]);
  }

  private async dispatchFrame(frame: RiotFrame): Promise<void> {
    try {
      this.emit("raw", frame);
      await this.routeFrame(frame);
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async routeFrame(frame: RiotFrame): Promise<void> {
    const kind = classifyFrame(frame);
    switch (kind) {
      case "presences":
        await this.handlePresence(frame);
        break;
      case "friend-requests":
        this.handleFriendRequest(frame);
        break;
      case "friends":
        await this.handleFriends(frame);
        break;
      case "chat-message":
        await this.handleMessage(frame);
        break;
      case "chat-conversation":
        this.handleConversations(frame);
        break;
      case "party":
      case "pregame":
      case "coregame":
        this.handleRelay(frame, kind);
        break;
    }
  }

  private async handlePresence(frame: RiotFrame): Promise<void> {
    const data = frame.data as { presences?: RawChatPresence[] } | undefined;
    const list = data?.presences;
    if (!list || list.length === 0) return;

    const myPuuid = await this.resolvePuuid();
    const catalogue = await this.loadCatalogue();

    for (const p of list) {
      if (myPuuid && p.puuid === myPuuid) {
        this.handleSelfPresence(p, catalogue);
        continue;
      }
      this.handleFriendPresence(p, frame.eventType, catalogue);
    }
  }

  private handleSelfPresence(p: RawChatPresence, catalogue: Catalogue | null): void {
    if (p.product !== "valorant") return;
    const decoded = decodeValorantPresence(p.private, catalogue);
    if (!decoded) return;

    if (decoded.state !== this.lastSelfState) {
      this.lastSelfState = decoded.state;
      this.emit("self:state", { state: decoded.state, presence: decoded });
    }
  }

  private handleFriendPresence(
    p: RawChatPresence,
    eventType: string,
    catalogue: Catalogue | null,
  ): void {
    const rawFriend = this.rawFriendsByPuuid.get(p.puuid);
    if (!rawFriend) return;

    if (eventType === "Delete") {
      const friend = new FriendsBuilder([rawFriend], [], catalogue ?? undefined).build()[0];
      if (friend) this.emit("friend:presence", { friend, change: "offline" });
    } else {
      const friend = new FriendsBuilder([rawFriend], [p], catalogue ?? undefined).build()[0];
      if (friend) this.emit("friend:presence", { friend, change: "update" });
    }
  }

  private async handleFriends(frame: RiotFrame): Promise<void> {
    const data = frame.data as { friends?: RawChatFriend[]; puuid?: string } | undefined;
    const rawFriend = data?.friends?.[0];
    const puuid = rawFriend?.puuid ?? data?.puuid;

    if (frame.eventType === "Create" && rawFriend) {
      this.rawFriendsByPuuid.set(rawFriend.puuid, rawFriend);
      const catalogue = await this.loadCatalogue();
      const friend = new FriendsBuilder([rawFriend], [], catalogue ?? undefined).build()[0];
      if (friend) this.emit("friend:added", friend);
      this.scheduleRefreshFriends();
    } else if (frame.eventType === "Delete" && puuid) {
      this.rawFriendsByPuuid.delete(puuid);
      this.emit("friend:removed", { puuid });
      this.scheduleRefreshFriends();
    } else if (frame.eventType === "Update") {
      if (rawFriend) this.rawFriendsByPuuid.set(rawFriend.puuid, rawFriend);
      this.scheduleRefreshFriends();
    }
  }

  private handleFriendRequest(frame: RiotFrame): void {
    const data = frame.data as { requests?: RawFriendRequest[] } | undefined;
    const rawReq = data?.requests?.[0];
    if (!rawReq || !rawReq.puuid) return;

    const request = toFriendRequest(rawReq);
    const change = frame.eventType === "Delete" ? "resolved" : "created";
    this.emit("friend:request", { request, change });
  }

  private async handleMessage(frame: RiotFrame): Promise<void> {
    if (frame.eventType !== "Create") return;
    const data = frame.data as { messages?: RawChatMessage[] } | undefined;
    const rawMsg = data?.messages?.[0];
    if (!rawMsg) return;

    const catalogue = await this.loadCatalogue();
    const session = await this.loadSession();
    const friends = new FriendsBuilder(
      [...this.rawFriendsByPuuid.values()],
      [],
      catalogue ?? undefined,
    ).build();

    const [message] = new MessagesBuilder(friends, session).buildMessages([rawMsg]);
    if (message) {
      this.emit("message", message);
    }
  }

  private handleConversations(frame: RiotFrame): void {
    const data = frame.data as RawConversationsResponse | undefined;
    const conversations = data?.conversations;
    if (!Array.isArray(conversations)) return;

    for (const conversation of conversations) {
      if (!conversation?.cid) continue;
      this.emit("conversation", {
        cid: conversation.cid,
        unreadCount: conversation.unread_count ?? 0,
      });
    }
  }

  private handleRelay(frame: RiotFrame, kind: "party" | "pregame" | "coregame"): void {
    const data = frame.data as { timestamp?: string | number } | undefined;
    const resource = frameResource(frame);
    const timestamp = data?.timestamp != null ? String(data.timestamp) : "";
    const dedupeKey = `${resource}@${timestamp}`;

    if (this.isDuplicateRelay(dedupeKey)) return;

    if (kind === "party") {
      const match =
        resource.match(/\/parties\/v1\/parties\/([a-zA-Z0-9-]+)/i) ??
        resource.match(/parties\/([a-zA-Z0-9-]+)/i);
      if (match) this.emit("party", { partyId: match[1]! });
      return;
    }

    if (resource.includes("/players/")) return;

    const matchId = extractLastUuid(resource);
    if (matchId) {
      this.emit("game", { phase: kind === "pregame" ? "pregame" : "ingame", matchId });
    }
  }

  private scheduleRefreshFriends(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshFriends();
    }, 300);
  }

  private isDuplicateRelay(key: string): boolean {
    if (this.recentRelayKeys.has(key)) return true;
    this.recentRelayKeys.add(key);
    if (this.recentRelayKeys.size > 200) {
      const oldest = this.recentRelayKeys.values().next().value;
      if (oldest !== undefined) {
        this.recentRelayKeys.delete(oldest);
      }
    }
    return false;
  }

  private async resolvePuuid(): Promise<string | null> {
    if (this.cachedPuuid) return this.cachedPuuid;
    try {
      this.cachedPuuid = await this.puuidResolver();
    } catch {
      this.cachedPuuid = null;
    }
    return this.cachedPuuid;
  }

  private async loadCatalogue(): Promise<Catalogue | null> {
    if (this.catalogue) return this.catalogue;
    if (!this.cataloguePromise) {
      this.cataloguePromise = this.catalogueLoader()
        .then((cat) => {
          this.catalogue = cat;
          return cat;
        })
        .catch(() => null);
    }
    return this.cataloguePromise;
  }

  private async loadSession(): Promise<RawChatSession | null> {
    if (!this.chatSession) {
      try {
        this.chatSession = await this.chatApi.session();
      } catch {}
    }
    return this.chatSession;
  }
}
