import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatchesApi } from "../src/client/api.js";
import type { RiotEventMap, RiotEvents } from "../src/events/RiotEvents.js";
import { TypedEmitter } from "../src/events/TypedEmitter.js";
import type { Match } from "../src/model/index.js";
import {
  buildMatchRecap,
  buildMatchRecapDiscord,
  MatchWatcher,
  WebhookNotifier,
} from "../src/watch/index.js";

const sampleMatch: Match = {
  id: "match-123",
  startedAt: "2026-10-08T18:00:00.000Z",
  lengthMs: 2400000,
  completed: true,
  queue: "competitive",
  ranked: true,
  custom: false,
  customName: null,
  map: { uuid: "map-ascent", name: "Ascent", path: "/Game/Maps/Ascent/Ascent" },
  mode: "Bomb",
  season: { uuid: "season-1", name: "EP 9 ACT 2" },
  teams: [
    { id: "Blue", won: true, roundsWon: 13, roundsPlayed: 20 },
    { id: "Red", won: false, roundsWon: 7, roundsPlayed: 20 },
  ],
  players: [
    {
      puuid: "self-puuid",
      gameName: "Player",
      tagLine: "NA1",
      team: "Blue",
      partyId: "p1",
      agent: { uuid: "agent-jett", name: "Jett", icon: null, role: "Duelist" },
      rank: { tier: 20, name: "Diamond 3", division: "3", rating: 50, icon: null },
      accountLevel: 100,
      card: null,
      title: null,
      stats: {
        score: 4600,
        kills: 22,
        deaths: 12,
        assists: 4,
        roundsPlayed: 20,
        headshots: 15,
        bodyshots: 30,
        legshots: 5,
        damage: 3200,
        firstBloods: 4,
        plants: 2,
        defuses: 1,
        abilityCasts: { c: 2, q: 4, e: 10, x: 2 },
      },
    },
    {
      puuid: "enemy-puuid",
      gameName: "Enemy",
      tagLine: "NA1",
      team: "Red",
      partyId: "p2",
      agent: { uuid: "agent-omen", name: "Omen", icon: null, role: "Controller" },
      rank: { tier: 20, name: "Diamond 3", division: "3", rating: 40, icon: null },
      accountLevel: 80,
      card: null,
      title: null,
      stats: {
        score: 2500,
        kills: 12,
        deaths: 15,
        assists: 8,
        roundsPlayed: 20,
        headshots: 8,
        bodyshots: 20,
        legshots: 2,
        damage: 1800,
        firstBloods: 1,
        plants: 1,
        defuses: 0,
        abilityCasts: { c: 5, q: 3, e: 12, x: 1 },
      },
    },
  ],
  rounds: [],
  self: { team: "Blue", won: true },
  replayRecorded: true,
};

