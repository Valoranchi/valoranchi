import { AccountProgressionBuilder } from "../collection/AccountProgressionBuilder.js";
import { CollectionBuilder } from "../collection/CollectionBuilder.js";
import { GameSessionBuilder } from "../collection/GameSessionBuilder.js";
import { LoadoutBuilder } from "../collection/LoadoutBuilder.js";
import { LoadoutWriter } from "../collection/LoadoutWriter.js";
import { PlayerSettingsBuilder } from "../collection/PlayerSettingsBuilder.js";
import { ValidationError } from "../errors.js";
import type {
  AccountXp,
  ClientInfo,
  CollectionValue,
  ContractProgress,
  Favourite,
  GameSession,
  Loadout,
  LoadoutDiff,
  Mission,
  OwnedItems,
  Penalty,
  Player,
  PlayerSettings,
  Wallet,
} from "../model/index.js";
import { diffLoadout, exportLoadout } from "../analysis/loadoutDiff.js";
import { collectionValue } from "../analysis/collectionValue.js";
import { StoreOffersBuilder } from "../collection/StoreOffersBuilder.js";
import {
  CURRENCY_UUIDS,
  type RiotLoadoutResponse,
  type RiotOffersResponse,
} from "../riot/types.js";
import { AccountValidator } from "./AccountValidator.js";
import type { AccountApi } from "./api.js";
import type { ClientContext } from "./ClientContext.js";
import { LoadoutValidator, type LoadoutChange, type LoadoutGunChange } from "./LoadoutValidator.js";

export class AccountService implements AccountApi {
  constructor(private readonly context: ClientContext) {}

  async whoami(): Promise<Player> {
    const session = await this.context.sessions.session();
    return this.context.player(session);
  }

  async ownedItems(options?: { language?: string }): Promise<OwnedItems> {
    const lang = options?.language ?? this.context.language;
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [player, entitlements, catalogue] = await Promise.all([
      this.context.player(session),
      api.entitlements(),
      this.context.catalogue(lang),
    ]);

    return new CollectionBuilder(player, entitlements, catalogue, lang).build();
  }

  async loadout(): Promise<Loadout> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [player, rawLoadout, catalogue] = await Promise.all([
      this.context.player(session),
      api.loadout(),
      this.context.catalogue(),
    ]);

