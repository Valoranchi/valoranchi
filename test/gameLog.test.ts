import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GameFlowWatcher,
  NO_GAME_FLOW,
  advanceGameFlow,
  defaultLogPath,
  parseRoundStarts,
} from "../src/local/GameLog.js";

// A line the way the game writes it, CRLF included.
const line = (state: string, time = "20.48.59:044") =>
  `[2026.10.24-${time}][ 85]LogGameFlowStateManager: [PlatformTime: 105940.198171] Broadcasting state changed to ${state}\r\n`;

describe("defaultLogPath", () => {
  const saved = process.env.LOCALAPPDATA;

  afterEach(() => {
    if (saved === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = saved;
  });

  it("points at the game's log under LOCALAPPDATA", () => {
    process.env.LOCALAPPDATA = path.join("C:", "Users", "me", "AppData", "Local");

    expect(defaultLogPath()).toBe(
      path.join(
        "C:",
        "Users",
        "me",
        "AppData",
        "Local",
        "VALORANT",
        "Saved",
        "Logs",
        "ShooterGame.log",
      ),
    );
  });

  it("is null without LOCALAPPDATA", () => {
    delete process.env.LOCALAPPDATA;

    expect(defaultLogPath()).toBeNull();
  });
});

describe("advanceGameFlow", () => {
  it("opens the loading screen with TransitionToInGame", () => {
    expect(advanceGameFlow(NO_GAME_FLOW, line("TransitionToInGame"))).toEqual({
      loading: true,
      partial: "",
    });
  });

  it("ends it with the next state, normally InGame", () => {
    const loading = advanceGameFlow(NO_GAME_FLOW, line("TransitionToInGame"));

    expect(advanceGameFlow(loading, line("InGame", "20.49.18:003"))).toEqual({
      loading: false,
      partial: "",
    });
  });

  it.each([
    "MainMenu",
    "TransitionToMainMenu",
    "TransitionToPregame",
    "Pregame",
    "SomethingRiotAddsTomorrow",
  ])("ends it with any other state, such as %s", (state) => {
    const loading = advanceGameFlow(NO_GAME_FLOW, line("TransitionToInGame"));

    expect(advanceGameFlow(loading, line(state)).loading).toBe(false);
  });

  it("is not loading for the states around it", () => {
    const text = line("MainMenu") + line("TransitionToPregame") + line("Pregame");

    expect(advanceGameFlow(NO_GAME_FLOW, text).loading).toBe(false);
  });

  it("keeps only the last state of a block with several of them", () => {
    const through = line("Pregame") + line("TransitionToInGame") + line("InGame");
    const into = line("InGame") + line("MainMenu") + line("TransitionToInGame");

    expect(advanceGameFlow(NO_GAME_FLOW, through).loading).toBe(false);
    expect(advanceGameFlow(NO_GAME_FLOW, into).loading).toBe(true);
  });

  it("leaves what it knows alone when nothing in the text is a state change", () => {
    const noise = "LogNet: something else entirely\r\nLogTemp: more noise\r\n";
    const loading = advanceGameFlow(NO_GAME_FLOW, line("TransitionToInGame"));

    expect(advanceGameFlow(loading, noise).loading).toBe(true);
    expect(advanceGameFlow(NO_GAME_FLOW, noise).loading).toBe(false);
  });

  it("holds an unfinished line back until the rest of it arrives", () => {
    const whole = line("TransitionToInGame");
    const cut = whole.indexOf("InGame") - 2;

    const first = advanceGameFlow(NO_GAME_FLOW, whole.slice(0, cut));
    expect(first).toEqual({ loading: false, partial: whole.slice(0, cut) });

    expect(advanceGameFlow(first, whole.slice(cut))).toEqual({
      loading: true,
      partial: "",
    });
  });

  it("does not take half a state name for another state", () => {
    const loading = advanceGameFlow(NO_GAME_FLOW, line("TransitionToInGame"));
    const end = line("InGame");
    const cut = end.length - 4;

    const first = advanceGameFlow(loading, end.slice(0, cut));
    expect(first.loading).toBe(true);
    expect(advanceGameFlow(first, end.slice(cut)).loading).toBe(false);
  });

  it("reads lines ended by a bare line feed too", () => {
    const text = line("TransitionToInGame").replace("\r\n", "\n");

    expect(advanceGameFlow(NO_GAME_FLOW, text).loading).toBe(true);
  });
});

describe("GameFlowWatcher", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "game-flow-"));
    file = path.join(dir, "ShooterGame.log");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function watch(now: () => number = () => 0) {
    const changes: boolean[] = [];
    const watcher = new GameFlowWatcher(
      () => file,
      () => changes.push(watcher.isLoading()),
      now,
    );
    return { watcher, changes };
  }

  it("never lights up for what the log held before it started", async () => {
    fs.writeFileSync(file, line("TransitionToInGame"));
    const { watcher, changes } = watch();

    await watcher.poll();
    await watcher.poll();

    expect(watcher.isLoading()).toBe(false);
    expect(changes).toEqual([]);
  });

  it("follows a loading screen from start to end and announces each change once", async () => {
    fs.writeFileSync(file, line("Pregame"));
    const { watcher, changes } = watch();
    await watcher.poll();

    fs.appendFileSync(file, line("TransitionToInGame"));
    await watcher.poll();
    await watcher.poll();
    expect(watcher.isLoading()).toBe(true);
    expect(changes).toEqual([true]);

    fs.appendFileSync(file, line("InGame", "20.49.18:003"));
    await watcher.poll();
    expect(watcher.isLoading()).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it("stays quiet for state changes that are not the loading screen", async () => {
    fs.writeFileSync(file, "");
    const { watcher, changes } = watch();
    await watcher.poll();

    fs.appendFileSync(file, line("MainMenu") + line("TransitionToPregame"));
    await watcher.poll();
    fs.appendFileSync(file, line("Pregame"));
    await watcher.poll();

    expect(changes).toEqual([]);
  });

  it("waits for a line the game has not finished writing", async () => {
    fs.writeFileSync(file, "");
    const { watcher, changes } = watch();
    await watcher.poll();
    const whole = line("TransitionToInGame");

    fs.appendFileSync(file, whole.slice(0, 90));
    await watcher.poll();
    expect(changes).toEqual([]);

    fs.appendFileSync(file, whole.slice(90));
    await watcher.poll();
    expect(changes).toEqual([true]);
  });

  it("reads a reopened log from its first line", async () => {
    fs.writeFileSync(file, `${"old session\r\n".repeat(50)}`);
    const { watcher, changes } = watch();
    await watcher.poll();

    // Much shorter than the log it replaces, as a fresh one always is.
    fs.writeFileSync(file, line("TransitionToInGame"));
    await watcher.poll();

    expect(changes).toEqual([true]);
  });

  it("forgets a loading screen of the session the game just closed", async () => {
    fs.writeFileSync(file, "");
    const { watcher, changes } = watch();
    await watcher.poll();
    fs.appendFileSync(file, `${"x".repeat(300)}\r\n${line("TransitionToInGame")}`);
    await watcher.poll();
    expect(changes).toEqual([true]);

    fs.writeFileSync(file, line("MainMenu").slice(0, 20));
    await watcher.poll();

    expect(watcher.isLoading()).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it("gives up on a loading screen the log never closes", async () => {
    let clock = 0;
    fs.writeFileSync(file, "");
    const { watcher, changes } = watch(() => clock);
    await watcher.poll();
    fs.appendFileSync(file, line("TransitionToInGame"));
    await watcher.poll();
    expect(changes).toEqual([true]);

    clock = 3 * 60_000 - 1;
    await watcher.poll();
    expect(watcher.isLoading()).toBe(true);

    clock = 3 * 60_000;
    await watcher.poll();
    expect(watcher.isLoading()).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it("waits for the log to exist, then follows it from where it first sees it", async () => {
    const { watcher, changes } = watch();

    await watcher.poll();
    expect(changes).toEqual([]);

    fs.writeFileSync(file, line("TransitionToInGame"));
    await watcher.poll();
    expect(changes).toEqual([]);

    fs.appendFileSync(file, line("InGame"));
    await watcher.poll();
    fs.appendFileSync(file, line("TransitionToInGame"));
    await watcher.poll();
    expect(changes).toEqual([true]);
  });
});

describe("parseRoundStarts", () => {
  const log = [
    "[2026.10.29-06.31.23:817][730]LogShooterGameState: Warning: Gameplay started at local time 40.531250 (server time 45.292187)",
    "[2026.10.29-06.32.11:234][722]LogShooterGameState: Warning: AShooterGameState::OnRoundEnded for round '0'",
    "[2026.10.29-06.32.11:582][747]LogShooterGameState: Warning: Gameplay started at local time 0.007812 (server time 0.000000)",
    "[2026.10.29-06.32.41:449][772]LogShooterGameState: Warning: Gameplay started at local time 30.062500 (server time 30.292187)",
  ].join("\n");

  it("takes when each round's barriers dropped, once, on this machine's clock", () => {
    const starts = parseRoundStarts(log, 0, Infinity);

    expect(starts).toEqual([
      Date.UTC(2026, 9, 29, 6, 31, 23, 817),
      Date.UTC(2026, 9, 29, 6, 32, 41, 449),
    ]);
  });

  it("works the barriers out from the buy phase when their line is missing", () => {
    const buyOnly =
      "[2026.10.29-06.32.11:582][747]LogShooterGameState: Warning: Gameplay started at local time 0.007812 (server time 0.000000)";

    expect(parseRoundStarts(buyOnly, 0, Infinity)).toEqual([
      Date.UTC(2026, 9, 29, 6, 32, 11, 582) + 30_292,
    ]);
  });

  it("does not take a reconnection in the middle of a round for the barriers", () => {
    const reconnected =
      "[2026.10.29-06.33.50:000][747]LogShooterGameState: Warning: Gameplay started at local time 2.000000 (server time 80.000000)";

    expect(parseRoundStarts(reconnected, 0, Infinity)).toEqual([
      Date.UTC(2026, 9, 29, 6, 33, 50, 0) - 80_000 + 30_292,
    ]);
  });

  it("keeps a round whose buy line was written late as one round", () => {
    // From a real overtime round: the buy line came 6 s late and the barriers
    // dropped 36 s in, so the two lines disagree on when the round started.
    const late = [
      "[2026.11.10-07.57.13:000][1]LogShooterGameState: Warning: Gameplay started at local time 0.031250 (server time 0.000000)",
      "[2026.11.10-07.57.42:000][2]LogShooterGameState: Warning: Gameplay started at local time 30.039062 (server time 30.292187)",
      "[2026.11.10-07.59.09:000][3]LogShooterGameState: Warning: Gameplay started at local time 5.945312 (server time 0.000000)",
      "[2026.11.10-07.59.40:000][4]LogShooterGameState: Warning: Gameplay started at local time 34.125000 (server time 36.448437)",
      "[2026.11.10-08.00.48:000][5]LogShooterGameState: Warning: Gameplay started at local time 0.031250 (server time 0.000000)",
      "[2026.11.10-08.01.18:000][6]LogShooterGameState: Warning: Gameplay started at local time 28.132812 (server time 30.292187)",
    ].join("\n");

    expect(parseRoundStarts(late, 0, Infinity)).toEqual([
      Date.UTC(2026, 10, 10, 7, 57, 42),
      Date.UTC(2026, 10, 10, 7, 59, 40),
      Date.UTC(2026, 10, 10, 8, 1, 18),
    ]);
  });

  it("leaves out lines from outside the match", () => {
    const after = Date.UTC(2026, 9, 29, 6, 32, 0);

    expect(parseRoundStarts(log, after, Infinity)).toHaveLength(1);
  });
});
