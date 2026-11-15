import fs from "node:fs";
import path from "node:path";

export function defaultLogPath(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData
    ? path.join(localAppData, "VALORANT", "Saved", "Logs", "ShooterGame.log")
    : null;
}

// The loading screen runs from `Broadcasting state changed to TransitionToInGame` to the next
// state change, normally InGame. The log grows past 15 MB while playing, so it is followed,
// never read whole.
const STATE_CHANGE = /Broadcasting state changed to (\w+)/;
const LOADING_STATE = "TransitionToInGame";

export type GameFlow = {
  loading: boolean;
  partial: string;
};

export const NO_GAME_FLOW: GameFlow = { loading: false, partial: "" };

// Only complete lines count: a cut at `...changed to TransitionTo` would end the loading screen
// early.
export function advanceGameFlow(flow: GameFlow, text: string): GameFlow {
  const lines = (flow.partial + text).split("\n");
  const partial = lines.pop() ?? "";
  let loading = flow.loading;
  for (const line of lines) {
    const state = STATE_CHANGE.exec(line)?.[1];
    if (state) loading = state === LOADING_STATE;
  }
  return { loading, partial };
}

const POLL_MS = 1000;

// A log that stopped mid-load must not leave a loading screen on for good.
const LOADING_TIMEOUT_MS = 3 * 60_000;

const MAX_READ_BYTES = 1 << 20;

export class GameFlowWatcher {
  private flow = NO_GAME_FLOW;
  private offset: number | null = null;
  private loadingSince = 0;
  private announced = false;
  private reading = false;
  private stopped = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly logPath: () => string | null,
    private readonly onChange: () => void,
    private readonly now: () => number = Date.now,
  ) {}

  isLoading(): boolean {
    return this.flow.loading && this.now() - this.loadingSince < LOADING_TIMEOUT_MS;
  }

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.timer = setInterval(() => void this.poll(), POLL_MS);
    this.timer.unref?.();
    void this.poll();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async poll(): Promise<void> {
    if (this.reading) return;
    this.reading = true;
    try {
      await this.readNewText();
    } catch {
      // No log yet, or it is locked for a moment: the next look tries again.
    } finally {
      this.reading = false;
    }
    this.announce();
  }

  private async readNewText(): Promise<void> {
    const file = this.logPath();
    if (!file) return;

    const { size } = await fs.promises.stat(file);
    if (this.offset === null) {
      // Old lines must never turn the loading screen on.
      this.offset = size;
      return;
    }
    if (size < this.offset) {
      // A shorter log is a new session, read from its first line.
      this.offset = 0;
      this.flow = NO_GAME_FLOW;
    }
    if (size === this.offset) return;

    const length = Math.min(size - this.offset, MAX_READ_BYTES);
    const handle = await fs.promises.open(file, "r");
    try {
      const { bytesRead, buffer } = await handle.read(Buffer.alloc(length), 0, length, this.offset);
      this.offset += bytesRead;
      // One byte per character, so a read cut inside a multi-byte character cannot garble a line.
      const next = advanceGameFlow(this.flow, buffer.toString("latin1", 0, bytesRead));
      if (next.loading && !this.flow.loading) this.loadingSince = this.now();
      this.flow = next;
    } finally {
      await handle.close();
    }
  }

  private announce(): void {
    const loading = this.isLoading();
    if (this.stopped || loading === this.announced) return;
    this.announced = loading;
    try {
      this.onChange();
    } catch {
      // The owner's handler failing must not stop the watcher.
    }
  }
}

// `[2026.10.29-06.32.11:582]`, which the game writes in UTC.
const LOG_LINE =
  /^\[(\d{4})\.(\d\d)\.(\d\d)-(\d\d)\.(\d\d)\.(\d\d):(\d{3})\].*Gameplay started at local time [\d.]+ \(server time ([\d.]+)\)/gm;

const BUY_PHASE_MS = 30_292;
const BARRIERS_SECONDS = { min: 30, max: 60 };
const LATE_MS = 15_000;

export function parseRoundStarts(log: string, from: number, to: number): number[] {
  const rounds: { buy: number; barriers: number | null }[] = [];
  for (const m of log.matchAll(LOG_LINE)) {
    const [, y, mo, d, h, mi, s, ms, server] = m;
    const at = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +ms);
    if (at < from || at > to) continue;
    const seconds = Number(server);
    const buy = Math.round(at - seconds * 1000);
    const last = rounds[rounds.length - 1];
    if (seconds >= BARRIERS_SECONDS.min && seconds <= BARRIERS_SECONDS.max) {
      // A buy line written 6 s late once split one round into two, cutting every round before it
      // a round late.
      if (last && at > last.buy && at - last.buy <= seconds * 1000 + LATE_MS) last.barriers = at;
      else rounds.push({ buy, barriers: at });
    } else if (!last || Math.abs(buy - last.buy) > 5_000) {
      rounds.push({ buy, barriers: null });
    }
  }
  return rounds.map((round) => round.barriers ?? round.buy + BUY_PHASE_MS);
}
