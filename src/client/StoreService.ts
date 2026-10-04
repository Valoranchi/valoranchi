import { CollectionBuilder } from "../collection/CollectionBuilder.js";
import { StoreBuilder } from "../collection/StoreBuilder.js";
import { StoreOffersBuilder } from "../collection/StoreOffersBuilder.js";
import type {
  CatalogSkin,
  Offer,
  Order,
  OwnedItems,
  Store,
  StoreHistory,
  StoreSeen,
  Tier,
  Wallet,
  Wishlist,
  WishlistCheck,
} from "../model/index.js";
import {
  loadStoreHistory,
  querySkinSeen,
  recordStoreRotation,
  saveStoreHistory,
} from "../analysis/storeHistory.js";
import { loadWishlist, saveWishlist, wishlistHits } from "../analysis/wishlist.js";
import { ValidationError } from "../errors.js";
import { defaultResponseCacheDir } from "../riot/ResponseCache.js";
import { CURRENCY_UUIDS } from "../riot/types.js";
import type { StoreApi } from "./api.js";
import type { ClientContext } from "./ClientContext.js";
import { StoreValidator, type BuyTarget, type BuyValidationResult } from "./StoreValidator.js";

export class StoreService implements StoreApi {
  constructor(private readonly context: ClientContext) {}

  async current(options?: { language?: string }): Promise<Store> {
    const lang = options?.language ?? this.context.language;
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const [player, rawStorefront, catalogue] = await Promise.all([
      this.context.player(session),
      api.storefront(),
      this.context.catalogue(lang),
    ]);

    const store = new StoreBuilder(player, rawStorefront, catalogue, Date.now()).build();
    try {
      const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
      const history = loadStoreHistory(cacheDir, player.puuid);
      const updated = recordStoreRotation(history, store);
      saveStoreHistory(cacheDir, player.puuid, updated);
    } catch {}
    return store;
  }

  async offers(): Promise<Offer[]> {
    const session = await this.context.sessions.session();
    const [raw, catalogue] = await Promise.all([
      this.context.api(session).offers(),
      this.context.catalogue(),
    ]);
    return new StoreOffersBuilder(catalogue).buildOffers(raw);
  }

  async validateRevealNightMarket(): Promise<{ url: string }> {
    const current = await this.current();
    StoreValidator.validateNightMarket(current);
    const session = await this.context.sessions.session();
    return {
      url: `${session.endpoints.pd}/store/v2/storefront/${session.puuid}/nightmarket/offers`,
    };
  }

  async revealNightMarket(): Promise<Store> {
    await this.validateRevealNightMarket();
    const session = await this.context.sessions.session();
    await this.context.api(session).revealNightMarket();
    return this.current();
  }

  async validateBuy(
    target: BuyTarget,
    options?: { confirm?: boolean },
  ): Promise<BuyValidationResult> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [store, owned, rawWallet] = await Promise.all([
      this.current(),
      this.fetchOwnedItems(),
      api.wallet(),
    ]);

    const wallet: Wallet = {
      valorantPoints: rawWallet.Balances?.[CURRENCY_UUIDS.valorantPoints] ?? 0,
      radianite: rawWallet.Balances?.[CURRENCY_UUIDS.radianite] ?? 0,
      kingdomCredits: rawWallet.Balances?.[CURRENCY_UUIDS.kingdomCredits] ?? 0,
    };