    return new LoadoutBuilder(player, rawLoadout, catalogue).build();
  }

  async validateEquip(change: LoadoutChange): Promise<RiotLoadoutResponse> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    if (!this.hasLoadoutChanges(change)) {
      return api.loadout();
    }

    const [currentRaw, ownedItems, catalogue, rawEntitlements] = await Promise.all([
      api.loadout(),
      this.ownedItems(),
      this.context.catalogue(),
      api.entitlements(),
    ]);

    const validatedRaw = LoadoutValidator.validate(
      currentRaw,
      ownedItems,
      catalogue,
      rawEntitlements,
      change,
    );

    return LoadoutWriter.buildPutBody(validatedRaw);
  }

  async equip(change: LoadoutChange): Promise<Loadout> {
    if (!this.hasLoadoutChanges(change)) {
      return this.loadout();
    }

    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const putBody = await this.validateEquip(change);

    await api.putLoadout(putBody);
    api.invalidateLoadout();
    return this.loadout();
  }

  async validateEquipCollection(skinUuids: string[]): Promise<RiotLoadoutResponse> {
    if (!skinUuids || skinUuids.length === 0) {
      return this.validateEquip({});
    }
    const gunChanges = await this.resolveCollectionGunChanges(skinUuids);
    return this.validateEquip({ guns: gunChanges });
  }

  async equipCollection(skinUuids: string[]): Promise<Loadout> {
    if (!skinUuids || skinUuids.length === 0) {
      return this.loadout();
    }
    const gunChanges = await this.resolveCollectionGunChanges(skinUuids);
    return this.equip({ guns: gunChanges });
  }

  async diffLoadout(target: LoadoutChange | Loadout): Promise<LoadoutDiff> {
    const [current, catalogue] = await Promise.all([this.loadout(), this.context.catalogue()]);
    return diffLoadout(current, target, catalogue);
  }

  async equipPreset(preset: LoadoutChange): Promise<Loadout> {
    return this.equip(preset);
  }

  async validateEquipPreset(preset: LoadoutChange): Promise<RiotLoadoutResponse> {
    return this.validateEquip(preset);
  }

  async exportLoadout(): Promise<LoadoutChange> {
    const current = await this.loadout();
    return exportLoadout(current);
  }

  async collectionValue(): Promise<CollectionValue> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [owned, rawOffers, catalogue] = await Promise.all([
      this.ownedItems(),
      api.offers().catch(() => ({ Offers: [] }) as RiotOffersResponse),
      this.context.catalogue(),
    ]);
    const offers = new StoreOffersBuilder(catalogue).buildOffers(rawOffers);
    return collectionValue(owned, offers, catalogue);
  }

  private async resolveCollectionGunChanges(skinUuids: string[]): Promise<LoadoutGunChange[]> {
    const catalogue = await this.context.catalogue();
    const seenWeapons = new Set<string>();
    const gunChanges: LoadoutGunChange[] = [];

    for (const skinUuid of skinUuids) {
      const skin = catalogue.getSkin(skinUuid);
      if (!skin) {
        throw new ValidationError("unknown-item", `Unknown skin: ${skinUuid}`, { skin: skinUuid });
      }

      const weapon = catalogue.weapons.find((w) =>
        w.skins.some((s) => s.uuid.toLowerCase() === skin.uuid.toLowerCase()),
      );
      if (!weapon) {
        throw new ValidationError(
          "unknown-weapon",
          `No weapon found for skin: ${skin.displayName}`,
        );
      }

      const weaponKey = weapon.uuid.toLowerCase();
      if (seenWeapons.has(weaponKey)) {
        throw new ValidationError(
          "duplicate-weapon",
          `Multiple skins specified for weapon ${weapon.displayName}`,
          { weapon: weapon.uuid, skin: skin.uuid },
        );
      }
      seenWeapons.add(weaponKey);

      gunChanges.push({
        weapon: weapon.uuid,
        skin: skin.uuid,
      });
    }

    return gunChanges;
  }

  private hasLoadoutChanges(change?: LoadoutChange): boolean {
    if (!change) return false;
    return Boolean(
      change.guns?.length ||
      change.sprays?.length ||
      change.flex !== undefined ||
      change.card ||
      change.title ||
      change.levelBorder ||
      change.incognito !== undefined ||
      change.hideAccountLevel !== undefined,
    );
  }

  async wallet(): Promise<Wallet> {
    const session = await this.context.sessions.session();
    const rawWallet = await this.context.api(session).wallet();
    const balances = rawWallet.Balances ?? {};

    return {
      valorantPoints: balances[CURRENCY_UUIDS.valorantPoints] ?? 0,
      radianite: balances[CURRENCY_UUIDS.radianite] ?? 0,
      kingdomCredits: balances[CURRENCY_UUIDS.kingdomCredits] ?? 0,
    };
  }

  async xp(): Promise<AccountXp> {
    const session = await this.context.sessions.session();
    const raw = await this.context.api(session).accountXp();
    return AccountProgressionBuilder.buildAccountXp(raw);
  }

  async contracts(): Promise<ContractProgress[]> {
    const session = await this.context.sessions.session();
    const [raw, catalogue] = await Promise.all([
      this.context.api(session).contracts(),
      this.context.catalogue(),
    ]);
    return AccountProgressionBuilder.buildContracts(raw, catalogue);
  }

  async missions(): Promise<Mission[]> {
    const session = await this.context.sessions.session();
    const [raw, catalogue] = await Promise.all([
      this.context.api(session).contracts(),
      this.context.catalogue(),
    ]);
    return AccountProgressionBuilder.buildMissions(raw, catalogue);
  }

  async validateActivateContract(uuid: string): Promise<{ contractId: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawContracts, owned, catalogue] = await Promise.all([
      api.contracts(),
      this.ownedItems(),
      this.context.catalogue(),
    ]);
    return AccountValidator.validateActivateContract(rawContracts, owned, catalogue, uuid);
  }

  async activateContract(uuid: string): Promise<ContractProgress[]> {
    const validated = await this.validateActivateContract(uuid);
    const session = await this.context.sessions.session();
    await this.context.api(session).activateContract(validated.contractId);
    return this.contracts();
  }

  async penalties(): Promise<Penalty[]> {
    const session = await this.context.sessions.session();
    const raw = await this.context.api(session).penalties();
    return AccountProgressionBuilder.buildPenalties(raw);
  }

  async favourites(): Promise<Favourite[]> {
    const session = await this.context.sessions.session();
    const [raw, catalogue] = await Promise.all([
      this.context.api(session).favorites(),
      this.context.catalogue(),
    ]);
    return AccountProgressionBuilder.buildFavourites(raw, catalogue);
  }

  async validateAddFavourite(skin: string): Promise<{ ItemID: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawFavs, owned, catalogue] = await Promise.all([
      api.favorites(),
      this.ownedItems(),
      this.context.catalogue(),
    ]);
    return AccountValidator.validateAddFavourite(rawFavs, owned, catalogue, skin);
  }

  async addFavourite(skin: string): Promise<Favourite[]> {
    const validated = await this.validateAddFavourite(skin);
    const session = await this.context.sessions.session();
    await this.context.api(session).addFavorite(validated.ItemID);
    return this.favourites();
  }

  async validateRemoveFavourite(skin: string): Promise<{ itemIdWithoutDashes: string }> {
    const session = await this.context.sessions.session();
    const [rawFavs, catalogue] = await Promise.all([
      this.context.api(session).favorites(),
      this.context.catalogue(),
    ]);
    return AccountValidator.validateRemoveFavourite(rawFavs, catalogue, skin);
  }

  async removeFavourite(skin: string): Promise<Favourite[]> {
    const validated = await this.validateRemoveFavourite(skin);
    const session = await this.context.sessions.session();
    await this.context.api(session).removeFavorite(validated.itemIdWithoutDashes);
    return this.favourites();
  }

  async validateSetActRankBadgeHidden(hidden: boolean): Promise<{ HideActRankBadge: boolean }> {
    if (typeof hidden !== "boolean") {
      throw new ValidationError("invalid-argument", "Expected boolean for badge privacy");
    }
    return { HideActRankBadge: hidden };
  }

  async setActRankBadgeHidden(hidden: boolean): Promise<boolean> {
    const validated = await this.validateSetActRankBadgeHidden(hidden);
    const session = await this.context.sessions.session();
    await this.context.api(session).setActRankBadgeHidden(validated.HideActRankBadge);
    return hidden;
  }

  async validateSetLeaderboardAnonymized(
    anonymized: boolean,
  ): Promise<{ seasonId: string; Anonymize: boolean }> {
    if (typeof anonymized !== "boolean") {
      throw new ValidationError("invalid-argument", "Expected boolean for leaderboard anonymize");
    }
    const session = await this.context.sessions.session();
    const catalogue = await this.context.catalogue();
    let seasonId = catalogue.currentAct()?.uuid;
    if (!seasonId) {
      const content = await this.context.api(session).content();
      const activeAct = content.Seasons.find((s) => s.Type.toLowerCase() === "act" && s.IsActive);
      seasonId = activeAct?.ID ?? "";
    }
    return { seasonId, Anonymize: anonymized };
  }

  async setLeaderboardAnonymized(anonymized: boolean): Promise<boolean> {
    const validated = await this.validateSetLeaderboardAnonymized(anonymized);
    const session = await this.context.sessions.session();
    await this.context
      .api(session)
      .setLeaderboardAnonymized(validated.seasonId, validated.Anonymize);
    return anonymized;
  }

  async session(): Promise<GameSession> {
    const session = await this.context.sessions.session();
    const raw = await this.context.api(session).gameSession();
    return GameSessionBuilder.build(raw);
  }

  async config(): Promise<Record<string, unknown>> {
    const session = await this.context.sessions.session();
    const raw = await this.context.api(session).clientConfig();
    return (raw.Collapsed ?? raw) as Record<string, unknown>;
  }

  async settings(): Promise<PlayerSettings> {
    const localApi = this.context.sessions.localApi();
    const gameAuth = await localApi.gameAuthorization();
    if (!gameAuth) {
      throw new ValidationError(
        "game-not-running",
        "Valorant must be running to access player settings",
      );
    }
    const res = await localApi.get<{ type?: string; data?: Record<string, unknown> }>(
      "/player-preferences/v1/data-json/Ares.PlayerSettings",
      { Authorization: gameAuth },
    );
    return PlayerSettingsBuilder.build(res?.data ?? {});
  }

  async validateSaveSettings(
    data: unknown,
    options?: { confirm?: boolean },
  ): Promise<{ type: string; data: Record<string, unknown> }> {
    if (options?.confirm !== true) {
      throw new ValidationError("confirm-required", "Settings save requires confirmation");
    }
    const localApi = this.context.sessions.localApi();
    const gameAuth = await localApi.gameAuthorization();
    if (!gameAuth) {
      throw new ValidationError(
        "game-not-running",
        "Valorant must be running to save player settings",
      );
    }
    const payload =
      typeof data === "object" &&
      data !== null &&
      "raw" in data &&
      typeof (data as { raw: unknown }).raw === "object"
        ? ((data as { raw: Record<string, unknown> }).raw ?? {})
        : (data as Record<string, unknown>);
    return { type: "Ares.PlayerSettings", data: payload };
  }

  async saveSettings(data: unknown, options?: { confirm?: boolean }): Promise<PlayerSettings> {
    const validated = await this.validateSaveSettings(data, options);
    const localApi = this.context.sessions.localApi();
    const gameAuth = await localApi.gameAuthorization();
    await localApi.put("/player-preferences/v1/data-json/Ares.PlayerSettings", validated, {
      Authorization: gameAuth!,
    });
    return this.settings();
  }

  async client(): Promise<ClientInfo> {
    const localApi = this.context.sessions.localApi();
    const [regionLocale, activeAlias, externalSessions] = await Promise.all([
      localApi
        .get<{ locale?: string; region?: string }>("/riotclient/region-locale")
        .catch(() => null),
      localApi
        .get<{
          active?: boolean;
          game_name?: string;
          tag_line?: string;
        }>("/player-account/aliases/v1/active")
        .catch(() => null),
      localApi
        .get<
          Record<
            string,
            {
              productId?: string;
              version?: string;
              patchlineId?: string;
              launchConfiguration?: { arguments?: string[]; patchline?: string };
            }
          >
        >("/product-session/v1/external-sessions")
        .catch(() => null),
    ]);

    const valorant = Object.values(externalSessions ?? {}).find(
      (entry) => entry.productId?.toLowerCase() === "valorant",
    );

    const valorantRunning = Boolean(valorant);
    const valorantVersion =
      valorant?.version ??
      valorant?.launchConfiguration?.arguments
        ?.find((a) => a.startsWith("-client-version="))
        ?.split("=")[1] ??
      null;
    const patchline =
      valorant?.patchlineId ??
      valorant?.launchConfiguration?.patchline ??
      valorant?.launchConfiguration?.arguments
        ?.find((a) => a.startsWith("-patchline="))
        ?.split("=")[1] ??
      null;

    return {
      locale: regionLocale?.locale ?? "en_US",
      region: regionLocale?.region ?? "",
      riotId: {
        gameName: activeAlias?.game_name ?? "",
        tagLine: activeAlias?.tag_line ?? "",
      },
      valorantRunning,
      valorantVersion,
      patchline,
    };
  }
}
