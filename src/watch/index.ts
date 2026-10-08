import type { MatchesApi, StoreApi } from "../client/api.js";
import type { RiotEvents } from "../events/RiotEvents.js";
import { FriendsWatcher, type FriendsWatcherOptions } from "./FriendsWatcher.js";
import { MatchWatcher, type MatchWatcherOptions } from "./MatchWatcher.js";
import { StoreWatcher, type StoreWatcherOptions } from "./StoreWatcher.js";

export {
  FriendsWatcher,
  formatPresenceActivity,
  type FriendsWatcherOptions,
} from "./FriendsWatcher.js";
export { MatchWatcher, type MatchWatcherOptions } from "./MatchWatcher.js";
export { StoreWatcher, type StoreWatcherOptions } from "./StoreWatcher.js";
export { WebhookNotifier } from "./WebhookNotifier.js";
export {
  buildMatchRecap,
  buildMatchRecapDiscord,
  type DiscordEmbed,
  type DiscordEmbedField,
  type DiscordRecapPayload,
  type MatchRecapOptions,
} from "./MatchRecap.js";
export { AsyncQueue } from "./AsyncQueue.js";
export type {
  FriendsWatchEventMap,
  FriendsWatchItem,
  MatchWatchEventMap,
  MatchWatchItem,
  StoreWatchEventMap,
  StoreWatchItem,
} from "./types.js";

export interface WatchApi {
  match(options?: MatchWatcherOptions): MatchWatcher;
  friends(options?: FriendsWatcherOptions): FriendsWatcher;
  store(options?: StoreWatcherOptions): StoreWatcher;
}

export class WatchService implements WatchApi {
  constructor(
    private readonly eventsProvider: () => RiotEvents,
    private readonly matches: MatchesApi,
    private readonly storeApi?: StoreApi,
  ) {}

  match(options?: MatchWatcherOptions): MatchWatcher {
    return new MatchWatcher(this.eventsProvider(), this.matches, options);
  }

  friends(options?: FriendsWatcherOptions): FriendsWatcher {
    return new FriendsWatcher(this.eventsProvider(), options);
  }

  store(options?: StoreWatcherOptions): StoreWatcher {
    if (!this.storeApi) {
      throw new Error("StoreApi is not available on WatchService");
    }
    return new StoreWatcher(this.storeApi, options);
  }
}