    return StoreValidator.validateBuy(store, owned, wallet, target, options?.confirm);
  }

  async buy(target: BuyTarget, options?: { confirm?: boolean }): Promise<Order> {
    const validated = await this.validateBuy(target, options);
    const session = await this.context.sessions.session();
    const api = this.context.api(session);

    const rawOrder =
      validated.type === "offer"
        ? await api.createOrder(validated.payload)
        : await api.createBundleOrder(validated.bundleId, validated.payload);

    const catalogue = await this.context.catalogue();
    return new StoreOffersBuilder(catalogue).buildOrder(rawOrder);
  }

  async history(options?: { days?: number }): Promise<StoreHistory> {
    const session = await this.context.sessions.session();
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    const history = loadStoreHistory(cacheDir, session.puuid);
    if (options?.days !== undefined && options.days > 0) {
      return { days: history.days.slice(-options.days) };
    }
    return history;
  }

  async seen(skin: string): Promise<StoreSeen> {
    const [session, catalogue] = await Promise.all([
      this.context.sessions.session(),
      this.context.catalogue(),
    ]);
    const skinEntity = catalogue.findSkin(skin);
    const skinUuid = skinEntity?.uuid ?? skin;
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    const history = loadStoreHistory(cacheDir, session.puuid);
    return querySkinSeen(history, skinUuid);
  }

  async order(id: string): Promise<Order> {
    const session = await this.context.sessions.session();
    const [rawOrder, catalogue] = await Promise.all([
      this.context.api(session).order(id),
      this.context.catalogue(),
    ]);
    return new StoreOffersBuilder(catalogue).buildOrder(rawOrder);
  }

  async wishlist(): Promise<Wishlist> {
    const session = await this.context.sessions.session();
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    return loadWishlist(cacheDir, session.puuid);
  }

  async wishlistAdd(skin: string): Promise<Wishlist> {
    const catalogue = await this.context.catalogue();
    const skinEntity = catalogue.findSkin(skin);
    if (!skinEntity) {
      throw new ValidationError("unknown-skin", `Unknown skin: ${skin}`);
    }
    if (!skinEntity.contentTierUuid) {
      throw new ValidationError(
        "skin-not-purchasable",
        "Default skins cannot be added to wishlist",
      );
    }

    const owned = await this.fetchOwnedItems();
    const isOwned = owned.weapons
      .flatMap((w) => w.skins)
      .some((s) => s.uuid.toLowerCase() === skinEntity.uuid.toLowerCase());
    if (isOwned) {
      throw new ValidationError("skin-owned", "Skin is already owned");
    }

    const session = await this.context.sessions.session();
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    const currentWishlist = loadWishlist(cacheDir, session.puuid);

    const isListed = currentWishlist.skins.some(
      (s) => s.uuid.toLowerCase() === skinEntity.uuid.toLowerCase(),
    );
    if (isListed) {
      return currentWishlist;
    }

    currentWishlist.skins.push({
      uuid: skinEntity.uuid,
      name: skinEntity.displayName,
      addedAt: new Date().toISOString(),
    });
    saveWishlist(cacheDir, session.puuid, currentWishlist);
    return currentWishlist;
  }

  async wishlistRemove(skin: string): Promise<Wishlist> {
    const catalogue = await this.context.catalogue();
    const skinEntity = catalogue.findSkin(skin);
    const targetUuid = (skinEntity?.uuid ?? skin).trim().toLowerCase();
    const targetName = (skinEntity?.displayName ?? skin).trim().toLowerCase();

    const session = await this.context.sessions.session();
    const cacheDir = this.context.cacheDir ?? defaultResponseCacheDir();
    const currentWishlist = loadWishlist(cacheDir, session.puuid);

    currentWishlist.skins = currentWishlist.skins.filter(
      (s) => s.uuid.toLowerCase() !== targetUuid && s.name.toLowerCase() !== targetName,
    );
    saveWishlist(cacheDir, session.puuid, currentWishlist);
    return currentWishlist;
  }

  async wishlistCheck(): Promise<WishlistCheck> {
    const [store, currentWishlist] = await Promise.all([this.current(), this.wishlist()]);
    const hits = wishlistHits(store, currentWishlist);
    return {
      checkedAt: new Date().toISOString(),
      hits,
    };
  }

  async skins(): Promise<CatalogSkin[]> {
    const catalogue = await this.context.catalogue();
    const result: CatalogSkin[] = [];
    for (const weapon of catalogue.weapons) {
      for (const skin of weapon.skins) {
        if (!skin.contentTierUuid) {
          continue;
        }
        const tierEntity = catalogue.getTier(skin.contentTierUuid);
        const tier: Tier | null = tierEntity
          ? {
              uuid: tierEntity.uuid.toLowerCase(),
              name: tierEntity.displayName,
              rank: tierEntity.rank,
              icon: tierEntity.displayIcon,
            }
          : null;
        result.push({
          uuid: skin.uuid.toLowerCase(),
          name: skin.displayName,
          weapon: weapon.displayName,
          icon: skin.displayIcon ?? skin.levels[0]?.displayIcon ?? null,
          tier,
        });
      }
    }
    return result;
  }

  private async fetchOwnedItems(): Promise<OwnedItems> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [player, entitlements, catalogue] = await Promise.all([
      this.context.player(session),
      api.entitlements(),
      this.context.catalogue(),
    ]);
    return new CollectionBuilder(player, entitlements, catalogue, this.context.language).build();
  }
}
