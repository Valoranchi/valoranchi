import type { MatchesApi } from "../client/api.js";
import type { RiotEvents } from "../events/RiotEvents.js";
import { TypedEmitter } from "../events/TypedEmitter.js";
import type { Match } from "../model/index.js";
import { AsyncQueue } from "./AsyncQueue.js";
import { buildMatchRecapDiscord } from "./MatchRecap.js";
import type { MatchWatchEventMap, MatchWatchItem } from "./types.js";
import { WebhookNotifier } from "./WebhookNotifier.js";

export interface MatchWatcherOptions {
  pollIntervalMs?: number;
  retryIntervalMs?: number;
  retryMaxMs?: number;
  webhook?: string;
}

export class MatchWatcher extends TypedEmitter<MatchWatchEventMap> {
  private readonly pollIntervalMs: number;
  private readonly retryIntervalMs: number;
  private readonly retryMaxMs: number;
  private readonly notifier?: WebhookNotifier;
  private selfPuuid: string | null = null;

  private phase: "idle" | "pregame" | "ingame" = "idle";
  private currentMatchId: string | null = null;
  private hasEmittedPregame = false;
  private hasEmittedLocked = false;
  private hasEmittedStarted = false;
  private lastScore: { ally: number; enemy: number } | null = null;

  private pollTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private unsubListeners: Array<() => void> = [];
  private readonly queues = new Set<AsyncQueue<MatchWatchItem>>();
  private running = false;

  constructor(
    private readonly events: RiotEvents,
    private readonly matches: MatchesApi,
    options: MatchWatcherOptions = {},
  ) {
    super();
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.retryIntervalMs = options.retryIntervalMs ?? 5000;
    this.retryMaxMs = options.retryMaxMs ?? 120000;
    if (options.webhook) {
      this.notifier = new WebhookNotifier(options.webhook);
    }
  }

