import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ChatApi, HttpGateway, RiotApi, SessionManager, ValorantApi } from "../dist/raw.js";

const outDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "test",
  "fixtures",
  "recorded",
);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NAME_KEYS = new Set(["gameName", "GameName", "game_name", "name"]);
const TAG_KEYS = new Set(["tagLine", "TagLine", "game_tag"]);
const TEXT_KEYS = new Set(["body", "note", "msg", "summary"]);

class Anonymizer {
  ids = new Map();
  names = new Map();

  constructor(playerIds, matchIds) {
    for (const id of [...playerIds, ...matchIds]) this.fakeId(id);
  }

  fakeId(id) {
    const key = id.toLowerCase();
    if (!this.ids.has(key)) {
      this.ids.set(key, `00000000-0000-4000-8000-${String(this.ids.size + 1).padStart(12, "0")}`);
    }
    return this.ids.get(key);
  }

  fakeName(value) {
    if (!this.names.has(value)) this.names.set(value, `Player${this.names.size + 1}`);
    return this.names.get(value);
  }

  text(value) {
    return value.replace(UUID, (match) => this.ids.get(match.toLowerCase()) ?? match);
  }

  walk(value, key = "") {
    if (Array.isArray(value)) return value.map((item) => this.walk(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          this.text(k),
          k === "private" && value.product !== "valorant" ? "" : this.walk(v, k),
        ]),
      );
    }
    if (typeof value !== "string") return value;
    if (NAME_KEYS.has(key) && value && !UUID.test(value)) return this.fakeName(value);
    if (TAG_KEYS.has(key) && value) return "TAG";
    if (TEXT_KEYS.has(key)) return value ? "redacted" : value;
    return this.text(value);
  }
}

function playerIdsIn(...payloads) {
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (
          ["puuid", "Subject", "subject", "killer", "victim", "RequestedBy"].includes(k) &&
          typeof v === "string"
        )
          ids.add(v);
        else visit(v);
      }
    }
  };
  payloads.forEach(visit);
  return ids;
}

async function attempt(name, fetcher) {
  try {
    return { name, raw: await fetcher() };
  } catch (error) {
    console.error(`skip ${name}: ${error.message}`);
    return null;
  }
}

async function main() {
  const gateway = new HttpGateway();
  const sessions = new SessionManager({ valorantApi: new ValorantApi(gateway) });
  const session = await sessions.session();
  const riot = new RiotApi(gateway, session);
  const chat = new ChatApi(sessions.localApi());
  const history = await riot.matchHistory(0, 5);
  const firstMatch = history.History?.[0]?.MatchID;

  const recorded = (
    await Promise.all([
      attempt("entitlements", () => riot.entitlements()),
      attempt("loadout", () => riot.loadout()),
      attempt("accountXp", () => riot.accountXp()),
      attempt("wallet", () => riot.wallet()),
      attempt("storefront", () => riot.storefront()),
      attempt("mmr", () => riot.mmr()),
      attempt("competitiveUpdates", () => riot.competitiveUpdates(0, 20)),
      attempt("matchHistory", async () => history),
      attempt("matchDetails", () =>
        firstMatch ? riot.matchDetails(firstMatch) : Promise.reject(new Error("no match")),
      ),
      attempt("names", () => riot.names([session.puuid])),
      attempt("partyPlayer", () => riot.partyPlayer()),
      attempt("chatSession", () => chat.session()),
      attempt("friends", () => chat.friends()),
      attempt("presences", () => chat.presences()),
      attempt("friendRequests", () => chat.friendRequests()),
      attempt("blocked", () => chat.blocked()),
      attempt("conversations", () => chat.conversations()),
      attempt("messages", () => chat.messages()),
    ])
  ).filter(Boolean);

  const raws = recorded.map((entry) => entry.raw);
  const matchIds = [firstMatch, ...(history.History ?? []).map((h) => h.MatchID)].filter(Boolean);
  const anonymizer = new Anonymizer([session.puuid, ...playerIdsIn(...raws)], matchIds);
  fs.mkdirSync(outDir, { recursive: true });
  for (const { name, raw } of recorded) {
    const file = path.join(outDir, `${name}.json`);
    fs.writeFileSync(
      file,
      `${JSON.stringify({ recordedAt: new Date().toISOString(), self: anonymizer.fakeId(session.puuid), raw: anonymizer.walk(raw) }, null, 2)}\n`,
    );
    console.log(`recorded ${name}`);
  }
  await sessions.close();
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);
