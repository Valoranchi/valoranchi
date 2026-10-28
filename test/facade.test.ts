import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RiotClient } from "../src/RiotClient.js";
import { RiotClientNotRunningError, ValidationError } from "../src/errors.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";
import type { ValorantApi } from "../src/catalogue/ValorantApi.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { RiotClientLocalApi } from "../src/local/RiotClientLocalApi.js";
import type { RiotLoadoutResponse } from "../src/riot/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("RiotClient facade", () => {
  const catalogueData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData;

  it("exposes the namespaces, watch, events, serve and close as public members", () => {
    expect(Object.getOwnPropertyNames(RiotClient.prototype)).toEqual([
      "constructor",
      "events",
      "serve",
      "close",
    ]);
    const client = new RiotClient({ lockfilePath: "non-existent" });
    expect(client.account).toBeDefined();
    expect(client.social).toBeDefined();
    expect(client.store).toBeDefined();
    expect(client.matches).toBeDefined();
    expect(client.party).toBeDefined();
    expect(client.watch).toBeDefined();
    expect(typeof client.events).toBe("function");
    expect(typeof client.serve).toBe("function");
    expect(typeof client.close).toBe("function");
  });

  it("throws RiotClientNotRunningError when lockfile is absent", async () => {
    const client = new RiotClient({
      lockfilePath: "non-existent-path/lockfile",
    });
    await expect(client.account.whoami()).rejects.toThrow(RiotClientNotRunningError);
  });

  it("caches session and deduplicates concurrent session creation", async () => {
    const tempDir = path.join(__dirname, "tmp-test");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    let createCalls = 0;
    const mockLocalApi = {
      entitlementsToken: async () => {
        createCalls++;
        return {
          accessToken: "access",
          token: "token",
          subject: "puuid-1",
        };
      },
      valorantSession: async () => ({
        region: "na",
        shard: "na",
      }),
      close: async () => undefined,
    } as unknown as RiotClientLocalApi;

    const mockGateway = {
      get: vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/store/v1/wallet/")) {
          return {
            Balances: {
              "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741": 1500,
              "e59aa87c-4cbf-517a-5983-6e81511be9b7": 80,
              "85ca954a-41f2-ce94-9b45-8ca3dd39a00d": 4000,
            },
          };
        }
        if (url.includes("/account-xp/v1/players/")) {
          return { Progress: { Level: 50, XP: 0 } };
        }
        if (url.includes("/personalization/v3/players/")) {
          return {
            Guns: [],
            Sprays: [],
            Identity: { AccountLevel: 50 },
            Incognito: false,
          };
        }
        return {};
      }),
      put: vi.fn().mockResolvedValue([{ Subject: "puuid-1", GameName: "Jett", TagLine: "1234" }]),
    } as unknown as HttpGateway;

    const mockValorantApi = {
      getClientVersion: async () => "1.0.0",
      getCatalogue: async () => new Catalogue(catalogueData),
    } as unknown as ValorantApi;

    const client = new RiotClient({
      lockfilePath,
      gateway: mockGateway,
      valorantApi: mockValorantApi,
      localApiFactory: () => mockLocalApi,
      sessionTtlMs: 5000,
    });

    const [wallet1, wallet2] = await Promise.all([
      client.account.wallet(),
      client.account.wallet(),
    ]);

    expect(wallet1).toEqual({
      valorantPoints: 1500,
      radianite: 80,
      kingdomCredits: 4000,
    });
    expect(wallet2).toEqual(wallet1);
    expect(createCalls).toBe(1);

    const whoami = await client.account.whoami();
    expect(whoami).toEqual({
      puuid: "puuid-1",
      gameName: "Jett",
      tagLine: "1234",
      region: "na",
      shard: "na",
      accountLevel: 50,
    });
    expect(createCalls).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("fetches the loadout endpoint exactly once during loadout()", async () => {
    const tempDir = path.join(__dirname, "tmp-test-loadout");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    const mockLocalApi = {
      entitlementsToken: async () => ({
        accessToken: "access",
        token: "token",
        subject: "puuid-1",
      }),
      valorantSession: async () => ({
        region: "na",
        shard: "na",
      }),
      close: async () => undefined,
    } as unknown as RiotClientLocalApi;

    let loadoutCalls = 0;
    const mockGateway = {
      get: vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/account-xp/v1/players/")) {
          return { Progress: { Level: 50, XP: 0 } };
        }
        if (url.includes("/personalization/v3/players/")) {
          loadoutCalls++;
          return {
            Guns: [],
            Sprays: [],
            Identity: { AccountLevel: 50 },
            Incognito: false,
          };
        }
        return {};
      }),
      put: vi.fn().mockResolvedValue([{ Subject: "puuid-1", GameName: "Jett", TagLine: "1234" }]),
    } as unknown as HttpGateway;

    const mockValorantApi = {
      getClientVersion: async () => "1.0.0",
      getCatalogue: async () => new Catalogue(catalogueData),
    } as unknown as ValorantApi;

    const client = new RiotClient({
      lockfilePath,
      gateway: mockGateway,
      valorantApi: mockValorantApi,
      localApiFactory: () => mockLocalApi,
    });

    const loadout = await client.account.loadout();
    expect(loadout.player.gameName).toBe("Jett");
    expect(loadoutCalls).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("closes the local API once when client.close() is called", async () => {
    const tempDir = path.join(__dirname, "tmp-test-close");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const mockLocalApi = {
      entitlementsToken: async () => ({ accessToken: "a", token: "t", subject: "p" }),
      valorantSession: async () => ({ region: "na", shard: "na" }),
      get: vi.fn().mockResolvedValue({ friends: [] }),
      close: closeSpy,
    } as unknown as RiotClientLocalApi;

    const client = new RiotClient({
      lockfilePath,
      localApiFactory: () => mockLocalApi,
    });

    await client.social.friends();
    await client.close();
    await client.close();

    expect(closeSpy).toHaveBeenCalledTimes(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("executes chat methods without building game-server session", async () => {
    const tempDir = path.join(__dirname, "tmp-test-chat");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    const tokenSpy = vi.fn();
    const mockLocalApi = {
      entitlementsToken: tokenSpy,
      get: vi.fn().mockImplementation(async (path: string) => {
        if (path.includes("/chat/v4/friends"))
          return { friends: [{ puuid: "f1", game_name: "Friend1", game_tag: "001" }] };
        if (path.includes("/chat/v4/presences")) return { presences: [] };
        if (path.includes("/chat/v4/friendrequests"))
          return {
            requests: [
              { puuid: "r1", game_name: "Req", game_tag: "002", subscription: "pending_in" },
            ],
          };
        if (path.includes("/chat/v4/blocked"))
          return { blocked: [{ puuid: "b1", game_name: "Block", game_tag: "003" }] };
        if (path.includes("/chat/v7/conversations"))
          return { conversations: [{ cid: "f1@la1.pvp.net", type: "chat" }] };
        if (path.includes("/chat/v6/messages"))
          return {
            messages: [
              {
                id: "m1",
                cid: "f1@la1.pvp.net",
                body: "hi",
                time: "1000",
                type: "chat",
                puuid: "f1",
                game_name: "Friend1",
                game_tag: "001",
              },
            ],
          };
        return null;
      }),
      close: vi.fn(),
    } as unknown as RiotClientLocalApi;

    const mockValorantApi = {
      getCatalogue: async () => new Catalogue(catalogueData),
    } as unknown as ValorantApi;

    const client = new RiotClient({
      lockfilePath,
      valorantApi: mockValorantApi,
      localApiFactory: () => mockLocalApi,
    });

    const friends = await client.social.friends();
    const requests = await client.social.friendRequests();
    const blocked = await client.social.blocked();
    const conversations = await client.social.conversations();
    const messages = await client.social.messages("f1@la1.pvp.net");

    expect(friends[0]?.gameName).toBe("Friend1");
    expect(requests[0]?.direction).toBe("incoming");
    expect(blocked[0]?.gameName).toBe("Block");
    expect(conversations[0]?.kind).toBe("whisper");
    expect(conversations[0]?.with?.gameName).toBe("Friend1");
    expect(messages[0]?.body).toBe("hi");
    expect(tokenSpy).not.toHaveBeenCalled();

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("fetches store view model using session and storefront", async () => {
    const tempDir = path.join(__dirname, "tmp-test-store");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    const mockLocalApi = {
      entitlementsToken: async () => ({ accessToken: "a", token: "t", subject: "puuid-store" }),
      valorantSession: async () => ({ region: "na", shard: "na" }),
      close: vi.fn(),
    } as unknown as RiotClientLocalApi;

    const storefrontFixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "fixtures", "storefront.json"), "utf-8"),
    );

    const mockGateway = {
      get: vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/account-xp/")) return { Progress: { Level: 25, XP: 100 } };
        return {};
      }),
      put: vi
        .fn()
        .mockResolvedValue([{ Subject: "puuid-store", GameName: "Buyer", TagLine: "0000" }]),
      post: vi.fn().mockResolvedValue(storefrontFixture),
    } as unknown as HttpGateway;

    const mockValorantApi = {
      getClientVersion: async () => "1.0.0",
      getCatalogue: async () => new Catalogue(catalogueData),
    } as unknown as ValorantApi;

    const client = new RiotClient({
      lockfilePath,
      gateway: mockGateway,
      valorantApi: mockValorantApi,
      localApiFactory: () => mockLocalApi,
    });

    const store = await client.store.current();
    expect(store.player.gameName).toBe("Buyer");
    expect(store.daily?.offers).toHaveLength(1);
    expect(store.nightMarket?.offers).toHaveLength(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates and caches RiotEvents without throwing when lockfile is absent", async () => {
    const client = new RiotClient({
      lockfilePath: "non-existent-path/lockfile",
    });

    const events1 = client.events();
    expect(events1).toBeDefined();
    const events2 = client.events();
    expect(events2).toBe(events1);

    await client.close();
  });

  describe("matches, mmr, live match, and party facade methods", () => {
    const tempDir = path.join(__dirname, "tmp-test-matches-facade");
    const lockfilePath = path.join(tempDir, "lockfile");
    const matchDetailsFixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "fixtures", "matchDetails.json"), "utf-8"),
    );
    const mmrFixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "fixtures", "mmr.json"), "utf-8"),
    );

    const mockLocalApi = {
      entitlementsToken: async () => ({
        accessToken: "access",
        token: "token",
        subject: "self-puuid",
      }),
      valorantSession: async () => ({
        region: "na",
        shard: "na",
      }),
      close: async () => undefined,
    } as unknown as RiotClientLocalApi;

    const mockValorantApi = {
      getClientVersion: async () => "1.0.0",
      getCatalogue: async () => new Catalogue(catalogueData),
    } as unknown as ValorantApi;

    const setupClient = (gatewayOverrides: Partial<HttpGateway> = {}) => {
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

      const defaultGateway = {
        get: vi.fn().mockImplementation(async (url: string) => {
          if (url.includes("/match-history/v1/history/")) {
            return {
              History: [
                {
                  MatchID: "match-std-1",
                  GameStartTime: 1700000000000,
                  QueueID: "competitive",
                },
              ],
            };
          }
          if (url.includes("/match-details/v1/matches/")) {
            return matchDetailsFixture;
          }
          if (url.includes("/mmr/v1/players/") && url.includes("/competitiveupdates")) {
            return {
              Version: 1,
              Subject: "self-puuid",
              Matches: [mmrFixture.LatestCompetitiveUpdate],
            };
          }
          if (url.includes("/mmr/v1/players/")) {
            return mmrFixture;
          }
          return {};
        }),
        getOrNull: vi.fn().mockResolvedValue(null),
        put: vi
          .fn()
          .mockResolvedValue([{ Subject: "self-puuid", GameName: "SelfPlayer", TagLine: "TAG" }]),
        post: vi.fn().mockResolvedValue({}),
        ...gatewayOverrides,
      } as unknown as HttpGateway;

      return new RiotClient({
        lockfilePath,
        gateway: defaultGateway,
        valorantApi: mockValorantApi,
        localApiFactory: () => mockLocalApi,
      });
    };

    it("fetches match summaries and single match details", async () => {
      const client = setupClient();
      try {
        const summaries = await client.matches.list({ count: 1 });
        expect(summaries).toHaveLength(1);
        expect(summaries[0]?.id).toBe("match-std-1");
        expect(summaries[0]?.map.name).toBe("Ascent");
        expect(summaries[0]?.queue).toBe("competitive");

        const match = await client.matches.get("match-std-1");
        expect(match.id).toBe("match-std-1");
        expect(match.map.name).toBe("Ascent");
        expect(match.self?.team).toBe("Blue");
        expect(match.players[0]?.gameName).toBe("SelfPlayer");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("fetches MMR and rank history", async () => {
      const client = setupClient();
      try {
        const mmr = await client.matches.mmr();
        expect(mmr.current?.tier).toBe(3);
        expect(mmr.current?.name).toBe("Iron 3");
        expect(mmr.current?.rating).toBe(75);
        expect(mmr.act?.wins).toBe(15);

        const history = await client.matches.rankHistory({ count: 5 });
        expect(history).toHaveLength(1);
        expect(history[0]?.after.name).toBe("Iron 3");
        expect(history[0]?.earned).toBe(20);
        expect(history[0]?.movement).toBe("up");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("fetches live match in pregame phase", async () => {
      const client = setupClient({
        getOrNull: vi.fn().mockImplementation(async (url: string) => {
          if (url.includes("/pregame/v1/players/")) return { MatchID: "pre-1" };
          return null;
        }),
        get: vi.fn().mockImplementation(async (url: string) => {
          if (url.includes("/pregame/v1/matches/pre-1")) {
            return {
              ID: "pre-1",
              QueueID: "competitive",
              MapID: "/Game/Maps/Ascent/Ascent",
              ProvisioningFlowID: "Matchmaking",
              Phase: "CharacterSelectFinished",
              AllyTeam: {
                Players: [
                  {
                    Subject: "self-puuid",
                    CharacterID: "agent-1",
                    CharacterSelectionState: "locked",
                  },
                ],
              },
              EnemyTeam: { Players: [] },
            };
          }
          if (url.includes("/mmr/v1/players/")) return mmrFixture;
          return {};
        }),
      });

      try {
        const live = await client.matches.live({ ranks: true });
        expect(live.phase).toBe("pregame");
        if (live.phase === "pregame") {
          expect(live.matchId).toBe("pre-1");
          expect(live.map?.name).toBe("Ascent");
          expect(live.allies).toHaveLength(1);
          expect(live.allies[0]?.gameName).toBe("SelfPlayer");
          expect(live.allies[0]?.rank?.name).toBe("Iron 3");
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("fetches live match in coregame and shooting range phase", async () => {
      const client = setupClient({
        getOrNull: vi.fn().mockImplementation(async (url: string) => {
          if (url.includes("/pregame/v1/players/")) return null;
          if (url.includes("/core-game/v1/players/")) return { MatchID: "core-1" };
          if (url.includes("/loadouts")) return { Loadouts: [] };
          return null;
        }),
        get: vi.fn().mockImplementation(async (url: string) => {
          if (url.includes("/core-game/v1/matches/core-1")) {
            return {
              MatchID: "core-1",
              QueueID: "competitive",
              MapID: "/Game/Maps/Ascent/Ascent",
              ModeID: "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
              ProvisioningFlow: "Matchmaking",
              Players: [
                {
                  Subject: "self-puuid",
                  TeamID: "Blue",
                  CharacterID: "agent-1",
                },
              ],
            };
          }
          return {};
        }),
      });

      try {
        const live = await client.matches.live();
        expect(live.phase).toBe("ingame");
        if (live.phase === "ingame") {
          expect(live.matchId).toBe("core-1");
          expect(live.map?.name).toBe("Ascent");
          expect(live.allies).toHaveLength(1);
        }

        // Shooting range
        const rangeClient = setupClient({
          getOrNull: vi.fn().mockImplementation(async (url: string) => {
            if (url.includes("/pregame/v1/players/")) return null;
            if (url.includes("/core-game/v1/players/")) return { MatchID: "range-1" };
            return null;
          }),
          get: vi.fn().mockImplementation(async (url: string) => {
            if (url.includes("/core-game/v1/matches/range-1")) {
              return {
                MatchID: "range-1",
                ProvisioningFlow: "ShootingRange",
              };
            }
            return {};
          }),
        });

        const range = await rangeClient.matches.live();
        expect(range.phase).toBe("range");
        if (range.phase === "range") {
          expect(range.matchId).toBe("range-1");
        }

        // None
        const noneClient = setupClient({
          getOrNull: vi.fn().mockResolvedValue(null),
        });
        const none = await noneClient.matches.live();
        expect(none.phase).toBe("none");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("fetches party info or null when not in party", async () => {
      const client = setupClient({
        getOrNull: vi.fn().mockImplementation(async (url: string) => {
          if (url.includes("/parties/v1/players/")) return { CurrentPartyID: "party-1" };
          return null;
        }),
        get: vi.fn().mockImplementation(async (url: string) => {
          if (url.includes("/parties/v1/parties/party-1")) {
            return {
              ID: "party-1",
              MUCName: "muc-1",
              VoiceRoomID: "voice-1",
              State: "DEFAULT",
              MatchmakingData: {
                QueueID: "competitive",
              },
              Accessibility: "OPEN",
              Members: [
                {
                  Subject: "self-puuid",
                  IsOwner: true,
                  IsReady: true,
                  Ping: 25,
                },
              ],
            };
          }
          return {};
        }),
      });

      try {
        const party = await client.party.current();
        expect(party).not.toBeNull();
        expect(party?.id).toBe("party-1");
        expect(party?.queue).toBe("competitive");
        expect(party?.accessibility).toBe("open");
        expect(party?.members).toHaveLength(1);
        expect(party?.members[0]?.gameName).toBe("SelfPlayer");
        expect(party?.members[0]?.owner).toBe(true);

        const noPartyClient = setupClient({
          getOrNull: vi.fn().mockResolvedValue(null),
        });
        const noParty = await noPartyClient.party.current();
        expect(noParty).toBeNull();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("validates social writes locally and sends network requests only when valid", async () => {
      const tempDir = path.join(__dirname, "tmp-test-social-writes");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const lockfilePath = path.join(tempDir, "lockfile");
      fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

      const postSpy = vi.fn().mockResolvedValue({ id: "sent-1", time: "12345" });
      const deleteSpy = vi.fn().mockResolvedValue({});

      const mockLocalApi = {
        entitlementsToken: async () => ({ accessToken: "a", token: "t", subject: "self-puuid" }),
        valorantSession: async () => ({ region: "na", shard: "na" }),
        get: vi.fn().mockImplementation(async (path: string) => {
          if (path.includes("/chat/v4/friends"))
            return {
              friends: [
                {
                  puuid: "f1",
                  game_name: "Friend1",
                  game_tag: "001",
                  region: "la1",
                },
              ],
            };
          if (path.includes("/chat/v4/presences")) return { presences: [] };
          if (path.includes("/chat/v4/friendrequests"))
            return {
              requests: [
                { puuid: "r1", game_name: "Req", game_tag: "002", subscription: "pending_in" },
                { puuid: "r2", game_name: "Sent", game_tag: "003", subscription: "pending_out" },
              ],
            };
          if (path.includes("/chat/v4/blocked"))
            return { blocked: [{ puuid: "b1", game_name: "Block", game_tag: "004" }] };
          if (path.includes("/chat/v7/conversations"))
            return { conversations: [{ cid: "f1@la1.pvp.net", type: "chat" }] };
          if (path.includes("/chat/v1/session"))
            return { puuid: "self-puuid", game_name: "Me", game_tag: "000" };
          return null;
        }),
        post: postSpy,
        delete: deleteSpy,
        close: vi.fn(),
      } as unknown as RiotClientLocalApi;

      const mockValorantApi = {
        getCatalogue: async () => new Catalogue(catalogueData),
      } as unknown as ValorantApi;

      const client = new RiotClient({
        lockfilePath,
        valorantApi: mockValorantApi,
        localApiFactory: () => mockLocalApi,
      });

      try {
        // 1. sendMessage validation failure: not a friend -> no post
        await expect(client.social.sendMessage({ puuid: "unknown" }, "hi")).rejects.toThrow(
          ValidationError,
        );
        expect(postSpy).not.toHaveBeenCalled();

        // 2. sendMessage success: sends post and returns message
        const msg = await client.social.sendMessage({ puuid: "f1" }, "hi friend");
        expect(msg.body).toBe("hi friend");
        expect(postSpy).toHaveBeenCalledWith("/chat/v6/messages", {
          cid: "f1@la1.pvp.net",
          message: "hi friend",
          type: "chat",
        });
        postSpy.mockClear();

        // 3. sendFriendRequest failure: already friends -> no post
        await expect(client.social.sendFriendRequest("Friend1#001")).rejects.toThrow(
          ValidationError,
        );
        expect(postSpy).not.toHaveBeenCalled();

        // 4. sendFriendRequest success: sends post and returns requests
        await client.social.sendFriendRequest("NewGuy#999");
        expect(postSpy).toHaveBeenCalledWith("/chat/v4/friendrequests", {
          game_name: "NewGuy",
          game_tag: "999",
        });
        postSpy.mockClear();

        // 5. acceptFriendRequest failure: missing request -> no post
        await expect(client.social.acceptFriendRequest("missing-puuid")).rejects.toThrow(
          ValidationError,
        );
        expect(postSpy).not.toHaveBeenCalled();

        // 6. acceptFriendRequest success: sends request with player's name & tag
        await client.social.acceptFriendRequest("r1");
        expect(postSpy).toHaveBeenCalledWith("/chat/v4/friendrequests", {
          game_name: "Req",
          game_tag: "002",
        });
        postSpy.mockClear();

        // 7. removeFriend failure: not a friend -> no delete
        await expect(client.social.removeFriend("not-friend")).rejects.toThrow(ValidationError);
        expect(deleteSpy).not.toHaveBeenCalled();

        // 8. removeFriend success: sends delete
        await client.social.removeFriend("f1");
        expect(deleteSpy).toHaveBeenCalledWith("/chat/v4/friends", { puuid: "f1" });
        deleteSpy.mockClear();

        // 9. blockPlayer failure: unknown player -> no post
        await expect(client.social.blockPlayer("UnknownGuy#000")).rejects.toThrow(ValidationError);
        expect(postSpy).not.toHaveBeenCalled();

        // 10. blockPlayer success: resolves name#tag through friends or requests
        await client.social.blockPlayer("Req#002");
        expect(postSpy).toHaveBeenCalledWith("/chat/v4/blocked", { puuid: "r1" });
        postSpy.mockClear();

        // 11. unblockPlayer failure: not blocked -> no delete
        await expect(client.social.unblockPlayer("not-blocked")).rejects.toThrow(ValidationError);
        expect(deleteSpy).not.toHaveBeenCalled();

        // 12. unblockPlayer success: sends delete
        await client.social.unblockPlayer("b1");
        expect(deleteSpy).toHaveBeenCalledWith("/chat/v4/blocked", { puuid: "b1" });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("validates loadout writes locally and sends network requests only when valid", async () => {
      const tempDir = path.join(__dirname, "tmp-test-loadout-writes");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const lockfilePath = path.join(tempDir, "lockfile");
      fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

      const entitlementsFixture = JSON.parse(
        fs.readFileSync(path.join(__dirname, "fixtures", "entitlements.json"), "utf-8"),
      );

      let currentRawLoadout = {
        Subject: "self-puuid",
        Version: 1,
        Guns: [
          {
            ID: "ee613ee3-4eb0-ab0e-0888-64939b533ee7",
            SkinID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
            SkinLevelID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
            ChromaID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
            Attachments: [],
          },
        ],
        ActiveExpressions: [],
        Identity: {
          PlayerCardID: "33cd272d-4860-9118-2e06-95bb39ad0419",
          PlayerTitleID: "7a85e65d-4f11-c918-0929-c7931f6087d1",
          AccountLevel: 50,
          PreferredLevelBorderID: "border-1",
          HideAccountLevel: false,
        },
        Incognito: false,
      };

      const putSpy = vi.fn().mockImplementation(async (url: string, body: unknown) => {
        if (url.includes("/name-service/v2/players")) {
          return [{ Subject: "self-puuid", GameName: "SelfPlayer", TagLine: "TAG" }];
        }
        if (url.includes("/playerloadout")) {
          currentRawLoadout = body as typeof currentRawLoadout;
          return currentRawLoadout;
        }
        return {};
      });

      const getSpy = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/store/v1/entitlements/")) return entitlementsFixture;
        if (url.includes("/store/v1/wallet/")) return { Balances: {} };
        if (url.includes("/account-xp/v1/players/")) return { Progress: { Level: 50, XP: 0 } };
        if (url.includes("/personalization/v3/players/") && url.includes("/playerloadout")) {
          return currentRawLoadout;
        }
        return {};
      });

      const mockLocalApi = {
        entitlementsToken: async () => ({ accessToken: "a", token: "t", subject: "self-puuid" }),
        valorantSession: async () => ({ region: "na", shard: "na" }),
        close: vi.fn(),
      } as unknown as RiotClientLocalApi;

      const mockValorantApi = {
        getClientVersion: async () => "1.0.0",
        getCatalogue: async () => new Catalogue(catalogueData),
      } as unknown as ValorantApi;

      const client = new RiotClient({
        lockfilePath,
        gateway: {
          get: getSpy,
          put: putSpy,
          post: vi.fn().mockResolvedValue({}),
          getOrNull: vi.fn().mockResolvedValue(null),
        } as unknown as HttpGateway,
        valorantApi: mockValorantApi,
        localApiFactory: () => mockLocalApi,
      });

      try {
        // 1. Validation failure: unowned skin -> no PUT sent to loadout
        await expect(
          client.account.equip({
            guns: [{ weapon: "Vandal", skin: "14f05da8-4ff6-4b8a-b9c1-52a1215b2447" }],
          }),
        ).rejects.toThrow(ValidationError);

        expect(
          putSpy.mock.calls.filter((c) => (c[0] as string).includes("/playerloadout")),
        ).toHaveLength(0);

        // 2. Validation failure: duplicate weapon in equipCollection -> no PUT
        await expect(
          client.account.equipCollection([
            "4324a482-47da-4521-b3b0-4dbfcfefd779",
            "8908f237-47b2-031a-e905-1a89c93cc8f5",
          ]),
        ).rejects.toThrow(ValidationError);

        expect(
          putSpy.mock.calls.filter((c) => (c[0] as string).includes("/playerloadout")),
        ).toHaveLength(0);

        // 3. Validation success: equip owned skin
        const updated = await client.account.equip({
          guns: [{ weapon: "Vandal", skin: "8908f237-47b2-031a-e905-1a89c93cc8f5" }],
          incognito: true,
        });

        expect(updated.guns[0]?.skin.name).toBe("Prime Vandal");
        expect(updated.incognito).toBe(true);

        const loadoutPuts = putSpy.mock.calls.filter((c) =>
          (c[0] as string).includes("/playerloadout"),
        );
        expect(loadoutPuts).toHaveLength(1);
        const sentBody = loadoutPuts[0]?.[1] as RiotLoadoutResponse;
        expect(sentBody.Subject).toBe("self-puuid");
        expect(sentBody.Incognito).toBe(true);
        expect(sentBody.Guns[0]?.SkinID).toBe("8908f237-47b2-031a-e905-1a89c93cc8f5");
        expect(sentBody.Guns[0]?.Attachments).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
