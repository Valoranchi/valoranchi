import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RiotClient } from "../src/RiotClient.js";
import { AccountService } from "../src/client/AccountService.js";
import { MatchService } from "../src/client/MatchService.js";
import { PartyService } from "../src/client/PartyService.js";
import { SocialService } from "../src/client/SocialService.js";
import { StoreService } from "../src/client/StoreService.js";
import { SessionManager } from "../src/client/SessionManager.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import { ValorantApi } from "../src/catalogue/ValorantApi.js";
import { HttpGateway } from "../src/riot/HttpGateway.js";
import http from "node:http";
import {
  exitCodeForError,
  formatError,
  formatWatchLine,
  runCli,
  runWatchStore,
  shouldLaunchDashboard,
  startDashboardServer,
  USAGE,
} from "../src/cli.js";

const packageVersion = (
  JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf-8")) as {
    version: string;
  }
).version;
import type { RiotEvents, RiotEventMap } from "../src/events/RiotEvents.js";
import { TypedEmitter } from "../src/events/TypedEmitter.js";
import {
  ForbiddenHostError,
  OfficialApiKeyMissingError,
  RegionUnknownError,
  RiotApiError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
  ValidationError,
} from "../src/errors.js";

describe("CLI error mapping", () => {
  it("maps RiotClientNotRunningError to exit code 2", () => {
    expect(exitCodeForError(new RiotClientNotRunningError())).toBe(2);
  });

  it("maps RiotClientNotReadyError to exit code 3", () => {
    expect(exitCodeForError(new RiotClientNotReadyError())).toBe(3);
  });

  it("maps RegionUnknownError to exit code 4", () => {
    expect(exitCodeForError(new RegionUnknownError())).toBe(4);
  });

  it("maps RiotApiError to exit code 5", () => {
    expect(exitCodeForError(new RiotApiError(500, "https://pd.na.a.pvp.net"))).toBe(5);
  });

  it("maps ValidationError to exit code 6", () => {
    expect(exitCodeForError(new ValidationError("skin-not-owned"))).toBe(6);
  });

  it("maps OfficialApiKeyMissingError to exit code 7", () => {
    expect(exitCodeForError(new OfficialApiKeyMissingError())).toBe(7);
  });

  it("maps ForbiddenHostError and generic errors to exit code 1", () => {
    expect(exitCodeForError(new ForbiddenHostError("evil.com"))).toBe(1);
    expect(exitCodeForError(new Error("Something went wrong"))).toBe(1);
    expect(exitCodeForError("String error")).toBe(1);
  });

  it("formats ValidationError with reason and details", () => {
    const formatted = formatError(
      new ValidationError("skin-not-owned", "Skin is not owned", { skin: "abc" }),
    );
    expect(formatted).toEqual({
      error: {
        code: "VALIDATION",
        reason: "skin-not-owned",
        message: "Skin is not owned",
        details: { skin: "abc" },
      },
    });
  });

  it("formats errors matching { error: { code, message } }", () => {
    const formatted = formatError(new RiotClientNotRunningError("Client offline"));
    expect(formatted).toEqual({
      error: {
        code: "RIOT_CLIENT_NOT_RUNNING",
        message: "Client offline",
      },
    });

    const unknownFormatted = formatError(new Error("Generic failure"));
    expect(unknownFormatted).toEqual({
      error: {
        code: "UNKNOWN_ERROR",
        message: "Generic failure",
      },
    });
  });
});

describe("CLI entrypoint and flags", () => {
  it("prints version and exits 0 on --version", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(["--version"]);
      expect(code).toBe(0);
      expect(output.trim()).toBe(packageVersion);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("prints USAGE and exits 0 on --help", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(["--help"]);
      expect(code).toBe(0);
      expect(output).toBe(USAGE);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("dispatches all commands to RiotClient and calls close() in finally", async () => {
    const originalStdout = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;

    const closeSpy = vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);
    const friendsSpy = vi.spyOn(SocialService.prototype, "friends").mockResolvedValue([]);
    const requestsSpy = vi.spyOn(SocialService.prototype, "friendRequests").mockResolvedValue([]);
    const blockedSpy = vi.spyOn(SocialService.prototype, "blocked").mockResolvedValue([]);
    const convSpy = vi.spyOn(SocialService.prototype, "conversations").mockResolvedValue([]);
    const msgSpy = vi.spyOn(SocialService.prototype, "messages").mockResolvedValue([]);
    const storeSpy = vi.spyOn(StoreService.prototype, "current").mockResolvedValue({
      player: { puuid: "p", gameName: "P", tagLine: "T", region: "r", shard: "s", accountLevel: 1 },
      fetchedAt: "now",
      daily: null,
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    });
    const matchesSpy = vi.spyOn(MatchService.prototype, "list").mockResolvedValue([]);
    const matchSpy = vi.spyOn(MatchService.prototype, "get").mockResolvedValue({} as never);
    const mmrSpy = vi.spyOn(MatchService.prototype, "mmr").mockResolvedValue({} as never);
    const rankHistorySpy = vi
      .spyOn(MatchService.prototype, "rankHistory")
      .mockResolvedValue([] as never);
    const liveSpy = vi.spyOn(MatchService.prototype, "live").mockResolvedValue({ phase: "none" });
    const partySpy = vi.spyOn(PartyService.prototype, "current").mockResolvedValue(null);

    try {
      expect(await runCli(["friends"])).toBe(0);
      expect(friendsSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["friend-requests"])).toBe(0);
      expect(requestsSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["blocked"])).toBe(0);
      expect(blockedSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["conversations"])).toBe(0);
      expect(convSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["messages", "--cid", "room-123"])).toBe(0);
      expect(msgSpy).toHaveBeenCalledWith("room-123");

      expect(await runCli(["store"])).toBe(0);
      expect(storeSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["matches", "--count", "5", "--queue", "competitive"])).toBe(0);
      expect(matchesSpy).toHaveBeenCalledWith({ count: 5, queue: "competitive" });

      expect(await runCli(["match", "match-uuid-1"])).toBe(0);
      expect(matchSpy).toHaveBeenCalledWith("match-uuid-1");

      expect(await runCli(["mmr"])).toBe(0);
      expect(mmrSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["rank-history", "--count", "3"])).toBe(0);
      expect(rankHistorySpy).toHaveBeenCalledWith({ count: 3 });

      expect(await runCli(["live", "--ranks", "--no-loadouts"])).toBe(0);
      expect(liveSpy).toHaveBeenCalledWith({ ranks: true, loadouts: false });

      expect(await runCli(["party"])).toBe(0);
      expect(partySpy).toHaveBeenCalledTimes(1);

      expect(closeSpy).toHaveBeenCalledTimes(12);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("handles missing match ID with an error", async () => {
    const originalStderr = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      const code = await runCli(["match"]);
      expect(code).toBe(1);
    } finally {
      process.stderr.write = originalStderr;
    }
  });
});

