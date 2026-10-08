import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchesApi } from "../src/client/api.js";
import { TypedEmitter } from "../src/events/TypedEmitter.js";
import type { LiveMatch } from "../src/model/index.js";
import { ValidationError } from "../src/errors.js";
import { Instalock, type InstalockOptions } from "../src/watch/Instalock.js";
import type { MatchWatcher } from "../src/watch/MatchWatcher.js";
import type { MatchWatchEventMap } from "../src/watch/types.js";

function makeFakeWatcher(): MatchWatcher {
  const emitter = new TypedEmitter<MatchWatchEventMap>();
  const watcher = emitter as unknown as MatchWatcher;
  watcher.start = vi.fn().mockReturnValue(watcher);
  watcher.stop = vi.fn();
  return watcher;
}

function makePregameMatch(
  matchId: string = "m-1",
  mapName: string = "Haven",
  selfLocked: boolean = false,
): LiveMatch {
  return {
    phase: "pregame",
    matchId,
    queue: "competitive",
    ranked: true,
    map: { uuid: "map-haven", name: mapName, path: "/Game/Maps/Haven" },
    mode: "Bomb",
    phaseEndsInMs: 40000,
    allies: [],
    enemies: [],
    self: {
      puuid: "self-puuid",
      gameName: "Player",
      tagLine: "NA1",
      incognito: false,
      team: "Blue",
      agent: null,
      selection: selfLocked ? "locked" : "selected",
      accountLevel: 50,
      card: null,
      title: null,
      rank: null,
      partyId: "p1",
      loadout: null,
      warnings: [],
    },
  };
}

