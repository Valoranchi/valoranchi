import type { Catalogue } from "../catalogue/Catalogue.js";
import { ValidationError } from "../errors.js";
import type { OwnedItems } from "../model/index.js";
import type { RiotContractsResponse, RiotFavoritesResponse } from "../riot/types.js";

const MATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AccountValidator {
  static validateMatchId(matchId: string): string {
    if (!MATCH_ID_PATTERN.test(matchId)) {
      throw new ValidationError("invalid-match-id", "Expected a match id in uuid format", {
        matchId,
      });
    }
    return matchId.toLowerCase();
  }

  static validateActivateContract(
    rawContracts: RiotContractsResponse,
    ownedItems: OwnedItems,
    catalogue: Catalogue,
    contractInput: string,
  ): { contractId: string } {
    const def =
      catalogue.getContract(contractInput) ??
      catalogue.contracts.find((c) => c.displayName.toLowerCase() === contractInput.toLowerCase());
    if (!def) {
      throw new ValidationError("unknown-contract", `Unknown contract: ${contractInput}`);
    }

    if (def.content?.relationType !== "Agent") {
      throw new ValidationError("contract-not-agent", "Contract is not an agent contract");
    }

    const agentUuid = def.content.relationUuid.toLowerCase();
    const isAgentOwned = ownedItems.agents.some((a) => a.uuid.toLowerCase() === agentUuid);
    if (isAgentOwned) {
      throw new ValidationError("agent-owned", "Agent is already owned");
    }

    if (rawContracts.ActiveSpecialContract?.toLowerCase() === def.uuid.toLowerCase()) {
      throw new ValidationError("contract-active", "Contract is already active");
    }

    return { contractId: def.uuid };
  }

  static validateAddFavourite(
    rawFavorites: RiotFavoritesResponse,
    ownedItems: OwnedItems,
    catalogue: Catalogue,
    skinInput: string,
  ): { ItemID: string } {
    const skin =
      catalogue.getSkin(skinInput) ??
      catalogue.weapons
        .flatMap((w) => w.skins)
        .find((s) => s.displayName.toLowerCase() === skinInput.toLowerCase());
    if (!skin) {
      throw new ValidationError("unknown-item", `Unknown skin: ${skinInput}`);
    }

    const isOwned = ownedItems.weapons
      .flatMap((w) => w.skins)
      .some((s) => s.uuid.toLowerCase() === skin.uuid.toLowerCase());
    if (!isOwned) {
      throw new ValidationError("not-owned", "Skin is not owned");
    }

    const isFav = Object.values(rawFavorites.FavoritedContent ?? {}).some(
      (f) => f.ItemID.toLowerCase() === skin.uuid.toLowerCase(),
    );
    if (isFav) {
      throw new ValidationError("already-favourite", "Skin is already in favourites");
    }

    return { ItemID: skin.uuid };
  }

  static validateRemoveFavourite(
    rawFavorites: RiotFavoritesResponse,
    catalogue: Catalogue,
    skinInput: string,
  ): { itemIdWithoutDashes: string } {
    const skin =
      catalogue.getSkin(skinInput) ??
      catalogue.weapons
        .flatMap((w) => w.skins)
        .find((s) => s.displayName.toLowerCase() === skinInput.toLowerCase());
    const skinUuid = skin ? skin.uuid : skinInput;

    const isFav = Object.values(rawFavorites.FavoritedContent ?? {}).some(
      (f) => f.ItemID.toLowerCase() === skinUuid.toLowerCase(),
    );
    if (!isFav) {
      throw new ValidationError("not-favourite", "Skin is not in favourites");
    }

    return { itemIdWithoutDashes: skinUuid.replace(/-/g, "") };
  }
}
