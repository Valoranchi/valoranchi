export { SessionManager, type SessionManagerOptions } from "./client/SessionManager.js";
export { Session, type SessionInit } from "./riot/Session.js";
export { HttpGateway, type HttpFetchFn } from "./riot/HttpGateway.js";
export { RiotApi } from "./riot/RiotApi.js";
export {
  RiotClientLocalApi,
  type LocalApiResponse,
  type LocalEntitlementsToken,
  type LocalSessionInfo,
  type LocalApiFetchFn,
} from "./local/RiotClientLocalApi.js";
export { ChatApi } from "./local/ChatApi.js";
export { PlayerAccountApi, type RawAliasLookupEntry } from "./local/PlayerAccountApi.js";
export { ProductLauncherApi } from "./local/ProductLauncherApi.js";
export {
  RiotSocket,
  parseFrame,
  type RiotCredentialsResolver,
  type RiotEventType,
  type RiotFrame,
  type RiotSocketCredentials,
  type RiotSocketOptions,
  type WebSocketConstructor,
  type WebSocketLike,
} from "./local/RiotSocket.js";
export { ValorantApi, MemoryCatalogueCache } from "./catalogue/ValorantApi.js";
export { Catalogue } from "./catalogue/Catalogue.js";
export {
  FileCatalogueStore,
  defaultCatalogueDir,
  type StoredCatalogue,
} from "./catalogue/CatalogueStore.js";
export { FileResponseCache, defaultResponseCacheDir } from "./riot/ResponseCache.js";
export { decodeValorantPresence } from "./local/Presence.js";

export {
  LoadoutValidator,
  type LoadoutChange,
  type LoadoutGunChange,
} from "./client/LoadoutValidator.js";
export { ChatValidator } from "./client/ChatValidator.js";
export {
  PartyValidator,
  type PartyAction,
  type PartyActionRequest,
} from "./client/PartyValidator.js";
export { AccountValidator } from "./client/AccountValidator.js";
export { MatchValidator } from "./client/MatchValidator.js";
export {
  StoreValidator,
  type BuyTarget,
  type BuyValidationResult,
} from "./client/StoreValidator.js";

export {
  LoadoutWriter,
  type RiotLoadoutGunPut,
  type RiotLoadoutPutBody,
} from "./collection/LoadoutWriter.js";
export { RateLimiter, type RateLimiterOptions } from "./official/RateLimiter.js";
export { OfficialApi, type OfficialApiOptions } from "./official/OfficialApi.js";
export {
  OfficialMatchAdapter,
  toMatchDetails,
  toLeaderboard,
} from "./official/OfficialMatchAdapter.js";

export * from "./official/types.js";
export * from "./riot/types.js";
export * from "./local/chatTypes.js";
export * from "./catalogue/types.js";
export * from "./errors.js";

export type {
  BlockedPlayer,
  Conversation,
  Cost,
  CustomGameSettings,
  Friend,
  FriendRequest,
  OwnedItems,
  Store,
  StoreItem,
  ValorantPresence,
  Wallet,
} from "./model/index.js";
