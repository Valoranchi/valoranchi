import { ValidationError } from "../errors.js";
import { TypedEmitter } from "../events/TypedEmitter.js";
import type { MatchesApi } from "../client/api.js";
import type { LiveMatch } from "../model/index.js";
import { AsyncQueue } from "./AsyncQueue.js";
import type { MatchWatcher } from "./MatchWatcher.js";

export interface InstalockOptions {
  agent: string;
  byMap?: Record<string, string>;
  fallbacks?: string[];
  delayMs?: number;
  select?: boolean;
  once?: boolean;
  dryRun?: boolean;
}

export interface InstalockResult {
  matchId: string;
  agent: string;
  map: string;
  mode: "locked" | "selected" | "dry-run";
}

export type InstalockEventMap = {
  locked: [data: InstalockResult];
  skipped: [data: { matchId: string; reason: string }];
  error: [error: Error];
};

export type InstalockItem =
  | { event: "locked"; at: string; data: InstalockResult }
  | { event: "skipped"; at: string; data: { matchId: string; reason: string } }
  | { event: "error"; at: string; data: { message: string; name?: string } };

export interface InstalockHandle {
  stop(): void;
  on<E extends keyof InstalockEventMap & string>(
    event: E,
    listener: (...args: InstalockEventMap[E]) => void,
  ): this;
  off<E extends keyof InstalockEventMap & string>(
    event: E,
    listener: (...args: InstalockEventMap[E]) => void,
  ): this;
  [Symbol.asyncIterator](): AsyncIterableIterator<InstalockItem>;
}

function pickAgentForMap(
  options: InstalockOptions,
  map: { uuid: string | null; name: string | null },
): string {
  const keys = [map.name, map.uuid].filter(Boolean).map((key) => key!.toLowerCase());
  const match = Object.entries(options.byMap ?? {}).find(([key]) =>
    keys.includes(key.toLowerCase()),
  );
  return match?.[1] ?? options.agent;
}

export class Instalock extends TypedEmitter<InstalockEventMap> implements InstalockHandle {
  private readonly queues = new Set<AsyncQueue<InstalockItem>>();
  private readonly handledMatches = new Set<string>();
  private stopped = false;
  private readonly onPregame: (live: LiveMatch) => void;
  private readonly onError: (err: Error) => void;

  constructor(
    private readonly watcher: MatchWatcher,
    private readonly matches: MatchesApi,
    private readonly options: InstalockOptions,
    private readonly ownsWatcher = false,
  ) {
    super();

    if (
      options.delayMs !== undefined &&
      (options.delayMs < 0 || options.delayMs > 10000 || Number.isNaN(options.delayMs))
    ) {
      throw new ValidationError("invalid-delay", "delayMs must be between 0 and 10000");
    }

    this.onPregame = (live: LiveMatch) => {
      void this.handlePregame(live);
    };
    this.onError = (err: Error) => {
      this.emitItem("error", err);
    };

    this.watcher.on("pregame", this.onPregame);
    this.watcher.on("error", this.onError);
    this.watcher.start();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    this.watcher.off("pregame", this.onPregame);
    this.watcher.off("error", this.onError);

    if (this.ownsWatcher) {
      this.watcher.stop();
    }

    for (const queue of this.queues) {
      queue.close();
    }
    this.queues.clear();
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<InstalockItem> {
    const queue = new AsyncQueue<InstalockItem>(() => {
      this.queues.delete(queue);
    });
    this.queues.add(queue);
    return queue;
  }

  private emitItem<E extends keyof InstalockEventMap & string>(
    event: E,
    ...args: InstalockEventMap[E]
  ): void {
    this.emit(event, ...args);
    const at = new Date().toISOString();
    const data = args[0];
    const item = (
      event === "error"
        ? {
            event: "error",
            at,
            data: { message: (data as Error).message, name: (data as Error).name },
          }
        : { event, at, data }
    ) as InstalockItem;

    for (const queue of this.queues) {
      queue.push(item);
    }
  }

  private async handlePregame(live: LiveMatch): Promise<void> {
    if (live.phase !== "pregame") return;
    if (this.handledMatches.has(live.matchId)) return;
    this.handledMatches.add(live.matchId);

    if (live.self?.selection === "locked") {
      this.emitItem("skipped", { matchId: live.matchId, reason: "already-locked" });
      if (this.options.once) this.stop();
      return;
    }

    const delay = this.options.delayMs ?? 0;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (this.stopped) return;
    }

    const picked = pickAgentForMap(this.options, live.map);
    const candidates = Array.from(
      new Set([picked, ...(this.options.fallbacks ?? [])].filter(Boolean)),
    );

    let acceptedAgent: string | null = null;
    for (const candidate of candidates) {
      try {
        await this.matches.validateLockAgent(candidate);
        acceptedAgent = candidate;
        break;
      } catch {
        continue;
      }
    }

    const mapName = live.map.name ?? live.map.uuid ?? live.map.path;

    if (!acceptedAgent) {
      this.emitItem("skipped", {
        matchId: live.matchId,
        reason: "none-valid",
      });
      if (this.options.once) this.stop();
      return;
    }

    if (this.options.dryRun) {
      this.emitItem("locked", {
        matchId: live.matchId,
        agent: acceptedAgent,
        map: mapName,
        mode: "dry-run",
      });
      if (this.options.once) this.stop();
      return;
    }

    try {
      await this.matches.selectAgent(acceptedAgent);
      if (!this.options.select) {
        await this.matches.lockAgent(acceptedAgent);
      }
      this.emitItem("locked", {
        matchId: live.matchId,
        agent: acceptedAgent,
        map: mapName,
        mode: this.options.select ? "selected" : "locked",
      });
    } catch (err) {
      this.emitItem("error", err instanceof Error ? err : new Error(String(err)));
    }

    if (this.options.once) {
      this.stop();
    }
  }
}