  start(): this {
    if (this.running) return this;
    this.running = true;
    this.events.start();

    const onState = (data: { state: "menus" | "pregame" | "ingame" | null; presence: unknown }) => {
      void this.handleSelfState(data);
    };

    const onGame = (data: { phase: "pregame" | "ingame"; matchId: string }) => {
      void this.handleGameRelay(data);
    };

    const onError = (err: Error) => {
      this.emitItem("error", err);
    };

    this.events.on("self:state", onState);
    this.events.on("game", onGame);
    this.events.on("error", onError);

    this.unsubListeners.push(
      () => this.events.off("self:state", onState),
      () => this.events.off("game", onGame),
      () => this.events.off("error", onError),
    );

    void this.initialCheck();
    return this;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.stopPolling();

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    for (const unsub of this.unsubListeners) {
      unsub();
    }
    this.unsubListeners = [];

    for (const queue of this.queues) {
      queue.close();
    }
    this.queues.clear();
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<MatchWatchItem> {
    this.start();
    const queue = new AsyncQueue<MatchWatchItem>(() => {
      this.queues.delete(queue);
    });
    this.queues.add(queue);
    return queue;
  }

  private emitItem<E extends keyof MatchWatchEventMap & string>(
    event: E,
    ...args: MatchWatchEventMap[E]
  ): void {
    this.emit(event, ...args);
    const at = new Date().toISOString();
    const data = args[0] !== undefined ? args[0] : null;
    const item = { event, at, data } as MatchWatchItem;
    for (const q of this.queues) {
      q.push(item);
    }
  }

  private async initialCheck(): Promise<void> {
    try {
      const live = await this.matches.live({ loadouts: true });
      if (!this.running) return;
      if (live.phase === "pregame") {
        await this.transitionToPregame(live.matchId);
      } else if (live.phase === "ingame") {
        await this.transitionToIngame(live.matchId);
      }
    } catch {}
  }

  private async handleSelfState(data: {
    state: "menus" | "pregame" | "ingame" | null;
    presence: unknown;
  }): Promise<void> {
    const presence = data.presence as
      { score?: { ally: number; enemy: number } | null } | null | undefined;

    if (data.state === "ingame" && presence?.score) {
      const score = presence.score;
      if (
        !this.lastScore ||
        this.lastScore.ally !== score.ally ||
        this.lastScore.enemy !== score.enemy
      ) {
        this.lastScore = { ally: score.ally, enemy: score.enemy };
        const round = score.ally + score.enemy;
        this.emitItem("round", { round, ally: score.ally, enemy: score.enemy });
      }
    }

    if (data.state === "pregame" && this.phase !== "pregame") {
      await this.transitionToPregame();
    } else if (data.state === "ingame" && this.phase !== "ingame") {
      await this.transitionToIngame();
    } else if (data.state === "menus" || data.state === null) {
      if (this.phase === "pregame") {
        this.handleLeft();
      } else if (this.phase === "ingame") {
        this.handleIngameEnded();
      }
    }
  }

  private async handleGameRelay(data: {
    phase: "pregame" | "ingame";
    matchId: string;
  }): Promise<void> {
    if (data.phase === "pregame" && this.phase !== "pregame") {
      await this.transitionToPregame(data.matchId);
    } else if (data.phase === "ingame" && this.phase !== "ingame") {
      await this.transitionToIngame(data.matchId);
    }
  }

  private async transitionToPregame(matchId?: string): Promise<void> {
    this.phase = "pregame";
    this.currentMatchId = matchId ?? null;
    this.hasEmittedPregame = false;
    this.hasEmittedLocked = false;
    this.hasEmittedStarted = false;
    this.lastScore = null;
    this.startPolling();

    try {
      const live = await this.matches.live();
      if (!this.running || this.phase !== "pregame") return;
      if (live.phase === "pregame") {
        if (live.self?.puuid) this.selfPuuid = live.self.puuid;
        this.currentMatchId = live.matchId;
        if (!this.hasEmittedPregame) {
          this.hasEmittedPregame = true;
          this.emitItem("pregame", live);
        }
        if (live.self?.selection === "locked" && !this.hasEmittedLocked) {
          this.hasEmittedLocked = true;
          this.emitItem("locked", live);
        }
      }
    } catch (err) {
      this.emitItem("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async transitionToIngame(matchId?: string): Promise<void> {
    this.phase = "ingame";
    this.currentMatchId = matchId ?? null;
    this.hasEmittedStarted = false;
    this.startPolling();

    try {
      const live = await this.matches.live({ loadouts: true });
      if (!this.running || this.phase !== "ingame") return;
      if (live.phase === "ingame") {
        if (live.self?.puuid) this.selfPuuid = live.self.puuid;
        this.currentMatchId = live.matchId;
        if (!this.hasEmittedStarted) {
          this.hasEmittedStarted = true;
          this.emitItem("started", live);
        }
      }
    } catch (err) {
      this.emitItem("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.pollLive();
    }, this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollLive(): Promise<void> {
    if (!this.running || (this.phase !== "pregame" && this.phase !== "ingame")) {
      this.stopPolling();
      return;
    }

    try {
      const live = await this.matches.live({ loadouts: this.phase === "ingame" });
      if (!this.running) return;

      if (live.phase === "pregame") {
        if (live.self?.puuid) this.selfPuuid = live.self.puuid;
        this.currentMatchId = live.matchId;
        if (!this.hasEmittedPregame) {
          this.hasEmittedPregame = true;
          this.emitItem("pregame", live);
        }
        if (live.self?.selection === "locked" && !this.hasEmittedLocked) {
          this.hasEmittedLocked = true;
          this.emitItem("locked", live);
        }
      } else if (live.phase === "ingame") {
        if (live.self?.puuid) this.selfPuuid = live.self.puuid;
        this.currentMatchId = live.matchId;
        if (this.phase !== "ingame") {
          this.phase = "ingame";
        }
        if (!this.hasEmittedStarted) {
          this.hasEmittedStarted = true;
          this.emitItem("started", live);
        }
      } else if (live.phase === "none") {
        if (this.phase === "pregame") {
          this.handleLeft();
        } else if (this.phase === "ingame") {
          this.handleIngameEnded();
        }
      }
    } catch {}
  }

  private handleLeft(): void {
    this.stopPolling();
    this.phase = "idle";
    this.emitItem("left");
  }

  private handleIngameEnded(): void {
    this.stopPolling();
    const matchId = this.currentMatchId;
    this.phase = "idle";
    if (matchId) {
      void this.retryFetchMatchEnded(matchId);
    }
  }

  private async retryFetchMatchEnded(matchId: string): Promise<void> {
    const startedAt = Date.now();

    const attempt = async () => {
      if (!this.running) return;
      try {
        const match = await this.matches.get(matchId);
        if (match && match.id) {
          this.emitItem("ended", match);
          if (this.notifier) {
            void this.postMatchRecap(match);
          }
          return;
        }
      } catch {}

      if (Date.now() - startedAt < this.retryMaxMs && this.running) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          void attempt();
        }, this.retryIntervalMs);
      }
    };

    await attempt();
  }

  private async postMatchRecap(match: Match): Promise<void> {
    if (!this.notifier) return;
    try {
      let rrChange: number | null = null;
      if (match.ranked) {
        try {
          const history = await this.matches.rankHistory({ count: 5 });
          const update = history.find((h) => h.matchId === match.id);
          if (update) {
            rrChange = update.earned;
          }
        } catch {}
      }
      await this.notifier.notify(match, (m) =>
        buildMatchRecapDiscord(m, {
          rrChange,
          selfPuuid: this.selfPuuid ?? undefined,
        }),
      );
    } catch (err) {
      this.emitItem("error", err instanceof Error ? err : new Error(String(err)));
    }
  }
}
