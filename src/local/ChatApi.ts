import type { RiotClientLocalApi } from "./RiotClientLocalApi.js";
import type {
  RawBlockedPlayer,
  RawBlockedResponse,
  RawChatFriend,
  RawChatMessage,
  RawChatPresence,
  RawConversation,
  RawConversationsResponse,
  RawFriendRequest,
  RawFriendRequestsResponse,
  RawFriendsResponse,
  RawMessagesResponse,
  RawPresencesResponse,
  RawChatSession,
  RawParticipant,
  RawParticipantsResponse,
} from "./chatTypes.js";

export class ChatApi {
  private readonly localApi: RiotClientLocalApi;

  constructor(localApi: RiotClientLocalApi) {
    this.localApi = localApi;
  }

  async friends(): Promise<RawChatFriend[]> {
    const res = await this.localApi.get<RawFriendsResponse>("/chat/v4/friends");
    return res?.friends ?? [];
  }

  async presences(): Promise<RawChatPresence[]> {
    const res = await this.localApi.get<RawPresencesResponse>("/chat/v4/presences");
    return res?.presences ?? [];
  }

  async friendRequests(): Promise<RawFriendRequest[]> {
    const res = await this.localApi.get<RawFriendRequestsResponse>("/chat/v4/friendrequests");
    return res?.requests ?? [];
  }

  async blocked(): Promise<RawBlockedPlayer[]> {
    const res = await this.localApi.get<RawBlockedResponse>("/chat/v4/blocked");
    return res?.blocked ?? [];
  }

  async conversations(): Promise<RawConversation[]> {
    const read = async (path: string): Promise<RawConversation[]> => {
      try {
        const res = await this.localApi.get<RawConversationsResponse>(path);
        return res?.conversations ?? [];
      } catch {
        return [];
      }
    };

    const results = await Promise.all([
      read("/chat/v7/conversations"),
      read("/chat/v7/conversations/ares-parties"),
      read("/chat/v7/conversations/ares-pregame"),
      read("/chat/v7/conversations/ares-coregame"),
    ]);

    const byCid = new Map<string, RawConversation>();
    for (const list of results) {
      for (const conversation of list) {
        if (conversation?.cid && !byCid.has(conversation.cid)) {
          byCid.set(conversation.cid, conversation);
        }
      }
    }

    return [...byCid.values()];
  }

  async messages(cid?: string): Promise<RawChatMessage[]> {
    const path = cid ? `/chat/v6/messages?cid=${encodeURIComponent(cid)}` : "/chat/v6/messages";
    const res = await this.localApi.get<RawMessagesResponse>(path);
    return res?.messages ?? [];
  }

  async markRead(cid: string, messageId: string): Promise<void> {
    await this.localApi.post("/chat/v7/conversations/read", { cid, id: messageId });
  }

  async session(options?: { timeoutMs?: number }): Promise<RawChatSession | null> {
    if (options?.timeoutMs !== undefined) {
      return this.localApi.probe<RawChatSession>("/chat/v1/session", options.timeoutMs);
    }
    try {
      const res = await this.localApi.get<RawChatSession>("/chat/v1/session");
      return res ?? null;
    } catch {
      return null;
    }
  }

  async sendMessage(
    cid: string,
    message: string,
    type: "chat" | "groupchat",
  ): Promise<RawChatMessage> {
    return this.localApi.post<RawChatMessage>("/chat/v6/messages", { cid, message, type });
  }

  async sendFriendRequest(gameName: string, gameTag: string): Promise<void> {
    await this.localApi.post("/chat/v4/friendrequests", {
      game_name: gameName,
      game_tag: gameTag,
    });
  }

  async deleteFriendRequest(puuid: string): Promise<void> {
    await this.localApi.delete("/chat/v4/friendrequests", { puuid });
  }

  async removeFriend(puuid: string): Promise<void> {
    await this.localApi.delete("/chat/v4/friends", { puuid });
  }

  async blockPlayer(puuid: string): Promise<void> {
    await this.localApi.post("/chat/v4/blocked", { puuid });
  }

  async unblockPlayer(puuid: string): Promise<void> {
    await this.localApi.delete("/chat/v4/blocked", { puuid });
  }

  async participants(cid?: string): Promise<RawParticipant[]> {
    const path = cid
      ? `/chat/v5/participants?cid=${encodeURIComponent(cid)}`
      : "/chat/v5/participants";
    const res = await this.localApi.get<RawParticipantsResponse>(path);
    return res?.participants ?? [];
  }
}
