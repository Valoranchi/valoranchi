import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApi } from "../src/catalogue/ValorantApi.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { AccountValidator } from "../src/client/AccountValidator.js";
import { MatchValidator } from "../src/client/MatchValidator.js";
import { PartyValidator } from "../src/client/PartyValidator.js";
import { StoreValidator } from "../src/client/StoreValidator.js";
import { RiotClientNotRunningError, ValidationError } from "../src/errors.js";
import type { RiotClientLocalApi } from "../src/local/RiotClientLocalApi.js";
import type { OwnedItems, Store, Wallet } from "../src/model/index.js";
import { RiotClient } from "../src/RiotClient.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";
import {
  ENTITLEMENT_ITEM_TYPES,
  type RiotContractsResponse,
  type RiotCoreGamePlayerResponse,
  type RiotCustomGameConfigsResponse,
  type RiotEntitlementsResponse,
  type RiotFavoritesResponse,
  type RiotPartyPlayerResponse,
  type RiotPartyResponse,
  type RiotPregameMatchResponse,
  type RiotPregamePlayerResponse,
} from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;
const catalogue = new Catalogue(catalogueData);

function createOwnedItems(overrides?: Partial<OwnedItems>): OwnedItems {
  return {
    language: "en-US",
    generatedAt: "2026-09-29T12:00:00.000Z",
    player: {
      puuid: "me",
      gameName: "P",
      tagLine: "T",
      region: "na",
      shard: "na",
      accountLevel: 1,
    },
    weapons: [],
    buddies: [],
    sprays: [],
    cards: [],
    titles: [],
    agents: [],
    ...overrides,
  };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riot-client-writes-"));
const lockfilePath = path.join(dir, "lockfile");
fs.writeFileSync(lockfilePath, "Riot Client:1:2:secret:https");
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const localPost = vi.fn();
const localApi = {
  entitlementsToken: async () => ({ accessToken: "a", token: "t", subject: "me" }),
  valorantSession: async () => ({ region: "na", shard: "na" }),
  get: async (route: string) => (route.includes("session") ? { puuid: "me" } : {}),
  post: localPost,
  delete: vi.fn(),
  close: async () => undefined,
} as unknown as RiotClientLocalApi;

const put = vi.fn().mockResolvedValue([]);
const post = vi.fn().mockResolvedValue({});
const gateway = {
  get: vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("/personalization/")) {
      return {
        Subject: "me",
        Version: 1,
        Guns: [],
        ActiveExpressions: [],
        Identity: {},
        Incognito: false,
      };
    }
    if (url.includes("/entitlements/")) return { EntitlementsByTypes: [] };
    if (url.includes("/account-xp/")) return { Progress: { Level: 10, XP: 0 } };
    if (url.includes("/parties/v1/players/")) return { Subject: "me", CurrentPartyID: "party-1" };
    if (url.includes("/parties/v1/parties/")) {
      return {
        ID: "party-1",
        State: "DEFAULT",
        Accessibility: "CLOSED",
        EligibleQueues: ["competitive"],
        Members: [{ Subject: "me", IsOwner: true, IsReady: false }],
      };
    }
    return {};
  }),
  put,
  post,
  delete: vi.fn(),
  getOrNull: vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("/parties/v1/players/")) return { Subject: "me", CurrentPartyID: "party-1" };
    return null;
  }),
} as unknown as HttpGateway;

const client = new RiotClient({
  lockfilePath,
  catalogueDir: null,
  gateway,
  valorantApi: {
    getClientVersion: async () => "v",
    getCatalogue: async () => new Catalogue(catalogueData),
  } as unknown as ValorantApi,
  localApiFactory: () => localApi,
});