describe("Instalock", () => {
  let fakeWatcher: MatchWatcher;
  let fakeMatches: {
    validateLockAgent: ReturnType<typeof vi.fn>;
    selectAgent: ReturnType<typeof vi.fn>;
    lockAgent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    fakeWatcher = makeFakeWatcher();
    fakeMatches = {
      validateLockAgent: vi.fn().mockResolvedValue({
        method: "POST",
        path: "/pregame/lock",
        matchId: "m-1",
        agentUuid: "uuid",
      }),
      selectAgent: vi.fn().mockResolvedValue({ phase: "pregame" }),
      lockAgent: vi.fn().mockResolvedValue({ phase: "pregame" }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("rejects invalid delay values", () => {
    expect(
      () =>
        new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, {
          agent: "Jett",
          delayMs: -10,
        }),
    ).toThrowError(ValidationError);

    expect(
      () =>
        new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, {
          agent: "Jett",
          delayMs: 15000,
        }),
    ).toThrowError(ValidationError);
  });

  it("picks agent by map and locks when pregame starts", async () => {
    const lockedEvents: Array<{ matchId: string; agent: string; map: string }> = [];
    const options: InstalockOptions = {
      agent: "Jett",
      byMap: {
        Haven: "Omen",
        Ascent: "Sova",
      },
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    handle.on("locked", (data) => lockedEvents.push(data));

    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.validateLockAgent).toHaveBeenCalledWith("Omen");
    expect(fakeMatches.selectAgent).toHaveBeenCalledWith("Omen");
    expect(fakeMatches.lockAgent).toHaveBeenCalledWith("Omen");
    expect(lockedEvents).toEqual([{ matchId: "m-1", agent: "Omen", map: "Haven" }]);
  });

  it("falls back to next agent when first choice is taken or invalid", async () => {
    fakeMatches.validateLockAgent = vi
      .fn()
      .mockRejectedValueOnce(new ValidationError("agent-locked-by-ally", "Locked by ally"))
      .mockResolvedValueOnce({ matchId: "m-1", agentUuid: "reyna-id" });

    const lockedEvents: Array<{ matchId: string; agent: string; map: string }> = [];
    const options: InstalockOptions = {
      agent: "Jett",
      fallbacks: ["Reyna", "Sage"],
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    handle.on("locked", (data) => lockedEvents.push(data));

    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Bind"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.validateLockAgent).toHaveBeenCalledWith("Jett");
    expect(fakeMatches.validateLockAgent).toHaveBeenCalledWith("Reyna");
    expect(fakeMatches.selectAgent).toHaveBeenCalledWith("Reyna");
    expect(fakeMatches.lockAgent).toHaveBeenCalledWith("Reyna");
    expect(lockedEvents[0]?.agent).toBe("Reyna");
  });

  it("respects delayMs with fake timers", async () => {
    vi.useFakeTimers();

    const options: InstalockOptions = {
      agent: "Jett",
      delayMs: 500,
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven"));

    // Immediately after emission, validate should not have been called yet
    expect(fakeMatches.validateLockAgent).not.toHaveBeenCalled();

    // Advance 499ms: still not called
    await vi.advanceTimersByTimeAsync(499);
    expect(fakeMatches.validateLockAgent).not.toHaveBeenCalled();

    // Advance 1ms (total 500ms): now called
    await vi.advanceTimersByTimeAsync(1);
    expect(fakeMatches.validateLockAgent).toHaveBeenCalledWith("Jett");
    expect(fakeMatches.lockAgent).toHaveBeenCalledWith("Jett");

    handle.stop();
  });

  it("dry run validates but makes no select or lock API calls", async () => {
    const lockedEvents: Array<{ matchId: string; agent: string; map: string }> = [];
    const options: InstalockOptions = {
      agent: "Jett",
      dryRun: true,
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    handle.on("locked", (data) => lockedEvents.push(data));

    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.validateLockAgent).toHaveBeenCalledWith("Jett");
    expect(fakeMatches.selectAgent).not.toHaveBeenCalled();
    expect(fakeMatches.lockAgent).not.toHaveBeenCalled();
    expect(lockedEvents).toEqual([{ matchId: "m-1", agent: "Jett", map: "Haven" }]);
  });

  it("select option only hovers and never calls lockAgent", async () => {
    const options: InstalockOptions = {
      agent: "Jett",
      select: true,
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.validateLockAgent).toHaveBeenCalledWith("Jett");
    expect(fakeMatches.selectAgent).toHaveBeenCalledWith("Jett");
    expect(fakeMatches.lockAgent).not.toHaveBeenCalled();
    handle.stop();
  });

  it("once option stops watcher after the first match", async () => {
    const stopSpy = vi.spyOn(fakeWatcher, "stop");
    const options: InstalockOptions = {
      agent: "Jett",
      once: true,
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options, true);
    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.lockAgent).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(1);

    // Second pregame should not trigger anything
    fakeWatcher.emit("pregame", makePregameMatch("m-2", "Ascent"));
    await new Promise((r) => setTimeout(r, 10));
    expect(fakeMatches.lockAgent).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it("emits skipped when player is already locked", async () => {
    const skippedEvents: Array<{ matchId: string; reason: string }> = [];
    const options: InstalockOptions = {
      agent: "Jett",
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    handle.on("skipped", (data) => skippedEvents.push(data));

    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven", true));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.selectAgent).not.toHaveBeenCalled();
    expect(fakeMatches.lockAgent).not.toHaveBeenCalled();
    expect(skippedEvents).toEqual([{ matchId: "m-1", reason: "already-locked" }]);
  });

  it("emits skipped when none of the candidates are valid", async () => {
    fakeMatches.validateLockAgent = vi
      .fn()
      .mockRejectedValue(new ValidationError("agent-not-owned", "Not owned"));

    const skippedEvents: Array<{ matchId: string; reason: string }> = [];
    const options: InstalockOptions = {
      agent: "Jett",
      fallbacks: ["Sage"],
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    handle.on("skipped", (data) => skippedEvents.push(data));

    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.selectAgent).not.toHaveBeenCalled();
    expect(skippedEvents).toEqual([{ matchId: "m-1", reason: "none-valid" }]);
  });

  it("emits error and never retries when Riot refuses lockAgent", async () => {
    fakeMatches.lockAgent = vi
      .fn()
      .mockRejectedValue(new Error("Riot server error 500"));

    const errors: Error[] = [];
    const options: InstalockOptions = {
      agent: "Jett",
    };

    const handle = new Instalock(fakeWatcher, fakeMatches as unknown as MatchesApi, options);
    handle.on("error", (err) => errors.push(err));

    fakeWatcher.emit("pregame", makePregameMatch("m-1", "Haven"));
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeMatches.lockAgent).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("Riot server error 500");
  });
});