describe("MatchRecap builder", () => {
  it("builds Discord embed with victory title and green color", () => {
    const recap = buildMatchRecapDiscord(sampleMatch, {
      rrChange: 24,
      selfPuuid: "self-puuid",
    });

    expect(recap.embeds).toHaveLength(1);
    const embed = recap.embeds[0]!;
    expect(embed.title).toBe("Ascent · Victory 13:7");
    expect(embed.color).toBe(0x2ecc71);

    const kdaField = embed.fields.find((f) => f.name === "K/D/A");
    expect(kdaField?.value).toBe("22/12/4");

    const acsField = embed.fields.find((f) => f.name === "ACS");
    expect(acsField?.value).toBe("230");

    const hsField = embed.fields.find((f) => f.name === "HS%");
    expect(hsField?.value).toBe("30%");

    const agentField = embed.fields.find((f) => f.name === "Agent");
    expect(agentField?.value).toBe("Jett");

    const rrField = embed.fields.find((f) => f.name === "RR Change");
    expect(rrField?.value).toBe("+24");
  });

  it("builds Discord embed with defeat title, red color, and negative RR change", () => {
    const defeatMatch: Match = {
      ...sampleMatch,
      teams: [
        { id: "Blue", won: false, roundsWon: 8, roundsPlayed: 21 },
        { id: "Red", won: true, roundsWon: 13, roundsPlayed: 21 },
      ],
      self: { team: "Blue", won: false },
    };

    const recap = buildMatchRecapDiscord(defeatMatch, {
      rrChange: -18,
      selfPuuid: "self-puuid",
    });

    const embed = recap.embeds[0]!;
    expect(embed.title).toBe("Ascent · Defeat 8:13");
    expect(embed.color).toBe(0xe74c3c);

    const rrField = embed.fields.find((f) => f.name === "RR Change");
    expect(rrField?.value).toBe("-18");
  });

  it("omits RR Change field when not available", () => {
    const recap = buildMatchRecapDiscord(sampleMatch, {
      rrChange: null,
      selfPuuid: "self-puuid",
    });

    const embed = recap.embeds[0]!;
    expect(embed.fields.some((f) => f.name === "RR Change")).toBe(false);
  });

  it("returns Discord payload when isDiscord is true and raw match when false", () => {
    const discordRecap = buildMatchRecap(sampleMatch, true, { rrChange: 15 });
    expect("embeds" in discordRecap).toBe(true);

    const rawRecap = buildMatchRecap(sampleMatch, false);
    expect(rawRecap).toBe(sampleMatch);
  });
});

describe("WebhookNotifier with Match", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts Discord embed to discord webhook url", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchSpy;

    const notifier = new WebhookNotifier("https://discord.com/api/webhooks/123/token");
    await notifier.notify(sampleMatch, (m) => buildMatchRecapDiscord(m, { rrChange: 20 }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://discord.com/api/webhooks/123/token");
    const parsedBody = JSON.parse(init.body as string) as { embeds: Array<{ title: string }> };
    expect(parsedBody.embeds[0]?.title).toBe("Ascent · Victory 13:7");
  });

  it("posts raw match JSON to generic https webhook url", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchSpy;

    const notifier = new WebhookNotifier("https://example.com/api/recap");
    await notifier.notify(sampleMatch, (m) => buildMatchRecapDiscord(m, { rrChange: 20 }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const parsedBody = JSON.parse(init.body as string) as Match;
    expect(parsedBody.id).toBe("match-123");
  });
});

function makeFakeEvents(): RiotEvents {
  const emitter = new TypedEmitter<RiotEventMap>();
  const fake = emitter as unknown as RiotEvents;
  fake.start = vi.fn().mockReturnValue(fake);
  fake.stop = vi.fn();
  return fake;
}

describe("MatchWatcher recap webhook integration", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts recap upon match ended without throwing on fetch error", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("Network offline"));
    globalThis.fetch = fetchSpy;

    const fakeEvents = makeFakeEvents();

    const fakeMatches = {
      live: vi.fn().mockResolvedValue({ phase: "ingame", matchId: "match-123" }),
      get: vi.fn().mockResolvedValue(sampleMatch),
      rankHistory: vi.fn().mockResolvedValue([
        { matchId: "match-123", earned: 22 },
      ]),
    } as unknown as MatchesApi;

    const watcher = new MatchWatcher(fakeEvents, fakeMatches, {
      webhook: "https://discord.com/api/webhooks/123/token",
      pollIntervalMs: 50,
      retryIntervalMs: 50,
    });

    const errors: Error[] = [];
    watcher.on("error", (err) => errors.push(err));

    watcher.start();
    // Simulate ingame
    await fakeEvents.emit("self:state", { state: "ingame", presence: null });
    // Let async transitionToIngame finish
    await new Promise((r) => setTimeout(r, 10));
    // Simulate menus (match ended)
    await fakeEvents.emit("self:state", { state: "menus", presence: null });

    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();

    expect(fetchSpy).toHaveBeenCalled();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]?.message).toContain("Network offline");
  });
});