describe("CLI watch command", () => {
  it("formats line matching { event, at, data }", () => {
    const fixedIso = "2026-09-29T12:00:00.000Z";
    const line = formatWatchLine("connected", undefined, fixedIso);
    expect(line).toBe('{"event":"connected","at":"2026-09-29T12:00:00.000Z","data":null}');

    const lineWithData = formatWatchLine("party", { partyId: "p1" }, fixedIso);
    expect(lineWithData).toBe(
      '{"event":"party","at":"2026-09-29T12:00:00.000Z","data":{"partyId":"p1"}}',
    );
  });

  it("streams events as JSON lines and exits 0 on SIGINT", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakeEmitter = new TypedEmitter<RiotEventMap>();
    vi.spyOn(RiotClient.prototype, "events").mockReturnValue(fakeEmitter as unknown as RiotEvents);
    const closeSpy = vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const promise = runCli(["watch", "--only", "connected,party"]);

    fakeEmitter.emit("connected");
    fakeEmitter.emit("party", { partyId: "party-99" });
    fakeEmitter.emit("game", { phase: "pregame", matchId: "m1" });

    process.emit("SIGINT");
    const code = await promise;

    process.stdout.write = originalWrite;
    expect(code).toBe(0);
    expect(closeSpy).toHaveBeenCalled();

    const lines = output
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { event: string; data: unknown });
    expect(lines).toHaveLength(2);
    expect(lines[0]!.event).toBe("connected");
    expect(lines[1]!.event).toBe("party");
    expect(lines[1]!.data).toEqual({ partyId: "party-99" });
  });

  it("filters out raw events unless --raw flag is passed", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakeEmitter = new TypedEmitter<RiotEventMap>();
    vi.spyOn(RiotClient.prototype, "events").mockReturnValue(fakeEmitter as unknown as RiotEvents);
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const promise = runCli(["watch"]);
    fakeEmitter.emit("raw", { uri: "/foo", eventType: "Create", data: {} });
    fakeEmitter.emit("party", { partyId: "p1" });

    process.emit("SIGTERM");
    await promise;

    process.stdout.write = originalWrite;
    const lines = output
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { event: string });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.event).toBe("party");
  });
});