describe("refused writes never reach Riot", () => {
  it("does not put a loadout with a card the account does not own", async () => {
    await expect(
      client.account.equip({ card: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(put.mock.calls.some(([url]) => String(url).includes("/personalization/"))).toBe(false);
  });

  it("does not put a loadout preset with a card the account does not own", async () => {
    await expect(
      client.account.equipPreset({ card: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(put.mock.calls.some(([url]) => String(url).includes("/personalization/"))).toBe(false);
  });

  it("does not post a message to someone who is not a friend", async () => {
    await expect(
      client.social.sendMessage({ puuid: "00000000-0000-0000-0000-000000000000" }, "hi"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(localPost).not.toHaveBeenCalled();
  });

  it("does not start matchmaking when party member is not ready", async () => {
    await expect(client.party.startMatchmaking()).rejects.toBeInstanceOf(ValidationError);
    expect(post.mock.calls.some(([url]) => String(url).includes("/matchmaking/join"))).toBe(false);
  });

  it("does not invite with an invalid riot id", async () => {
    await expect(client.party.invite("invalid-id")).rejects.toBeInstanceOf(ValidationError);
    expect(post.mock.calls.some(([url]) => String(url).includes("/invites/"))).toBe(false);
  });

  it("refuses contract activation if contract is not for an agent (contract-not-agent)", () => {
    const catalogue = new Catalogue(catalogueData);
    const rawContracts: RiotContractsResponse = {
      Version: 1,
      Subject: "me",
      Contracts: [],
      ProcessedMatches: [],
      ActiveSpecialContract: "",
      Missions: [],
    };
    const emptyOwned = createOwnedItems();

    expect(() =>
      AccountValidator.validateActivateContract(
        rawContracts,
        emptyOwned,
        catalogue,
        "contract-battlepass-1",
      ),
    ).toThrowError(
      expect.objectContaining({
        reason: "contract-not-agent",
      }),
    );
  });

  it("refuses contract activation if the agent is already owned (agent-owned)", () => {
    const catalogue = new Catalogue(catalogueData);
    const rawContracts: RiotContractsResponse = {
      Version: 1,
      Subject: "me",
      Contracts: [],
      ProcessedMatches: [],
      ActiveSpecialContract: "",
      Missions: [],
    };
    const ownedWithAgent = createOwnedItems({
      agents: [
        {
          uuid: "add6443a-41bd-e414-f6ad-e58d267f4e95",
          name: "Jett",
          role: "Duelist",
          icon: null,
        },
      ],
    });

    expect(() =>
      AccountValidator.validateActivateContract(
        rawContracts,
        ownedWithAgent,
        catalogue,
        "contract-jett-1",
      ),
    ).toThrowError(
      expect.objectContaining({
        reason: "agent-owned",
      }),
    );
  });

  it("refuses contract activation if contract is already active (contract-active)", () => {
    const catalogue = new Catalogue(catalogueData);
    const rawContracts: RiotContractsResponse = {
      Version: 1,
      Subject: "me",
      Contracts: [],
      ProcessedMatches: [],
      ActiveSpecialContract: "contract-jett-1",
      Missions: [],
    };
    const emptyOwned = createOwnedItems();

    expect(() =>
      AccountValidator.validateActivateContract(
        rawContracts,
        emptyOwned,
        catalogue,
        "contract-jett-1",
      ),
    ).toThrowError(
      expect.objectContaining({
        reason: "contract-active",
      }),
    );
  });

  it("refuses adding favourite if already favorited (already-favourite)", () => {
    const catalogue = new Catalogue(catalogueData);
    const skinUuid = "8908f237-47b2-031a-e905-1a89c93cc8f5";
    const rawFavorites: RiotFavoritesResponse = {
      Subject: "me",
      FavoritedContent: {
        "fav-1": { ItemID: skinUuid, FavoriteID: "fav-1" },
      },
    };
    const ownedWithSkin = createOwnedItems({
      weapons: [
        {
          uuid: "w-1",
          name: "Vandal",
          category: "Rifle",
          skinsOwned: 1,
          skinsTotal: 2,
          skins: [
            {
              uuid: skinUuid,
              name: "Prime Vandal",
              tier: null,
              icon: "d",
              levels: [],
              chromas: [],
            },
          ],
        },
      ],
    });

    expect(() =>
      AccountValidator.validateAddFavourite(rawFavorites, ownedWithSkin, catalogue, skinUuid),
    ).toThrowError(
      expect.objectContaining({
        reason: "already-favourite",
      }),
    );
  });

  it("refuses removing favourite if skin is not in favourites (not-favourite)", () => {
    const catalogue = new Catalogue(catalogueData);
    const skinUuid = "8908f237-47b2-031a-e905-1a89c93cc8f5";
    const rawFavorites: RiotFavoritesResponse = {
      Subject: "me",
      FavoritedContent: {},
    };

    expect(() =>
      AccountValidator.validateRemoveFavourite(rawFavorites, catalogue, skinUuid),
    ).toThrowError(
      expect.objectContaining({
        reason: "not-favourite",
      }),
    );
  });

  it("refuses buy if confirm flag is not passed (confirm-required)", () => {
    const mockStore: Store = {
      player: {
        puuid: "me",
        gameName: "P",
        tagLine: "T",
        region: "na",
        shard: "na",
        accountLevel: 1,
      },
      fetchedAt: "now",
      daily: null,
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    };
    const emptyOwned = createOwnedItems();
    const mockWallet: Wallet = {
      valorantPoints: 5000,
      radianite: 100,
      kingdomCredits: 10000,
    };

    expect(() =>
      StoreValidator.validateBuy(
        mockStore,
        emptyOwned,
        mockWallet,
        { offerId: "any-offer" },
        false,
      ),
    ).toThrowError(
      expect.objectContaining({
        reason: "confirm-required",
      }),
    );
  });

  it("refuses buy if offer is not in store (offer-not-in-store)", () => {
    const mockStore: Store = {
      player: {
        puuid: "me",
        gameName: "P",
        tagLine: "T",
        region: "na",
        shard: "na",
        accountLevel: 1,
      },
      fetchedAt: "now",
      daily: {
        endsAt: "later",
        offers: [],
      },
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    };
    const emptyOwned = createOwnedItems();
    const mockWallet: Wallet = {
      valorantPoints: 5000,
      radianite: 100,
      kingdomCredits: 10000,
    };

    expect(() =>
      StoreValidator.validateBuy(
        mockStore,
        emptyOwned,
        mockWallet,
        { offerId: "missing-offer" },
        true,
      ),
    ).toThrowError(
      expect.objectContaining({
        reason: "offer-not-in-store",
      }),
    );
  });

  it("refuses buy if item is already owned (already-owned)", () => {
    const skinUuid = "8908f237-47b2-031a-e905-1a89c93cc8f5";
    const mockStore: Store = {
      player: {
        puuid: "me",
        gameName: "P",
        tagLine: "T",
        region: "na",
        shard: "na",
        accountLevel: 1,
      },
      fetchedAt: "now",
      daily: {
        endsAt: "later",
        offers: [
          {
            offerId: "prime-offer-id",
            cost: {
              currency: "Valorant Points",
              currencyUuid: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
              amount: 1775,
            },
            item: {
              kind: "skin",
              uuid: skinUuid,
              name: "Prime Vandal",
              weapon: "Vandal",
              tier: null,
              icon: "icon",
              levelUuid: "lvl-1",
            },
          },
        ],
      },
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    };
    const ownedWithSkin = createOwnedItems({
      weapons: [
        {
          uuid: "w-1",
          name: "Vandal",
          category: "Rifle",
          skinsOwned: 1,
          skinsTotal: 2,
          skins: [
            {
              uuid: skinUuid,
              name: "Prime Vandal",
              tier: null,
              icon: "icon",
              levels: [],
              chromas: [],
            },
          ],
        },
      ],
    });
    const mockWallet: Wallet = {
      valorantPoints: 5000,
      radianite: 100,
      kingdomCredits: 10000,
    };

    expect(() =>
      StoreValidator.validateBuy(
        mockStore,
        ownedWithSkin,
        mockWallet,
        { offerId: "prime-offer-id" },
        true,
      ),
    ).toThrowError(
      expect.objectContaining({
        reason: "already-owned",
      }),
    );
  });

  it("refuses buy if wallet has insufficient funds (insufficient-funds)", () => {
    const skinUuid = "8908f237-47b2-031a-e905-1a89c93cc8f5";
    const mockStore: Store = {
      player: {
        puuid: "me",
        gameName: "P",
        tagLine: "T",
        region: "na",
        shard: "na",
        accountLevel: 1,
      },
      fetchedAt: "now",
      daily: {
        endsAt: "later",
        offers: [
          {
            offerId: "prime-offer-id",
            cost: {
              currency: "Valorant Points",
              currencyUuid: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
              amount: 1775,
            },
            item: {
              kind: "skin",
              uuid: skinUuid,
              name: "Prime Vandal",
              weapon: "Vandal",
              tier: null,
              icon: "icon",
              levelUuid: "lvl-1",
            },
          },
        ],
      },
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    };
    const emptyOwned = createOwnedItems();
    const brokeWallet: Wallet = {
      valorantPoints: 500, // 500 < 1775
      radianite: 0,
      kingdomCredits: 0,
    };

    expect(() =>
      StoreValidator.validateBuy(
        mockStore,
        emptyOwned,
        brokeWallet,
        { offerId: "prime-offer-id" },
        true,
      ),
    ).toThrowError(
      expect.objectContaining({
        reason: "insufficient-funds",
      }),
    );
  });

  it("refuses night market reveal if night market is not active (night-market-missing)", () => {
    const mockStore: Store = {
      player: {
        puuid: "me",
        gameName: "P",
        tagLine: "T",
        region: "na",
        shard: "na",
        accountLevel: 1,
      },
      fetchedAt: "now",
      daily: null,
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    };

    expect(() => StoreValidator.validateNightMarket(mockStore)).toThrowError(
      expect.objectContaining({
        reason: "night-market-missing",
      }),
    );
  });

  it("refuses night market reveal if all offers are already revealed (night-market-revealed)", () => {
    const mockStore: Store = {
      player: {
        puuid: "me",
        gameName: "P",
        tagLine: "T",
        region: "na",
        shard: "na",
        accountLevel: 1,
      },
      fetchedAt: "now",
      daily: null,
      nightMarket: {
        endsAt: "later",
        offers: [
          {
            offerId: "nm-1",
            cost: { currency: "Valorant Points", currencyUuid: "vp", amount: 1000 },
            discountedCost: { currency: "Valorant Points", currencyUuid: "vp", amount: 500 },
            discountPercent: 50,
            seen: true,
            item: {
              kind: "skin",
              uuid: "skin-1",
              name: "Skin 1",
              weapon: "Vandal",
              tier: null,
              icon: "icon",
              levelUuid: "lvl-1",
            },
          },
        ],
      },
      bundles: null,
      accessories: null,
      radianite: [],
    };

    expect(() => StoreValidator.validateNightMarket(mockStore)).toThrowError(
      expect.objectContaining({
        reason: "night-market-revealed",
      }),
    );
  });
});

describe("live actions and party refusal validators for all 15 reasons", () => {
  const jettUuid = "add6443a-41bd-e414-f6ad-e58d267f4e95";

  const entitlements: RiotEntitlementsResponse = {
    EntitlementsByTypes: [
      {
        ItemTypeID: ENTITLEMENT_ITEM_TYPES.agent,
        Entitlements: [{ ItemID: jettUuid, TypeID: ENTITLEMENT_ITEM_TYPES.agent }],
      },
    ],
  };

  const pregameMatch = {
    ID: "match-pregame-1",
    AllyTeam: {
      TeamID: "Blue",
      Players: [
        {
          Subject: "me",
          CharacterID: "",
          CharacterSelectionState: "",
          PregamePlayerState: "joined",
          CompetitiveTier: 0,
          PlayerIdentity: {},
        },
      ],
    },
  } as unknown as RiotPregameMatchResponse;

  const customConfigs = {
    Enabled: true,
    Queues: [],
    EnabledMaps: ["/Game/Maps/Ascent/Ascent"],
    EnabledModes: ["/Game/GameModes/Bomb/BombGameMode.BombGameMode_C"],
    GamePodPingServiceInfo: {
      "aresriot.aws-rso-pdx1.us-west-2": { SecurityHash: 1, PingProxyAddress: "1.1.1.1" },
    },
  } as unknown as RiotCustomGameConfigsResponse;

  const customParty = {
    ID: "party-custom-1",
    State: "CUSTOM_GAME",
    Accessibility: "CLOSED",
    Members: [{ Subject: "me", IsOwner: true }],
  } as unknown as RiotPartyResponse;

  it("refuses actions when not in pregame (not-in-pregame)", () => {
    expect(() =>
      MatchValidator.validateSelectOrLock(null, catalogue, entitlements, "Jett", "me"),
    ).toThrowError(expect.objectContaining({ reason: "not-in-pregame" }));

    expect(() => MatchValidator.validateDodge(null, { confirm: true })).toThrowError(
      expect.objectContaining({ reason: "not-in-pregame" }),
    );
  });

  it("refuses unknown or non-playable agent (unknown-agent)", () => {
    expect(() =>
      MatchValidator.validateSelectOrLock(
        pregameMatch,
        catalogue,
        entitlements,
        "NonExistentAgent",
        "me",
      ),
    ).toThrowError(expect.objectContaining({ reason: "unknown-agent" }));
  });

  it("refuses agent not owned by player (agent-not-owned)", () => {
    expect(() =>
      MatchValidator.validateSelectOrLock(
        pregameMatch,
        catalogue,
        { EntitlementsByTypes: [] },
        "Phoenix",
        "me",
      ),
    ).toThrowError(expect.objectContaining({ reason: "agent-not-owned" }));
  });

  it("refuses agent already locked by an ally (agent-locked-by-ally)", () => {
    const allyLockedMatch = {
      ID: "m1",
      AllyTeam: {
        TeamID: "Blue",
        Players: [
          {
            Subject: "ally-puuid",
            CharacterID: jettUuid,
            CharacterSelectionState: "locked",
            PregamePlayerState: "joined",
            CompetitiveTier: 0,
            PlayerIdentity: {},
          },
          {
            Subject: "me",
            CharacterID: "",
            CharacterSelectionState: "",
            PregamePlayerState: "joined",
            CompetitiveTier: 0,
            PlayerIdentity: {},
          },
        ],
      },
    } as unknown as RiotPregameMatchResponse;

    expect(() =>
      MatchValidator.validateSelectOrLock(allyLockedMatch, catalogue, entitlements, "Jett", "me"),
    ).toThrowError(expect.objectContaining({ reason: "agent-locked-by-ally" }));
  });

  it("refuses agent selection when self is already locked (already-locked)", () => {
    const selfLockedMatch = {
      ID: "m1",
      AllyTeam: {
        TeamID: "Blue",
        Players: [
          {
            Subject: "me",
            CharacterID: jettUuid,
            CharacterSelectionState: "locked",
            PregamePlayerState: "joined",
            CompetitiveTier: 0,
            PlayerIdentity: {},
          },
        ],
      },
    } as unknown as RiotPregameMatchResponse;

    expect(() =>
      MatchValidator.validateSelectOrLock(selfLockedMatch, catalogue, entitlements, "Jett", "me"),
    ).toThrowError(expect.objectContaining({ reason: "already-locked" }));
  });

  it("refuses dangerous actions without explicit confirmation (confirm-required)", async () => {
    expect(() =>
      MatchValidator.validateDodge({ MatchID: "m1" } as RiotPregamePlayerResponse, {}),
    ).toThrowError(expect.objectContaining({ reason: "confirm-required" }));

    expect(() =>
      MatchValidator.validateLeaveMatch({ MatchID: "m1" } as RiotCoreGamePlayerResponse, "me", {}),
    ).toThrowError(expect.objectContaining({ reason: "confirm-required" }));

    await expect(client.account.saveSettings({}, {})).rejects.toThrowError(
      expect.objectContaining({ reason: "confirm-required" }),
    );
  });

  it("refuses leave match when not in a match (not-in-match)", () => {
    expect(() => MatchValidator.validateLeaveMatch(null, "me", { confirm: true })).toThrowError(
      expect.objectContaining({ reason: "not-in-match" }),
    );
  });

  it("refuses join or decline when invite does not exist (invite-missing)", () => {
    const emptyPartyPlayer = { Subject: "me", Invites: [] } as unknown as RiotPartyPlayerResponse;
    expect(() => PartyValidator.validateJoin(emptyPartyPlayer, "p-missing")).toThrowError(
      expect.objectContaining({ reason: "invite-missing" }),
    );

    expect(() =>
      PartyValidator.validateDeclineInvite(emptyPartyPlayer, "inv-missing"),
    ).toThrowError(expect.objectContaining({ reason: "invite-missing" }));
  });

  it("refuses decline when join request does not exist (request-missing)", () => {
    const partyNoRequests = {
      ID: "p1",
      Members: [{ Subject: "me", IsOwner: true }],
      Requests: [],
    } as unknown as RiotPartyResponse;

    expect(() =>
      PartyValidator.validateDeclineRequest(partyNoRequests, "me", "req-missing"),
    ).toThrowError(expect.objectContaining({ reason: "request-missing" }));
  });

  it("refuses custom game commands when party is not in custom game mode (not-custom-game)", () => {
    const normalParty = {
      ID: "p1",
      State: "DEFAULT",
      Members: [{ Subject: "me", IsOwner: true }],
    } as unknown as RiotPartyResponse;

    expect(() => PartyValidator.validateCustomGame(normalParty, "me")).toThrowError(
      expect.objectContaining({ reason: "not-custom-game" }),
    );
  });

  it("refuses custom game settings when map is not enabled (map-not-enabled)", () => {
    expect(() =>
      PartyValidator.validateSetCustomGameSettings(
        customParty,
        "me",
        { map: "UnknownMap", mode: "Bomb", server: null, rules: {} },
        customConfigs,
        catalogue,
      ),
    ).toThrowError(expect.objectContaining({ reason: "map-not-enabled" }));
  });

  it("refuses custom game settings when mode is not enabled (mode-not-enabled)", () => {
    expect(() =>
      PartyValidator.validateSetCustomGameSettings(
        customParty,
        "me",
        { map: "Ascent", mode: "UnknownMode", server: null, rules: {} },
        customConfigs,
        catalogue,
      ),
    ).toThrowError(expect.objectContaining({ reason: "mode-not-enabled" }));
  });

  it("refuses server pods that are unknown (server-unknown)", () => {
    expect(() =>
      PartyValidator.validateSetCustomGameSettings(
        customParty,
        "me",
        { map: "Ascent", mode: "Bomb", server: "unknown-pod", rules: {} },
        customConfigs,
        catalogue,
      ),
    ).toThrowError(expect.objectContaining({ reason: "server-unknown" }));

    expect(() =>
      PartyValidator.validateSetPreferredServers(
        customParty,
        "me",
        ["unknown-pod"],
        ["aresriot.aws-rso-pdx1.us-west-2"],
      ),
    ).toThrowError(expect.objectContaining({ reason: "server-unknown" }));
  });

  it("refuses custom game start when no players are on any team (no-team-players)", () => {
    const partyNoTeams = {
      ID: "p1",
      State: "CUSTOM_GAME",
      Members: [{ Subject: "me", IsOwner: true }],
      CustomGameData: {
        Membership: { TeamOne: [], TeamTwo: [] },
      },
    } as unknown as RiotPartyResponse;

    expect(() => PartyValidator.validateStartCustomGame(partyNoTeams, "me")).toThrowError(
      expect.objectContaining({ reason: "no-team-players" }),
    );
  });

  describe("when neither Riot's preferences service nor the game answers", () => {
    const unreachableClient = new RiotClient({
      lockfilePath,
      catalogueDir: null,
      localApiFactory: () =>
        ({
          entitlementsToken: async () => {
            throw new RiotClientNotRunningError();
          },
          gameAuthorization: async () => null,
          close: async () => undefined,
        }) as unknown as RiotClientLocalApi,
    });

    it("refuses save settings (preferences-unavailable)", async () => {
      await expect(
        unreachableClient.account.saveSettings({}, { confirm: true }),
      ).rejects.toThrowError(expect.objectContaining({ reason: "preferences-unavailable" }));
    });

    it("still validates a settings save, because the game is not required", async () => {
      await expect(
        unreachableClient.account.validateSaveSettings({}, { confirm: true }),
      ).resolves.toEqual({ type: "Ares.PlayerSettings", data: {} });
    });
  });
});

describe("Refused live actions never send requests to Riot", () => {
  it("proves no network request is sent when agent lock fails validation", async () => {
    post.mockClear();
    await expect(client.matches.lockAgent("NonExistentAgent")).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("proves no network request is sent when dodge confirmation is omitted", async () => {
    post.mockClear();
    await expect(client.matches.dodge()).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("proves no network request is sent when leaveMatch confirmation is omitted", async () => {
    post.mockClear();
    await expect(client.matches.leaveMatch()).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("proves no network request is sent when custom game start has no teams", async () => {
    post.mockClear();
    await expect(client.party.startCustomGame()).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