describe("CLI write commands and dry-run", () => {
  it("defaults to dry-run and prints validated body on equip", async () => {
    let output = "";
    const originalStdout = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakePutBody = { Subject: "p1", Version: 1, Guns: [], ActiveExpressions: [] };
    const validateSpy = vi
      .spyOn(AccountService.prototype, "validateEquip")
      .mockResolvedValue(fakePutBody as never);
    const equipSpy = vi.spyOn(AccountService.prototype, "equip").mockResolvedValue({} as never);
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      const code = await runCli(["equip", "--card", "card-1", "--incognito", "on"]);
      expect(code).toBe(0);
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ card: "card-1", incognito: true }),
      );
      expect(equipSpy).not.toHaveBeenCalled();
      expect(JSON.parse(output.trim())).toEqual(fakePutBody);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("executes write when --yes is passed to equip", async () => {
    let output = "";
    const originalStdout = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakeLoadout = { guns: [], incognito: true };
    const equipSpy = vi
      .spyOn(AccountService.prototype, "equip")
      .mockResolvedValue(fakeLoadout as never);
    const validateSpy = vi.spyOn(AccountService.prototype, "validateEquip");
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      const code = await runCli(["equip", "--card", "card-1", "--yes"]);
      expect(code).toBe(0);
      expect(equipSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy).not.toHaveBeenCalled();
      expect(JSON.parse(output.trim())).toEqual(fakeLoadout);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("outputs exit code 6 and formatted error on ValidationError in equip", async () => {
    let stderrOutput = "";
    const originalStderr = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      stderrOutput += chunk;
      return true;
    }) as typeof process.stderr.write;

    vi.spyOn(AccountService.prototype, "validateEquip").mockRejectedValue(
      new ValidationError("card-not-owned", "Card not owned", { card: "bad-card" }),
    );
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      const code = await runCli(["equip", "--card", "bad-card"]);
      expect(code).toBe(6);
      const parsed = JSON.parse(stderrOutput.trim());
      expect(parsed).toEqual({
        error: {
          code: "VALIDATION",
          reason: "card-not-owned",
          message: "Card not owned",
          details: { card: "bad-card" },
        },
      });
    } finally {
      process.stderr.write = originalStderr;
      vi.restoreAllMocks();
    }
  });

  it("handles social write commands with dry-run and --yes", async () => {
    const originalStdout = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const valSendSpy = vi
      .spyOn(SocialService.prototype, "validateSendMessage")
      .mockResolvedValue({ cid: "c1", message: "hi", type: "chat" });
    const sendSpy = vi.spyOn(SocialService.prototype, "sendMessage").mockResolvedValue({} as never);

    const valReqSpy = vi
      .spyOn(SocialService.prototype, "validateSendFriendRequest")
      .mockResolvedValue({ game_name: "A", game_tag: "1" });
    const reqSpy = vi
      .spyOn(SocialService.prototype, "sendFriendRequest")
      .mockResolvedValue([] as never);

    const valAcceptSpy = vi
      .spyOn(SocialService.prototype, "validateAcceptFriendRequest")
      .mockResolvedValue({ game_name: "B", game_tag: "2" });
    const acceptSpy = vi
      .spyOn(SocialService.prototype, "acceptFriendRequest")
      .mockResolvedValue([] as never);

    const valDeclineSpy = vi
      .spyOn(SocialService.prototype, "validateDeclineFriendRequest")
      .mockResolvedValue({ puuid: "p1" });
    const declineSpy = vi
      .spyOn(SocialService.prototype, "declineFriendRequest")
      .mockResolvedValue([] as never);

    const valCancelSpy = vi
      .spyOn(SocialService.prototype, "validateCancelFriendRequest")
      .mockResolvedValue({ puuid: "p2" });
    const cancelSpy = vi
      .spyOn(SocialService.prototype, "cancelFriendRequest")
      .mockResolvedValue([] as never);

    const valRemoveSpy = vi
      .spyOn(SocialService.prototype, "validateRemoveFriend")
      .mockResolvedValue({ puuid: "p3" });
    const removeSpy = vi
      .spyOn(SocialService.prototype, "removeFriend")
      .mockResolvedValue([] as never);

    const valBlockSpy = vi
      .spyOn(SocialService.prototype, "validateBlockPlayer")
      .mockResolvedValue({ puuid: "p4" });
    const blockSpy = vi
      .spyOn(SocialService.prototype, "blockPlayer")
      .mockResolvedValue([] as never);

    const valUnblockSpy = vi
      .spyOn(SocialService.prototype, "validateUnblockPlayer")
      .mockResolvedValue({ puuid: "p5" });
    const unblockSpy = vi
      .spyOn(SocialService.prototype, "unblockPlayer")
      .mockResolvedValue([] as never);

    const valEquipColSpy = vi
      .spyOn(AccountService.prototype, "validateEquipCollection")
      .mockResolvedValue({} as never);
    const equipColSpy = vi
      .spyOn(AccountService.prototype, "equipCollection")
      .mockResolvedValue({} as never);

    try {
      // Dry-runs (no --yes)
      expect(await runCli(["send", "--to", "player#123", "--text", "hello"])).toBe(0);
      expect(valSendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-request", "Bob#999"])).toBe(0);
      expect(valReqSpy).toHaveBeenCalledWith("Bob#999");
      expect(reqSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-accept", "puuid-1"])).toBe(0);
      expect(valAcceptSpy).toHaveBeenCalledWith("puuid-1");
      expect(acceptSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-decline", "puuid-2"])).toBe(0);
      expect(valDeclineSpy).toHaveBeenCalledWith("puuid-2");
      expect(declineSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-cancel", "puuid-3"])).toBe(0);
      expect(valCancelSpy).toHaveBeenCalledWith("puuid-3");
      expect(cancelSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-remove", "puuid-4"])).toBe(0);
      expect(valRemoveSpy).toHaveBeenCalledWith("puuid-4");
      expect(removeSpy).not.toHaveBeenCalled();

      expect(await runCli(["block", "puuid-5"])).toBe(0);
      expect(valBlockSpy).toHaveBeenCalledWith("puuid-5");
      expect(blockSpy).not.toHaveBeenCalled();

      expect(await runCli(["unblock", "puuid-6"])).toBe(0);
      expect(valUnblockSpy).toHaveBeenCalledWith("puuid-6");
      expect(unblockSpy).not.toHaveBeenCalled();

      expect(await runCli(["equip-collection", "skin-1,skin-2"])).toBe(0);
      expect(valEquipColSpy).toHaveBeenCalledWith(["skin-1", "skin-2"]);
      expect(equipColSpy).not.toHaveBeenCalled();

      // With --yes
      expect(await runCli(["send", "--to", "player#123", "--text", "hello", "--yes"])).toBe(0);
      expect(sendSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["friend-request", "Bob#999", "--yes"])).toBe(0);
      expect(reqSpy).toHaveBeenCalledWith("Bob#999");

      expect(await runCli(["equip-collection", "skin-1,skin-2", "--yes"])).toBe(0);
      expect(equipColSpy).toHaveBeenCalledWith(["skin-1", "skin-2"]);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("handles party write commands with dry-run and --yes", async () => {
    let output = "";
    const originalStdout = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const valInviteSpy = vi
      .spyOn(PartyService.prototype, "validateInvite")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/invites/name/Bob/tag/1" });
    const inviteSpy = vi.spyOn(PartyService.prototype, "invite").mockResolvedValue({} as never);

    const valKickSpy = vi
      .spyOn(PartyService.prototype, "validateKick")
      .mockResolvedValue({ method: "DELETE", path: "/parties/v1/parties/p1/members/target" });
    const kickSpy = vi.spyOn(PartyService.prototype, "kick").mockResolvedValue({} as never);

    const valPromoteSpy = vi
      .spyOn(PartyService.prototype, "validatePromote")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/members/target/owner" });
    const promoteSpy = vi.spyOn(PartyService.prototype, "promote").mockResolvedValue({} as never);

    const valCreateCodeSpy = vi
      .spyOn(PartyService.prototype, "validateCreateInviteCode")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/invitecode" });
    const createCodeSpy = vi
      .spyOn(PartyService.prototype, "createInviteCode")
      .mockResolvedValue({} as never);

    const valRevokeCodeSpy = vi
      .spyOn(PartyService.prototype, "validateRevokeInviteCode")
      .mockResolvedValue({ method: "DELETE", path: "/parties/v1/parties/p1/invitecode" });
    const revokeCodeSpy = vi
      .spyOn(PartyService.prototype, "revokeInviteCode")
      .mockResolvedValue({} as never);

    const valJoinSpy = vi
      .spyOn(PartyService.prototype, "validateJoinByCode")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/players/joinbycode/CODE1" });
    const joinSpy = vi.spyOn(PartyService.prototype, "joinByCode").mockResolvedValue({} as never);

    const valReadySpy = vi.spyOn(PartyService.prototype, "validateSetReady").mockResolvedValue({
      method: "POST",
      path: "/parties/v1/parties/p1/members/self/setReady",
      body: { ready: true },
    });
    const readySpy = vi.spyOn(PartyService.prototype, "setReady").mockResolvedValue({} as never);

    const valQueueSpy = vi.spyOn(PartyService.prototype, "validateSetQueue").mockResolvedValue({
      method: "POST",
      path: "/parties/v1/parties/p1/queue",
      body: { queueID: "competitive" },
    });
    const queueSpy = vi.spyOn(PartyService.prototype, "setQueue").mockResolvedValue({} as never);

    const valAccessSpy = vi
      .spyOn(PartyService.prototype, "validateSetAccessibility")
      .mockResolvedValue({
        method: "POST",
        path: "/parties/v1/parties/p1/accessibility",
        body: { accessibility: "OPEN" },
      });
    const accessSpy = vi
      .spyOn(PartyService.prototype, "setAccessibility")
      .mockResolvedValue({} as never);

    const valStartSpy = vi
      .spyOn(PartyService.prototype, "validateStartMatchmaking")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/matchmaking/join" });
    const startSpy = vi
      .spyOn(PartyService.prototype, "startMatchmaking")
      .mockResolvedValue({} as never);

    const valStopSpy = vi
      .spyOn(PartyService.prototype, "validateStopMatchmaking")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/matchmaking/leave" });
    const stopSpy = vi
      .spyOn(PartyService.prototype, "stopMatchmaking")
      .mockResolvedValue({} as never);

    const valLeaveSpy = vi
      .spyOn(PartyService.prototype, "validateLeave")
      .mockResolvedValue({ method: "DELETE", path: "/parties/v1/players/self" });
    const leaveSpy = vi.spyOn(PartyService.prototype, "leave").mockResolvedValue({} as never);

    try {
      expect(await runCli(["party-invite", "Bob#1"])).toBe(0);
      expect(valInviteSpy).toHaveBeenCalledWith("Bob#1");
      expect(inviteSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-kick", "target-puuid"])).toBe(0);
      expect(valKickSpy).toHaveBeenCalledWith("target-puuid");
      expect(kickSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-promote", "target-puuid"])).toBe(0);
      expect(valPromoteSpy).toHaveBeenCalledWith("target-puuid");
      expect(promoteSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-code"])).toBe(0);
      expect(valCreateCodeSpy).toHaveBeenCalledTimes(1);
      expect(createCodeSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-code", "--revoke"])).toBe(0);
      expect(valRevokeCodeSpy).toHaveBeenCalledTimes(1);
      expect(revokeCodeSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-join", "CODE1"])).toBe(0);
      expect(valJoinSpy).toHaveBeenCalledWith("CODE1");
      expect(joinSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-ready", "on"])).toBe(0);
      expect(valReadySpy).toHaveBeenCalledWith(true);
      expect(readySpy).not.toHaveBeenCalled();

      output = "";
      expect(await runCli(["party-queue", "competitive"])).toBe(0);
      expect(valQueueSpy).toHaveBeenCalledWith("competitive");
      expect(queueSpy).not.toHaveBeenCalled();
      expect(JSON.parse(output.trim())).toEqual({
        method: "POST",
        path: "/parties/v1/parties/p1/queue",
        body: { queueID: "competitive" },
      });

      expect(await runCli(["party-access", "open"])).toBe(0);
      expect(valAccessSpy).toHaveBeenCalledWith("open");
      expect(accessSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-start"])).toBe(0);
      expect(valStartSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-stop"])).toBe(0);
      expect(valStopSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-leave"])).toBe(0);
      expect(valLeaveSpy).toHaveBeenCalledTimes(1);
      expect(leaveSpy).not.toHaveBeenCalled();

      // Executing with --yes
      expect(await runCli(["party-invite", "Bob#1", "--yes"])).toBe(0);
      expect(inviteSpy).toHaveBeenCalledWith("Bob#1");

      expect(await runCli(["party-kick", "target-puuid", "--yes"])).toBe(0);
      expect(kickSpy).toHaveBeenCalledWith("target-puuid");

      expect(await runCli(["party-promote", "target-puuid", "--yes"])).toBe(0);
      expect(promoteSpy).toHaveBeenCalledWith("target-puuid");

      expect(await runCli(["party-code", "--yes"])).toBe(0);
      expect(createCodeSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-code", "--revoke", "--yes"])).toBe(0);
      expect(revokeCodeSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-join", "CODE1", "--yes"])).toBe(0);
      expect(joinSpy).toHaveBeenCalledWith("CODE1");

      expect(await runCli(["party-ready", "off", "--yes"])).toBe(0);
      expect(readySpy).toHaveBeenCalledWith(false);

      expect(await runCli(["party-queue", "competitive", "--yes"])).toBe(0);
      expect(queueSpy).toHaveBeenCalledWith("competitive");

      expect(await runCli(["party-access", "closed", "--yes"])).toBe(0);
      expect(accessSpy).toHaveBeenCalledWith("closed");

      expect(await runCli(["party-start", "--yes"])).toBe(0);
      expect(startSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-stop", "--yes"])).toBe(0);
      expect(stopSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-leave", "--yes"])).toBe(0);
      expect(leaveSpy).toHaveBeenCalledTimes(1);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("fails with exit code 6 when missing required arguments for party commands", async () => {
    const originalStderr = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      expect(await runCli(["party-invite"])).toBe(6);
      expect(await runCli(["party-kick"])).toBe(6);
      expect(await runCli(["party-promote"])).toBe(6);
      expect(await runCli(["party-join"])).toBe(6);
      expect(await runCli(["party-ready"])).toBe(6);
      expect(await runCli(["party-queue"])).toBe(6);
      expect(await runCli(["party-access"])).toBe(6);
    } finally {
      process.stderr.write = originalStderr;
      vi.restoreAllMocks();
    }
  });

  it("dispatches expanded remote read commands to RiotClient", async () => {
    const originalStdout = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;

    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);
    const xpSpy = vi.spyOn(AccountService.prototype, "xp").mockResolvedValue({} as never);
    const contractsSpy = vi
      .spyOn(AccountService.prototype, "contracts")
      .mockResolvedValue([] as never);
    const missionsSpy = vi
      .spyOn(AccountService.prototype, "missions")
      .mockResolvedValue([] as never);
    const penaltiesSpy = vi
      .spyOn(AccountService.prototype, "penalties")
      .mockResolvedValue([] as never);
    const favSpy = vi.spyOn(AccountService.prototype, "favourites").mockResolvedValue([] as never);
    const sessionSpy = vi.spyOn(AccountService.prototype, "session").mockResolvedValue({} as never);
    const configSpy = vi.spyOn(AccountService.prototype, "config").mockResolvedValue({} as never);
    const offersSpy = vi.spyOn(StoreService.prototype, "offers").mockResolvedValue([] as never);
    const orderSpy = vi.spyOn(StoreService.prototype, "order").mockResolvedValue({} as never);
    const matchesForSpy = vi
      .spyOn(MatchService.prototype, "listFor")
      .mockResolvedValue([] as never);
    const mmrForSpy = vi.spyOn(MatchService.prototype, "mmrFor").mockResolvedValue({} as never);
    const rankHistoryForSpy = vi
      .spyOn(MatchService.prototype, "rankHistoryFor")
      .mockResolvedValue([] as never);
    const leaderboardSpy = vi
      .spyOn(MatchService.prototype, "leaderboard")
      .mockResolvedValue({} as never);
    const contentSpy = vi.spyOn(MatchService.prototype, "content").mockResolvedValue({} as never);
    const premierSpy = vi.spyOn(MatchService.prototype, "premier").mockResolvedValue({} as never);
    const queuesSpy = vi.spyOn(PartyService.prototype, "queues").mockResolvedValue([] as never);
    const customGameConfigsSpy = vi
      .spyOn(PartyService.prototype, "customGameConfigs")
      .mockResolvedValue({} as never);

    try {
      expect(await runCli(["xp"])).toBe(0);
      expect(xpSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["contracts"])).toBe(0);
      expect(contractsSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["missions"])).toBe(0);
      expect(missionsSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["penalties"])).toBe(0);
      expect(penaltiesSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["favourites"])).toBe(0);
      expect(favSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["session"])).toBe(0);
      expect(sessionSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["config"])).toBe(0);
      expect(configSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["offers"])).toBe(0);
      expect(offersSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["order", "order-123"])).toBe(0);
      expect(orderSpy).toHaveBeenCalledWith("order-123");

      expect(
        await runCli(["matches-for", "target-puuid", "--count", "5", "--queue", "competitive"]),
      ).toBe(0);
      expect(matchesForSpy).toHaveBeenCalledWith("target-puuid", {
        count: 5,
        queue: "competitive",
      });

      expect(await runCli(["mmr-for", "target-puuid"])).toBe(0);
      expect(mmrForSpy).toHaveBeenCalledWith("target-puuid");

      expect(await runCli(["rank-history-for", "target-puuid", "--count", "3"])).toBe(0);
      expect(rankHistoryForSpy).toHaveBeenCalledWith("target-puuid", { count: 3 });

      expect(
        await runCli([
          "leaderboard",
          "--season",
          "season-1",
          "--start",
          "10",
          "--size",
          "25",
          "--query",
          "Player",
        ]),
      ).toBe(0);
      expect(leaderboardSpy).toHaveBeenCalledWith({
        season: "season-1",
        start: 10,
        size: 25,
        query: "Player",
      });

      expect(await runCli(["content"])).toBe(0);
      expect(contentSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["premier"])).toBe(0);
      expect(premierSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["queues"])).toBe(0);
      expect(queuesSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["custom-game-configs"])).toBe(0);
      expect(customGameConfigsSpy).toHaveBeenCalledTimes(1);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("dispatches expanded remote write commands (dry-run vs --yes)", async () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const valActContract = vi
      .spyOn(AccountService.prototype, "validateActivateContract")
      .mockResolvedValue({} as never);
    const actContract = vi
      .spyOn(AccountService.prototype, "activateContract")
      .mockResolvedValue([] as never);

    const valAddFav = vi
      .spyOn(AccountService.prototype, "validateAddFavourite")
      .mockResolvedValue({} as never);
    const addFav = vi
      .spyOn(AccountService.prototype, "addFavourite")
      .mockResolvedValue([] as never);

    const valRemFav = vi
      .spyOn(AccountService.prototype, "validateRemoveFavourite")
      .mockResolvedValue({} as never);
    const remFav = vi
      .spyOn(AccountService.prototype, "removeFavourite")
      .mockResolvedValue([] as never);

    const valSetBadge = vi
      .spyOn(AccountService.prototype, "validateSetActRankBadgeHidden")
      .mockResolvedValue({} as never);
    const setBadge = vi
      .spyOn(AccountService.prototype, "setActRankBadgeHidden")
      .mockResolvedValue({} as never);

    const valSetLb = vi
      .spyOn(AccountService.prototype, "validateSetLeaderboardAnonymized")
      .mockResolvedValue({} as never);
    const setLb = vi
      .spyOn(AccountService.prototype, "setLeaderboardAnonymized")
      .mockResolvedValue({} as never);

    const valRevealNm = vi
      .spyOn(StoreService.prototype, "validateRevealNightMarket")
      .mockResolvedValue({} as never);
    const revealNm = vi
      .spyOn(StoreService.prototype, "revealNightMarket")
      .mockResolvedValue({} as never);

    const valBuy = vi.spyOn(StoreService.prototype, "validateBuy").mockResolvedValue({} as never);
    const buy = vi.spyOn(StoreService.prototype, "buy").mockResolvedValue({} as never);

    try {
      // Contract activate
      expect(await runCli(["contract-activate", "c-uuid"])).toBe(0);
      expect(valActContract).toHaveBeenCalledWith("c-uuid");
      expect(actContract).not.toHaveBeenCalled();

      expect(await runCli(["contract-activate", "c-uuid", "--yes"])).toBe(0);
      expect(actContract).toHaveBeenCalledWith("c-uuid");

      // Favourite add / remove
      expect(await runCli(["favourite-add", "skin-uuid"])).toBe(0);
      expect(valAddFav).toHaveBeenCalledWith("skin-uuid");
      expect(addFav).not.toHaveBeenCalled();

      expect(await runCli(["favourite-add", "skin-uuid", "--yes"])).toBe(0);
      expect(addFav).toHaveBeenCalledWith("skin-uuid");

      expect(await runCli(["favourite-remove", "skin-uuid"])).toBe(0);
      expect(valRemFav).toHaveBeenCalledWith("skin-uuid");
      expect(remFav).not.toHaveBeenCalled();

      expect(await runCli(["favourite-remove", "skin-uuid", "--yes"])).toBe(0);
      expect(remFav).toHaveBeenCalledWith("skin-uuid");

      // Privacy
      expect(await runCli(["privacy", "--badge", "on", "--leaderboard", "off"])).toBe(0);
      expect(valSetBadge).toHaveBeenCalledWith(true);
      expect(valSetLb).toHaveBeenCalledWith(false);
      expect(setBadge).not.toHaveBeenCalled();
      expect(setLb).not.toHaveBeenCalled();

      expect(await runCli(["privacy", "--badge", "off", "--leaderboard", "on", "--yes"])).toBe(0);
      expect(setBadge).toHaveBeenCalledWith(false);
      expect(setLb).toHaveBeenCalledWith(true);

      // Night Market reveal
      expect(await runCli(["night-market-reveal"])).toBe(0);
      expect(valRevealNm).toHaveBeenCalledTimes(1);
      expect(revealNm).not.toHaveBeenCalled();

      expect(await runCli(["night-market-reveal", "--yes"])).toBe(0);
      expect(revealNm).toHaveBeenCalledTimes(1);

      // Buy dry-run (no --yes)
      expect(await runCli(["buy", "--offer", "offer-1"])).toBe(0);
      expect(valBuy).toHaveBeenCalledWith({ offerId: "offer-1" }, { confirm: true });
      expect(buy).not.toHaveBeenCalled();

      // Buy with --yes but without --confirm -> fails with 6 (confirm-required)
      expect(await runCli(["buy", "--offer", "offer-1", "--yes"])).toBe(6);
      expect(buy).not.toHaveBeenCalled();

      // Buy with --yes and --confirm -> succeeds
      expect(await runCli(["buy", "--offer", "offer-1", "--yes", "--confirm"])).toBe(0);
      expect(buy).toHaveBeenCalledWith({ offerId: "offer-1" }, { confirm: true });

      // Buy bundle with --yes and --confirm
      expect(await runCli(["buy", "--bundle", "bundle-1", "--yes", "--confirm"])).toBe(0);
      expect(buy).toHaveBeenCalledWith({ bundleId: "bundle-1" }, { confirm: true });
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      vi.restoreAllMocks();
    }
  });

  it("fails with exit code 6 when missing required arguments for remote commands", async () => {
    const originalStderr = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      expect(await runCli(["order"])).toBe(6);
      expect(await runCli(["matches-for"])).toBe(6);
      expect(await runCli(["mmr-for"])).toBe(6);
      expect(await runCli(["rank-history-for"])).toBe(6);
      expect(await runCli(["contract-activate"])).toBe(6);
      expect(await runCli(["favourite-add"])).toBe(6);
      expect(await runCli(["favourite-remove"])).toBe(6);
      expect(await runCli(["privacy"])).toBe(6);
      expect(await runCli(["buy"])).toBe(6);
      expect(await runCli(["agent-select"])).toBe(6);
      expect(await runCli(["agent-lock"])).toBe(6);
      expect(await runCli(["party-decline-invite"])).toBe(6);
      expect(await runCli(["party-request"])).toBe(6);
      expect(await runCli(["party-decline-request"])).toBe(6);
      expect(await runCli(["custom-game-settings"])).toBe(6);
      expect(await runCli(["custom-game-team"])).toBe(6);
      expect(await runCli(["party-default"])).toBe(6);
      expect(await runCli(["party-servers"])).toBe(6);
      expect(await runCli(["party-moderator"])).toBe(6);
      expect(await runCli(["settings-save"])).toBe(6);
      expect(await runCli(["local"])).toBe(6);
      expect(await runCli(["riot"])).toBe(6);
    } finally {
      process.stderr.write = originalStderr;
      vi.restoreAllMocks();
    }
  });

  it("dispatches live match actions, party extras, custom game, settings, and raw commands", async () => {
    const originalStdout = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;

    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    // Match actions
    const valSelect = vi
      .spyOn(MatchService.prototype, "validateSelectAgent")
      .mockResolvedValue({ method: "POST", path: "/select/Jett", matchId: "m1", agentUuid: "u1" });
    const select = vi.spyOn(MatchService.prototype, "selectAgent").mockResolvedValue({} as never);

    const valLock = vi
      .spyOn(MatchService.prototype, "validateLockAgent")
      .mockResolvedValue({ method: "POST", path: "/lock/Jett", matchId: "m1", agentUuid: "u1" });
    const lock = vi.spyOn(MatchService.prototype, "lockAgent").mockResolvedValue({} as never);

    const valDodge = vi
      .spyOn(MatchService.prototype, "validateDodge")
      .mockResolvedValue({ method: "POST", path: "/pregame/v1/matches/m1/quit", matchId: "m1" });
    const dodge = vi
      .spyOn(MatchService.prototype, "dodge")
      .mockResolvedValue({ dodged: true, matchId: "m1" });
    const valLeaveMatch = vi.spyOn(MatchService.prototype, "validateLeaveMatch").mockResolvedValue({
      method: "POST",
      path: "/core-game/v1/players/me/disassociate/m1",
      matchId: "m1",
      puuid: "me",
    });
    const leaveMatch = vi
      .spyOn(MatchService.prototype, "leaveMatch")
      .mockResolvedValue({ left: true, matchId: "m1" });

    // Party extras & Custom games
    const valJoinParty = vi
      .spyOn(PartyService.prototype, "validateJoin")
      .mockResolvedValue({ partyId: "party-uuid-1" });
    const joinParty = vi.spyOn(PartyService.prototype, "join").mockResolvedValue({} as never);

    const invitesSpy = vi.spyOn(PartyService.prototype, "invites").mockResolvedValue([]);
    const requestsSpy = vi.spyOn(PartyService.prototype, "requests").mockResolvedValue([]);

    const valDeclineInv = vi
      .spyOn(PartyService.prototype, "validateDeclineInvite")
      .mockResolvedValue({ partyId: "p1", inviteId: "inv-1" });
    const declineInv = vi
      .spyOn(PartyService.prototype, "declineInvite")
      .mockResolvedValue({ declined: true, inviteId: "inv-1" });

    const valReqJoin = vi
      .spyOn(PartyService.prototype, "validateRequestToJoin")
      .mockResolvedValue({ method: "POST", path: "/req", body: {} });
    const reqJoin = vi
      .spyOn(PartyService.prototype, "requestToJoin")
      .mockResolvedValue({ requested: true, partyId: "p1" });

    const valDeclineReq = vi
      .spyOn(PartyService.prototype, "validateDeclineRequest")
      .mockResolvedValue({ partyId: "p1", requestId: "req-1" });
    const declineReq = vi
      .spyOn(PartyService.prototype, "declineRequest")
      .mockResolvedValue({ declined: true, requestId: "req-1" });

    const valCustom = vi
      .spyOn(PartyService.prototype, "validateMakeCustomGame")
      .mockResolvedValue({ partyId: "p1" });
    const custom = vi
      .spyOn(PartyService.prototype, "makeCustomGame")
      .mockResolvedValue({} as never);

    const valCustomSetts = vi
      .spyOn(PartyService.prototype, "validateSetCustomGameSettings")
      .mockResolvedValue({});
    const customSetts = vi
      .spyOn(PartyService.prototype, "setCustomGameSettings")
      .mockResolvedValue({} as never);

    const valSetTeam = vi
      .spyOn(PartyService.prototype, "validateSetTeam")
      .mockResolvedValue({ partyId: "p1", team: "TeamOne", puuid: "puuid-1" });
    const setTeam = vi.spyOn(PartyService.prototype, "setTeam").mockResolvedValue({} as never);

    const valStartCustom = vi
      .spyOn(PartyService.prototype, "validateStartCustomGame")
      .mockResolvedValue({ partyId: "p1" });
    const startCustom = vi
      .spyOn(PartyService.prototype, "startCustomGame")
      .mockResolvedValue({} as never);

    const valBalance = vi
      .spyOn(PartyService.prototype, "validateBalanceTeams")
      .mockResolvedValue({ partyId: "p1" });
    const balance = vi.spyOn(PartyService.prototype, "balanceTeams").mockResolvedValue({} as never);

    const valDefault = vi
      .spyOn(PartyService.prototype, "validateMakeDefault")
      .mockResolvedValue({ partyId: "p1", queue: "competitive" });
    const makeDefault = vi
      .spyOn(PartyService.prototype, "makeDefault")
      .mockResolvedValue({} as never);

    const valServers = vi
      .spyOn(PartyService.prototype, "validateSetPreferredServers")
      .mockResolvedValue({ partyId: "p1", gamePodIds: ["pdx"] });
    const servers = vi
      .spyOn(PartyService.prototype, "setPreferredServers")
      .mockResolvedValue({} as never);

    const valMod = vi
      .spyOn(PartyService.prototype, "validateSetModerator")
      .mockResolvedValue({ partyId: "p1", puuid: "puuid-1", isModerator: true });
    const mod = vi.spyOn(PartyService.prototype, "setModerator").mockResolvedValue({} as never);

    const valRefresh = vi
      .spyOn(PartyService.prototype, "validateRefresh")
      .mockResolvedValue({ method: "POST", paths: [] });
    const refresh = vi.spyOn(PartyService.prototype, "refresh").mockResolvedValue({} as never);

    // Settings & Local
    const clientSpy = vi.spyOn(AccountService.prototype, "client").mockResolvedValue({} as never);
    const settingsSpy = vi
      .spyOn(AccountService.prototype, "settings")
      .mockResolvedValue({ raw: { key: "val" } } as never);
    const valSaveSettings = vi
      .spyOn(AccountService.prototype, "validateSaveSettings")
      .mockResolvedValue({ type: "Ares.PlayerSettings", data: {} });
    const saveSettings = vi
      .spyOn(AccountService.prototype, "saveSettings")
      .mockResolvedValue({} as never);
    const participantsSpy = vi.spyOn(SocialService.prototype, "participants").mockResolvedValue([]);

    const sampleJson = path.join(import.meta.dirname, "fixtures", "catalogue.json");

    try {
      // agent-select
      expect(await runCli(["agent-select", "Jett"])).toBe(0);
      expect(valSelect).toHaveBeenCalledWith("Jett");
      expect(select).not.toHaveBeenCalled();

      expect(await runCli(["agent-select", "Jett", "--yes"])).toBe(0);
      expect(select).toHaveBeenCalledWith("Jett");

      // agent-lock
      expect(await runCli(["agent-lock", "Jett"])).toBe(0);
      expect(valLock).toHaveBeenCalledWith("Jett");
      expect(lock).not.toHaveBeenCalled();

      expect(await runCli(["agent-lock", "Jett", "--yes"])).toBe(0);
      expect(lock).toHaveBeenCalledWith("Jett");

      // dodge
      expect(await runCli(["dodge"])).toBe(0);
      expect(valDodge).toHaveBeenCalled();
      expect(dodge).not.toHaveBeenCalled();
      expect(await runCli(["dodge", "--yes"])).toBe(6); // requires --confirm
      expect(await runCli(["dodge", "--yes", "--confirm"])).toBe(0);
      expect(dodge).toHaveBeenCalledWith({ confirm: true });

      // leave-match
      expect(await runCli(["leave-match"])).toBe(0);
      expect(valLeaveMatch).toHaveBeenCalled();
      expect(leaveMatch).not.toHaveBeenCalled();
      expect(await runCli(["leave-match", "--yes"])).toBe(6); // requires --confirm
      expect(await runCli(["leave-match", "--yes", "--confirm"])).toBe(0);
      expect(leaveMatch).toHaveBeenCalledWith({ confirm: true });

      // party-join by partyId
      expect(await runCli(["party-join", "12345678-1234-1234-1234-123456789abc"])).toBe(0);
      expect(valJoinParty).toHaveBeenCalledWith("12345678-1234-1234-1234-123456789abc");
      expect(joinParty).not.toHaveBeenCalled();

      expect(await runCli(["party-join", "12345678-1234-1234-1234-123456789abc", "--yes"])).toBe(0);
      expect(joinParty).toHaveBeenCalledWith("12345678-1234-1234-1234-123456789abc");

      // party-invites & party-requests
      expect(await runCli(["party-invites"])).toBe(0);
      expect(invitesSpy).toHaveBeenCalledTimes(1);
      expect(await runCli(["party-requests"])).toBe(0);
      expect(requestsSpy).toHaveBeenCalledTimes(1);

      // party-decline-invite
      expect(await runCli(["party-decline-invite", "inv-1"])).toBe(0);
      expect(valDeclineInv).toHaveBeenCalledWith("inv-1");
      expect(declineInv).not.toHaveBeenCalled();
      expect(await runCli(["party-decline-invite", "inv-1", "--yes"])).toBe(0);
      expect(declineInv).toHaveBeenCalledWith("inv-1");

      // party-request
      expect(await runCli(["party-request", "p1"])).toBe(0);
      expect(valReqJoin).toHaveBeenCalledWith("p1");
      expect(reqJoin).not.toHaveBeenCalled();
      expect(await runCli(["party-request", "p1", "--yes"])).toBe(0);
      expect(reqJoin).toHaveBeenCalledWith("p1");

      // party-decline-request
      expect(await runCli(["party-decline-request", "req-1"])).toBe(0);
      expect(valDeclineReq).toHaveBeenCalledWith("req-1");
      expect(declineReq).not.toHaveBeenCalled();
      expect(await runCli(["party-decline-request", "req-1", "--yes"])).toBe(0);
      expect(declineReq).toHaveBeenCalledWith("req-1");

      // custom-game
      expect(await runCli(["custom-game"])).toBe(0);
      expect(valCustom).toHaveBeenCalledTimes(1);
      expect(custom).not.toHaveBeenCalled();
      expect(await runCli(["custom-game", "--yes"])).toBe(0);
      expect(custom).toHaveBeenCalledTimes(1);

      // custom-game-settings
      expect(
        await runCli([
          "custom-game-settings",
          "--map",
          "Ascent",
          "--mode",
          "Standard",
          "--server",
          "pdx",
          "--rule",
          "AllowGameModifiers=true",
        ]),
      ).toBe(0);
      expect(valCustomSetts).toHaveBeenCalledTimes(1);
      expect(customSetts).not.toHaveBeenCalled();

      expect(
        await runCli(["custom-game-settings", "--map", "Ascent", "--mode", "Standard", "--yes"]),
      ).toBe(0);
      expect(customSetts).toHaveBeenCalledTimes(1);

      // custom-game-team
      expect(await runCli(["custom-game-team", "puuid-1", "TeamOne"])).toBe(0);
      expect(valSetTeam).toHaveBeenCalledWith("puuid-1", "TeamOne");
      expect(setTeam).not.toHaveBeenCalled();
      expect(await runCli(["custom-game-team", "puuid-1", "TeamOne", "--yes"])).toBe(0);
      expect(setTeam).toHaveBeenCalledWith("puuid-1", "TeamOne");

      // custom-game-start
      expect(await runCli(["custom-game-start"])).toBe(0);
      expect(valStartCustom).toHaveBeenCalledTimes(1);
      expect(startCustom).not.toHaveBeenCalled();
      expect(await runCli(["custom-game-start", "--yes"])).toBe(0);
      expect(startCustom).toHaveBeenCalledTimes(1);

      // custom-game-balance
      expect(await runCli(["custom-game-balance"])).toBe(0);
      expect(valBalance).toHaveBeenCalledTimes(1);
      expect(balance).not.toHaveBeenCalled();
      expect(await runCli(["custom-game-balance", "--yes"])).toBe(0);
      expect(balance).toHaveBeenCalledTimes(1);

      // party-default
      expect(await runCli(["party-default", "competitive"])).toBe(0);
      expect(valDefault).toHaveBeenCalledWith("competitive");
      expect(makeDefault).not.toHaveBeenCalled();
      expect(await runCli(["party-default", "competitive", "--yes"])).toBe(0);
      expect(makeDefault).toHaveBeenCalledWith("competitive");

      // party-servers
      expect(await runCli(["party-servers", "pdx,sjc"])).toBe(0);
      expect(valServers).toHaveBeenCalledWith(["pdx", "sjc"]);
      expect(servers).not.toHaveBeenCalled();
      expect(await runCli(["party-servers", "pdx,sjc", "--yes"])).toBe(0);
      expect(servers).toHaveBeenCalledWith(["pdx", "sjc"]);

      // party-moderator
      expect(await runCli(["party-moderator", "puuid-1", "on"])).toBe(0);
      expect(valMod).toHaveBeenCalledWith("puuid-1", true);
      expect(mod).not.toHaveBeenCalled();
      expect(await runCli(["party-moderator", "puuid-1", "off", "--yes"])).toBe(0);
      expect(mod).toHaveBeenCalledWith("puuid-1", false);

      // party-refresh
      expect(await runCli(["party-refresh"])).toBe(0);
      expect(valRefresh).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
      expect(await runCli(["party-refresh", "--yes"])).toBe(0);
      expect(refresh).toHaveBeenCalledTimes(1);

      // settings & settings-save
      expect(await runCli(["settings"])).toBe(0);
      expect(settingsSpy).toHaveBeenCalledTimes(1);
      expect(await runCli(["settings", "--raw"])).toBe(0);

      expect(await runCli(["settings-save", sampleJson])).toBe(0);
      expect(valSaveSettings).toHaveBeenCalledTimes(1);
      expect(saveSettings).not.toHaveBeenCalled();
      expect(await runCli(["settings-save", sampleJson, "--yes"])).toBe(6); // requires --confirm
      expect(await runCli(["settings-save", sampleJson, "--yes", "--confirm"])).toBe(0);
      expect(saveSettings).toHaveBeenCalledTimes(1);

      // client & participants
      expect(await runCli(["client"])).toBe(0);
      expect(clientSpy).toHaveBeenCalledTimes(1);
      expect(await runCli(["participants"])).toBe(0);
      expect(participantsSpy).toHaveBeenCalledTimes(1);

      // local & riot raw escape hatches
      const localGet = vi.fn().mockResolvedValue({ status: "local-ok" });
      vi.spyOn(SessionManager.prototype, "localApi").mockReturnValue({ get: localGet } as never);
      expect(await runCli(["local", "get", "/riotclient/region-locale"])).toBe(0);
      expect(localGet).toHaveBeenCalledWith("/riotclient/region-locale");

      const sessionSpy = vi.spyOn(SessionManager.prototype, "session").mockResolvedValue({
        headers: () => ({ Authorization: "Bearer test" }),
      } as never);
      const riotGet = vi
        .spyOn(HttpGateway.prototype, "get")
        .mockResolvedValue({ status: "riot-ok" } as never);
      expect(await runCli(["riot", "get", "https://pd.na.a.pvp.net/endpoint"])).toBe(0);
      expect(riotGet).toHaveBeenCalled();
      expect(sessionSpy).toHaveBeenCalled();
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("handles official CLI commands without lockfile and with key validation", async () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const originalEnv = process.env.RIOT_API_KEY;
    delete process.env.RIOT_API_KEY;

    let stdoutOutput = "";
    let stderrOutput = "";
    process.stdout.write = vi.fn().mockImplementation((chunk: string) => {
      stdoutOutput += chunk;
      return true;
    });
    process.stderr.write = vi.fn().mockImplementation((chunk: string) => {
      stderrOutput += chunk;
      return true;
    });

    try {
      // 1. Missing key exits 7 and prints JSON error
      const missingKeyExit = await runCli(["official", "account", "Jett#NA1"]);
      expect(missingKeyExit).toBe(7);
      expect(stderrOutput).toContain("OFFICIAL_API_KEY_MISSING");

      // 2. With key, official account succeeds and prints account JSON
      const mockGet = vi
        .spyOn(HttpGateway.prototype, "get")
        .mockImplementation(async (url: string) => {
          if (url.includes("/accounts/by-riot-id/")) {
            return { puuid: "puuid-123", gameName: "Jett", tagLine: "NA1" };
          }
          if (url.includes("/active-shards/")) {
            return { puuid: "puuid-123", game: "val", activeShard: "na" };
          }
          return {};
        });

      stdoutOutput = "";
      const successExit = await runCli([
        "official",
        "account",
        "Jett#NA1",
        "--api-key",
        "rgapi-fake-key",
      ]);
      expect(successExit).toBe(0);
      const parsed = JSON.parse(stdoutOutput);
      expect(parsed).toEqual({
        puuid: "puuid-123",
        gameName: "Jett",
        tagLine: "NA1",
        shard: "na",
      });

      // 3. Status command
      mockGet.mockResolvedValueOnce({
        id: "na",
        name: "North America",
        maintenances: [],
        incidents: [],
      });
      const statusExit = await runCli([
        "official",
        "status",
        "--shard",
        "na",
        "--api-key",
        "rgapi-fake-key",
      ]);
      expect(statusExit).toBe(0);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      process.env.RIOT_API_KEY = originalEnv;
      vi.restoreAllMocks();
    }
  });

  it("prints official profile model using fake gateway", async () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;

    let stdoutOutput = "";
    process.stdout.write = vi.fn().mockImplementation((chunk: string) => {
      stdoutOutput += chunk;
      return true;
    });
    process.stderr.write = vi.fn().mockReturnValue(true);

    const mockGet = vi
      .spyOn(HttpGateway.prototype, "get")
      .mockImplementation(async (url: string) => {
        if (url.includes("/accounts/by-riot-id/")) {
          return { puuid: "puuid-scout", gameName: "TenZ", tagLine: "SEN" };
        }
        if (url.includes("/active-shards/")) {
          return { puuid: "puuid-scout", game: "val", activeShard: "na" };
        }
        if (url.includes("/matchlists/by-puuid/")) {
          return {
            puuid: "puuid-scout",
            history: [
              {
                matchId: "comp-match-1",
                gameStartTimeMillis: 1700000000000,
                queueId: "competitive",
              },
            ],
          };
        }
        if (url.includes("/matches/comp-match-1")) {
          return {
            matchInfo: {
              matchId: "comp-match-1",
              mapId: "/Game/Maps/Ascent/Ascent",
              gameLengthMillis: 5000,
              gameStartMillis: 1700000000000,
              isCompleted: true,
              queueId: "competitive",
              isRanked: true,
            },
            players: [
              {
                puuid: "puuid-scout",
                gameName: "TenZ",
                tagLine: "SEN",
                teamId: "Blue",
                characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
                competitiveTier: 27,
                accountLevel: 350,
                stats: { score: 300, roundsPlayed: 20, kills: 25, deaths: 10, assists: 5 },
              },
            ],
            teams: [{ teamId: "Blue", won: true, roundsPlayed: 20, roundsWon: 13 }],
            roundResults: [],
          };
        }
        return {};
      });

    const catalogueData = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
    );
    const catalogueSpy = vi
      .spyOn(ValorantApi.prototype, "getCatalogue")
      .mockResolvedValue(new Catalogue(catalogueData));

    try {
      const exitCode = await runCli([
        "official",
        "profile",
        "TenZ#SEN",
        "--api-key",
        "rgapi-fake-key",
        "--no-official-cache",
      ]);
      expect(exitCode).toBe(0);
      const profile = JSON.parse(stdoutOutput);
      expect(profile.account).toEqual({
        puuid: "puuid-scout",
        gameName: "TenZ",
        tagLine: "SEN",
        shard: "na",
      });
      expect(profile.accountLevel).toBe(350);
      expect(profile.rank.tier).toBe(27);
      expect(profile.lastPlayedAt).toBe(new Date(1700000000000).toISOString());
      expect(profile.summary.overall.games).toBe(1);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      mockGet.mockRestore();
      catalogueSpy.mockRestore();
    }
  });

  it("prints official summary model using fake gateway", async () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;

    let stdoutOutput = "";
    process.stdout.write = vi.fn().mockImplementation((chunk: string) => {
      stdoutOutput += chunk;
      return true;
    });
    process.stderr.write = vi.fn().mockReturnValue(true);

    const mockGet = vi
      .spyOn(HttpGateway.prototype, "get")
      .mockImplementation(async (url: string) => {
        if (url.includes("/accounts/by-riot-id/")) {
          return { puuid: "puuid-scout", gameName: "TenZ", tagLine: "SEN" };
        }
        if (url.includes("/active-shards/")) {
          return { puuid: "puuid-scout", game: "val", activeShard: "na" };
        }
        if (url.includes("/matchlists/by-puuid/")) {
          return {
            puuid: "puuid-scout",
            history: [
              {
                matchId: "comp-match-1",
                gameStartTimeMillis: 1700000000000,
                queueId: "competitive",
              },
            ],
          };
        }
        if (url.includes("/matches/comp-match-1")) {
          return {
            matchInfo: {
              matchId: "comp-match-1",
              mapId: "/Game/Maps/Ascent/Ascent",
              gameLengthMillis: 5000,
              gameStartMillis: 1700000000000,
              isCompleted: true,
              queueId: "competitive",
              isRanked: true,
            },
            players: [
              {
                puuid: "puuid-scout",
                gameName: "TenZ",
                tagLine: "SEN",
                teamId: "Blue",
                characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
                stats: { score: 300, roundsPlayed: 20, kills: 25, deaths: 10, assists: 5 },
              },
            ],
            teams: [{ teamId: "Blue", won: true, roundsPlayed: 20, roundsWon: 13 }],
            roundResults: [],
          };
        }
        return {};
      });

    const catalogueData = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
    );
    const catalogueSpy = vi
      .spyOn(ValorantApi.prototype, "getCatalogue")
      .mockResolvedValue(new Catalogue(catalogueData));

    try {
      const exitCode = await runCli([
        "official",
        "summary",
        "TenZ#SEN",
        "--queue",
        "competitive",
        "--count",
        "5",
        "--api-key",
        "rgapi-fake-key",
      ]);
      expect(exitCode).toBe(0);
      const summary = JSON.parse(stdoutOutput);
      expect(summary.overall.games).toBe(1);
      expect(summary.overall.wins).toBe(1);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      mockGet.mockRestore();
      catalogueSpy.mockRestore();
    }
  });

  describe("CLI wishlist and watch store commands", () => {
    it("dispatches wishlist, wishlist add, wishlist remove, and wishlist check", async () => {
      const originalStdout = process.stdout.write;
      process.stdout.write = vi.fn();

      const wishlistSpy = vi
        .spyOn(StoreService.prototype, "wishlist")
        .mockResolvedValue({ skins: [] });
      const addSpy = vi
        .spyOn(StoreService.prototype, "wishlistAdd")
        .mockResolvedValue({ skins: [{ uuid: "s1", name: "Prime Vandal", addedAt: "now" }] });
      const removeSpy = vi
        .spyOn(StoreService.prototype, "wishlistRemove")
        .mockResolvedValue({ skins: [] });
      const checkSpy = vi
        .spyOn(StoreService.prototype, "wishlistCheck")
        .mockResolvedValue({ checkedAt: "now", hits: [] });

      try {
        expect(await runCli(["wishlist"])).toBe(0);
        expect(wishlistSpy).toHaveBeenCalledTimes(1);

        expect(await runCli(["wishlist", "add", "Prime Vandal"])).toBe(0);
        expect(addSpy).toHaveBeenCalledWith("Prime Vandal");

        expect(await runCli(["wishlist", "remove", "Prime Vandal"])).toBe(0);
        expect(removeSpy).toHaveBeenCalledWith("Prime Vandal");

        expect(await runCli(["wishlist", "check"])).toBe(0);
        expect(checkSpy).toHaveBeenCalledTimes(1);
      } finally {
        process.stdout.write = originalStdout;
        wishlistSpy.mockRestore();
        addSpy.mockRestore();
        removeSpy.mockRestore();
        checkSpy.mockRestore();
      }
    });

    it("rejects unknown wishlist action", async () => {
      const originalStderr = process.stderr.write;
      process.stderr.write = vi.fn();
      try {
        const exitCode = await runCli(["wishlist", "bogus"]);
        expect(exitCode).toBe(6);
      } finally {
        process.stderr.write = originalStderr;
      }
    });

    it("streams NDJSON lines from store watcher in runWatchStore", async () => {
      let output = "";
      const originalStdout = process.stdout.write;
      process.stdout.write = vi.fn().mockImplementation((chunk: string | Uint8Array) => {
        output += String(chunk);
        return true;
      });

      const mockWatcher = {
        stop: vi.fn(),
        async *[Symbol.asyncIterator]() {
          yield { event: "hit", at: "now", data: { skin: { name: "Prime Vandal" } } };
        },
      };

      const mockClient = {
        watch: {
          store: vi.fn().mockReturnValue(mockWatcher),
        },
        close: vi.fn(),
      } as unknown as RiotClient;

      try {
        const exitCode = await runWatchStore(mockClient, { intervalMinutes: 10 });
        expect(exitCode).toBe(0);
        expect(mockClient.watch.store).toHaveBeenCalledWith({
          webhook: undefined,
          intervalMs: 600000,
        });
        expect(output).toContain('"Prime Vandal"');
        expect(mockWatcher.stop).toHaveBeenCalled();
        expect(mockClient.close).toHaveBeenCalled();
      } finally {
        process.stdout.write = originalStdout;
      }
    });
  });

  describe("double-click mode and dashboard launcher", () => {
    it("documents dashboard command in USAGE", () => {
      expect(USAGE).toContain("dashboard");
    });

    it("makes double-click decision correctly", () => {
      expect(shouldLaunchDashboard({ argsLength: 0, isSea: true })).toBe(true);
      expect(shouldLaunchDashboard({ argsLength: 0, isSea: false })).toBe(false);
      expect(shouldLaunchDashboard({ argsLength: 1, isSea: true })).toBe(false);
      expect(shouldLaunchDashboard({ argsLength: 2, isSea: false })).toBe(false);
    });

    it("falls back to the next free port when startPort is busy", async () => {
      const busyPort = 48820;
      const blocker = http.createServer();
      await new Promise<void>((resolve) => blocker.listen(busyPort, "127.0.0.1", () => resolve()));

      try {
        const mockClient = {
          serve: vi.fn().mockImplementation(async (opts: { port: number }) => {
            if (opts.port === busyPort) {
              const err = new Error("address already in use") as Error & { code?: string };
              err.code = "EADDRINUSE";
              throw err;
            }
            return {
              port: opts.port,
              host: "127.0.0.1",
              url: `http://127.0.0.1:${opts.port}`,
              server: blocker,
              close: vi.fn(),
            };
          }),
        } as unknown as RiotClient;

        const instance = await startDashboardServer(mockClient, busyPort, 5);
        expect(instance.port).toBe(busyPort + 1);
        expect(instance.url).toBe(`http://127.0.0.1:${busyPort + 1}`);
        expect(mockClient.serve).toHaveBeenCalledTimes(2);
      } finally {
        await new Promise<void>((resolve) => blocker.close(() => resolve()));
      }
    });
  });
});

