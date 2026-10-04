# @valoranchi/riot-client

[![CI](https://github.com/Valoranchi/valoranchi/actions/workflows/ci.yml/badge.svg)](https://github.com/Valoranchi/valoranchi/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@valoranchi/riot-client.svg)](https://www.npmjs.com/package/@valoranchi/riot-client)

A TypeScript library and command-line tool for reading the local signed-in Riot Client session and retrieving player inventory, loadout, wallet balances, friends roster, presence, chat messages, and storefront offers for VALORANT.

Documentation: [https://valoranchi.github.io/valoranchi/](https://valoranchi.github.io/valoranchi/)
Usage by language: [https://valoranchi.github.io/valoranchi/languages/](https://valoranchi.github.io/valoranchi/languages/)
Windows executable with a desktop dashboard: [GitHub releases](https://github.com/Valoranchi/valoranchi/releases)

## Installation

```bash
npm install @valoranchi/riot-client
```

Or run the CLI directly via npx:

```bash
npx @valoranchi/riot-client whoami
```

## Node Usage

Import `RiotClient` and call any of the public view model methods:

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient({ language: "en-US" });

// 1. Get signed-in player identity and region
const player = await client.account.whoami();
console.log(player);

// 2. Get full owned inventory (weapons, skins, chromas, buddies, etc.)
const collection = await client.account.ownedItems({ language: "en-US" });
console.log(collection);

// 3. Get currently equipped loadout
const loadout = await client.account.loadout();
console.log(loadout);

// 4. Get currency balances (VP, Radianite, Kingdom Credits)
const wallet = await client.account.wallet();
console.log(wallet);

// 5. Get friends roster and presence
const friends = await client.social.friends();
console.log(friends);

// 6. Get incoming/outgoing friend requests and blocked players
const requests = await client.social.friendRequests();
const blocked = await client.social.blocked();

// 7. Get conversations and messages
const conversations = await client.social.conversations();
const messages = await client.social.messages();

// 8. Get storefront rotation (daily, night market, bundles, accessories, radianite)
const store = await client.store.current({ language: "en-US" });
console.log(store);

// 9. Get recent match history summaries
const matchSummaries = await client.matches.list({ count: 5, queue: "competitive" });
console.log(matchSummaries);

// 10. Get full match details by match ID
if (matchSummaries.length > 0) {
  const match = await client.matches.get(matchSummaries[0].id);
  console.log(match);
}

// 11. Get competitive MMR breakdown and current rank
const mmr = await client.matches.mmr();
console.log(mmr);

// 12. Get rank change history (competitive rating updates)
const rankChanges = await client.matches.rankHistory({ count: 5 });
console.log(rankChanges);

// 13. Get live match state (pregame agent select, in-game, range, or none)
const live = await client.matches.live({ ranks: true });
console.log(live);

// 14. Get current party details and members
const party = await client.party.current();
console.log(party);

// 15. Progression and account data
const xp = await client.account.xp();
const contracts = await client.account.contracts();
const missions = await client.account.missions();
const penalties = await client.account.penalties();
const favourites = await client.account.favourites();
const session = await client.account.session();
const config = await client.account.config();

// 16. Store catalog and orders
const offers = await client.store.offers();

// 17. Matches for other players & competitive leaderboard
const otherMatches = await client.matches.listFor(puuid, { count: 5 });
const otherMmr = await client.matches.mmrFor(puuid);
const otherRankHistory = await client.matches.rankHistoryFor(puuid);
const leaderboard = await client.matches.leaderboard({ size: 10 });
const content = await client.matches.content();
const premier = await client.matches.premier();

// 18. Matchmaking queues and custom game configs
const queues = await client.party.queues();
const customGameConfigs = await client.party.customGameConfigs();

// 19. Agent select & match actions
await client.matches.selectAgent("Jett");
await client.matches.lockAgent("Jett");
await client.matches.dodge({ confirm: true });
await client.matches.leaveMatch({ confirm: true });

// 20. Party invitations & join requests
const invites = await client.party.invites();
await client.party.join(partyId);
await client.party.declineInvite(inviteId);
const requests = await client.party.requests();
await client.party.requestToJoin(partyId);
await client.party.declineRequest(requestId);

// 21. Custom games & party controls
await client.party.makeCustomGame();
await client.party.setCustomGameSettings({
  map: "Ascent",
  mode: "Standard",
  server: "pdx",
  rules: { AllowGameModifiers: true },
});
await client.party.setTeam(puuid, "TeamOne");
await client.party.startCustomGame();
await client.party.balanceTeams();
await client.party.makeDefault("competitive");
await client.party.setPreferredServers(["pdx", "sjc"]);
await client.party.setModerator(puuid, true);
await client.party.refresh();

// 22. Cloud Player Settings & Local API
const clientInfo = await client.account.client();
const participants = await client.social.participants();
const settings = await client.account.settings();
await client.account.saveSettings(settings, { confirm: true });

// 23. Raw escape hatches (unsupported surface)
const rawLocal = await client.local.get("/riotclient/region-locale");
const rawRiot = await client.riot.get("https://pd.na.a.pvp.net/account-xp/v1/players/" + puuid);

// Close the local loopback client agent when finished
await client.close();
```

## Official Riot Developer API

`@valoranchi/riot-client` also supports Riot Games' official remote developer API (`*.api.riotgames.com`) through `client.official` and the CLI `riotclient official ...` commands. It runs without the Riot Client or VALORANT running on the host machine, using an official API key from [developer.riotgames.com](https://developer.riotgames.com/) (configured via `officialApiKey` or `RIOT_API_KEY` environment variable). The namespace exposes `account(riotId)` for resolving player PUUIDs and active shards, `matches(riotId)` for retrieving match histories, `match(id, { shard })` for detailed match inspection, `leaderboard({ shard })`, and `status(shard)` for platform incidents, complete with automatic sliding-window rate limiting and retry handling.

## Migrating from 0.1

In 0.2.0, every method moved under its namespace (`account`, `social`, `store`, `matches`, `party`).

Five methods were also renamed:

- `client.store()` → `client.store.current()`
- `client.matches()` → `client.matches.list()`
- `client.match(id)` → `client.matches.get(id)`
- `client.liveMatch()` → `client.matches.live()`
- `client.party()` → `client.party.current()`

`client.events()` and `client.close()` remain on the root client.

## Real-Time Events

Subscribe to live events emitted by the local Riot Client WebSocket: friend presence updates, friend requests, roster changes, chat messages, party changes, and game transitions (agent select, match start).

Events come from the local Riot Client loopback connection only and carry no authentication tokens.

### Node Example

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();
const events = client.events();

events.on("connected", () => console.log("Connected to Riot Client"));
events.on("disconnected", () => console.log("Disconnected"));

events.on("friend:presence", ({ friend, change }) => {
  console.log(`Friend ${friend.gameName} is now ${change} (${friend.presence.state})`);
});

events.on("message", (msg) => {
  console.log(`[${msg.from.gameName}]: ${msg.body}`);
});

events.on("game", ({ phase, matchId }) => {
  console.log(`Game phase: ${phase} (match ${matchId})`);
});

// Stop listening and close the local socket when finished
await client.close();
```

### CLI Command

Stream live events formatted as one JSON object per line until interrupted:

```bash
riotclient watch
riotclient watch --only friend:presence,message,game
riotclient watch --raw
```

## CLI Usage

The package includes the `riotclient` binary.

```bash
riotclient whoami
riotclient owned-items --language en-US --pretty
riotclient loadout
riotclient wallet
riotclient xp
riotclient contracts
riotclient missions
riotclient penalties
riotclient favourites
riotclient session
riotclient config
riotclient friends
riotclient friend-requests
riotclient blocked
riotclient conversations
riotclient messages --cid <conversation-id>
riotclient store --pretty
riotclient offers
riotclient order <order-id>
riotclient matches --count 5
riotclient match <match-id>
riotclient matches-for <puuid>
riotclient mmr --pretty
riotclient mmr-for <puuid>
riotclient rank-history --count 5
riotclient rank-history-for <puuid>
riotclient leaderboard --size 10
riotclient content
riotclient premier
riotclient party
riotclient queues
riotclient custom-game-configs
riotclient watch
```

Example trimmed output from `riotclient whoami --pretty`:

```json
{
  "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
  "gameName": "Player",
  "tagLine": "NA1",
  "region": "na",
  "shard": "na",
  "accountLevel": 128
}
```

Example trimmed output from `riotclient live --ranks --pretty`:

```json
{
  "phase": "ingame",
  "matchId": "c9284241-1234-5678-9abc-def012345678",
  "queue": "competitive",
  "ranked": true,
  "map": {
    "uuid": "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
    "name": "Ascent",
    "path": "/Game/Maps/Ascent/Ascent"
  },
  "mode": "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
  "phaseEndsInMs": null,
  "allies": [
    {
      "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
      "gameName": "Player",
      "tagLine": "NA1",
      "incognito": false,
      "team": "Blue",
      "agent": {
        "uuid": "add6443a-41bd-e414-f6ad-e58d267f4e95",
        "name": "Jett",
        "icon": "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png",
        "role": "Duelist"
      },
      "selection": "locked",
      "accountLevel": 128,
      "rank": {
        "tier": 17,
        "name": "Diamond 3",
        "division": "3",
        "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/17/largeicon.png",
        "rating": 45
      }
    }
  ],
  "enemies": [],
  "self": {
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "Player",
    "tagLine": "NA1",
    "incognito": false,
    "team": "Blue",
    "agent": {
      "uuid": "add6443a-41bd-e414-f6ad-e58d267f4e95",
      "name": "Jett",
      "icon": "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png",
      "role": "Duelist"
    },
    "selection": "locked",
    "accountLevel": 128,
    "rank": {
      "tier": 17,
      "name": "Diamond 3",
      "division": "3",
      "icon": "https://media.valorant-api.com/competitivetiers/03621f52-4cd8-5e5e-4318-00a25e1144cd/17/largeicon.png",
      "rating": 45
    }
  }
}
```

Example trimmed output from `riotclient store --pretty`:

```json
{
  "player": {
    "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
    "gameName": "Player",
    "tagLine": "NA1",
    "region": "na",
    "shard": "na",
    "accountLevel": 128
  },
  "fetchedAt": "2026-09-27T12:00:00.000Z",
  "daily": {
    "endsAt": "2026-09-28T00:00:00.000Z",
    "offers": [
      {
        "offerId": "4324a482-47da-4521-b3b0-4dbfcfefd779",
        "item": {
          "kind": "skin",
          "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
          "name": "Prime Vandal",
          "weapon": "Vandal",
          "tier": {
            "uuid": "e046854e-406c-37f4-6607-19a9ba8426fc",
            "name": "Exclusive",
            "rank": 5,
            "icon": "https://media.valorant-api.com/contenttiers/exclusive.png"
          },
          "icon": "https://media.valorant-api.com/weaponskinlevels/7209796e-4f76-88c9-04fa-fb81498b5e9d/displayicon.png",
          "levelUuid": "7209796e-4f76-88c9-04fa-fb81498b5e9d"
        },
        "cost": {
          "currency": "Valorant Points",
          "currencyUuid": "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
          "amount": 1775
        }
      }
    ]
  },
  "nightMarket": null,
  "bundles": {
    "endsAt": "2026-10-05T00:00:00.000Z",
    "items": []
  },
  "accessories": null,
  "radianite": []
}
```

CLI exit codes:

- `0`: Success (JSON written to stdout)
- `2`: Riot Client is not running (`RIOT_CLIENT_NOT_RUNNING`)
- `3`: Riot Client is not ready yet (`RIOT_CLIENT_NOT_READY`)
- `4`: Region could not be resolved (`REGION_UNKNOWN`)
- `5`: Remote Riot API request failed (`RIOT_API_ERROR`)
- `6`: Local validation failed (`VALIDATION`)
- `1`: Unexpected failure

On failure, error information is formatted as `{ "error": { "code": string, "message": string, "reason"?: string, "details"?: object } }` and output to stderr.

## Writes

All writes are validated locally against your inventory and catalogue before any network request reaches Riot. If an item is not owned, an instance is exhausted, a weapon mismatches, or a social target is invalid, a `ValidationError` is thrown immediately and no network request is sent.

### Available Methods

#### Account Writes

- `client.account.equip(change: LoadoutChange): Promise<Loadout>`: Update equipped skins, skin levels, chromas, buddies, sprays, player card, title, level border, and incognito status.
- `client.account.equipCollection(skinUuids: string[]): Promise<Loadout>`: Equip a list of skin UUIDs (one per weapon) at their highest owned level and base chroma.
- `client.account.activateContract(contractId: string): Promise<ContractProgress[]>`: Activate an agent contract.
- `client.account.addFavourite(skinUuid: string): Promise<Favourite[]>`: Add weapon skin to favourites.
- `client.account.removeFavourite(skinUuid: string): Promise<Favourite[]>`: Remove weapon skin from favourites.
- `client.account.setActRankBadgeHidden(hidden: boolean): Promise<PlayerPrivacy>`: Hide or reveal act rank badge.
- `client.account.setLeaderboardAnonymized(anonymized: boolean): Promise<PlayerPrivacy>`: Anonymize or reveal leaderboard presence.

#### Social Writes

- `client.social.sendMessage(to, text): Promise<Message>`: Send a whisper or room message (target can be `{ puuid }`, `{ conversationId }`, or `{ riotId }`).
- `client.social.sendFriendRequest(riotId): Promise<FriendRequest[]>`: Send a friend request by `Name#Tag`.
- `client.social.acceptFriendRequest(puuid): Promise<Friend[]>`: Accept an incoming friend request.
- `client.social.declineFriendRequest(puuid): Promise<FriendRequest[]>`: Decline an incoming friend request.
- `client.social.cancelFriendRequest(puuid): Promise<FriendRequest[]>`: Cancel an outgoing friend request.
- `client.social.removeFriend(puuid): Promise<Friend[]>`: Remove a friend.
- `client.social.blockPlayer(target): Promise<BlockedPlayer[]>`: Block a player by PUUID or `Name#Tag`.
- `client.social.unblockPlayer(puuid): Promise<BlockedPlayer[]>`: Unblock a player.

> **Note on social player lookup**: Arbitrary player lookup by `Name#Tag` (`social.lookup`) is not supported because Riot's player-data (`pd`) service does not offer an endpoint for resolving Riot IDs without mutual friend presence or match history; this was intentionally omitted.

#### Store Writes

- `client.store.revealNightMarket(): Promise<Storefront>`: Reveal night market offers.
- `client.store.buy(target: { offerId: string } | { bundleId: string }, options: { confirm: boolean }): Promise<Order>`: Purchase a store offer or bundle.

> **WARNING: Purchasing spends real money or in-game currency (VP, Radianite, Kingdom Credits). All purchases require explicit confirmation: `{ confirm: true }` in code, or both `--yes` and `--confirm` in the CLI.**

#### Party Writes

- `client.party.invite(riotId): Promise<Party>`: Invite a player to the party by `Name#Tag`.
- `client.party.kick(puuid): Promise<Party>`: Remove a member from the party (owner only).
- `client.party.promote(puuid): Promise<Party>`: Transfer party ownership to another member.
- `client.party.createInviteCode(): Promise<Party>`: Generate an invite code for the party.
- `client.party.revokeInviteCode(): Promise<Party>`: Revoke the party's current invite code.
- `client.party.joinByCode(code): Promise<Party>`: Join a party using an alphanumeric invite code.
- `client.party.setReady(ready): Promise<Party>`: Set your ready status (`true` or `false`).
- `client.party.setQueue(queue): Promise<Party>`: Change party queue (validated against eligible queues).
- `client.party.setAccessibility(accessibility): Promise<Party>`: Set party accessibility (`"open"` or `"closed"`).
- `client.party.startMatchmaking(): Promise<Party>`: Enter matchmaking queue (requires all members ready and idle party).
- `client.party.stopMatchmaking(): Promise<Party>`: Cancel matchmaking queue.
- `client.party.leave(): Promise<Party>`: Leave your current party.

### Account Validation Rules

- `contract-not-agent`: Thrown when attempting to activate a contract that is not an agent contract (e.g. battlepass, event).
- `agent-owned`: Thrown when activating a contract for an agent that is already unlocked.
- `contract-active`: Thrown when activating a contract that is already active.
- `not-favourite`: Thrown when removing a favourite that is not favorited.
- `already-favourite`: Thrown when adding a favourite that is already favorited.

### Store Validation Rules

- `offer-not-in-store`: Thrown when purchasing an item/bundle not currently available in daily rotation, night market, or featured bundles.
- `already-owned`: Thrown when purchasing an item that is already owned.
- `insufficient-funds`: Thrown when account balance is lower than the offer cost.
- `confirm-required`: Thrown when purchasing without explicit confirmation (`--confirm`).
- `night-market-missing`: Thrown when revealing night market offers when no night market is active.
- `night-market-revealed`: Thrown when all night market offers are already revealed.

### Party Validation Rules

Every party write is validated against the live party state before any request reaches Riot:

- `no-party`: Thrown when outside the client or the player has no active party.
- `not-owner`: Thrown when a non-owner attempts owner-restricted actions (`kick`, `promote`, `set-queue`, `set-accessibility`, `create-invite-code`, `revoke-invite-code`, `start-matchmaking`, `stop-matchmaking`).
- `not-a-member`: Thrown when caller is not in party, or when the kick/promote target is not in the party.
- `self-target`: Thrown when attempting to kick or promote yourself.
- `already-in-party`: Thrown when joining by code for a party the caller already belongs to.
- `queue-not-eligible`: Thrown when selecting a queue not present in `EligibleQueues`.
- `queue-restricted`: Thrown on matchmaking join when party has active queue ineligibilities.
- `party-not-idle`: Thrown when changing queue, inviting, changing accessibility, or joining matchmaking while party state is not `DEFAULT`.
- `not-matchmaking`: Thrown when stopping matchmaking while party state is not `MATCHMAKING`.
- `members-not-ready`: Thrown on matchmaking join when any party member has not set ready.
- `invalid-riot-id`: Thrown when inviting with a malformed `Name#Tag`.
- `invalid-code`: Thrown when invite code is not 6 to 12 alphanumeric characters.
- `invite-code-missing`: Thrown when revoking an invite code but none is active.
- `restricted`: Thrown on matchmaking join when party has active restriction penalty seconds.
- `invite-missing`: Thrown when joining or declining an invite that does not exist in player record.
- `request-missing`: Thrown when declining a join request that is not pending on the party.
- `not-custom-game`: Thrown when setting custom game settings, membership, or starting when party is not in custom game mode.
- `map-not-enabled`: Thrown when setting a custom game map that is not enabled in configs.
- `mode-not-enabled`: Thrown when setting a custom game mode that is not enabled in configs.
- `server-unknown`: Thrown when setting a custom game or preferred server that does not exist in ping info.
- `no-team-players`: Thrown when starting a custom game without any players on TeamOne or TeamTwo.

### Agent Select & Match Validation Rules

- `not-in-pregame`: Thrown when selecting, locking, or dodging while not in pregame agent select.
- `unknown-agent`: Thrown when selecting or locking an agent UUID or name not present or non-playable in catalogue.
- `agent-not-owned`: Thrown when selecting or locking an agent not unlocked and not base content.
- `agent-locked-by-ally`: Thrown when attempting to select or lock an agent already locked by a teammate.
- `already-locked`: Thrown when selecting or locking after having already locked in an agent.
- `confirm-required`: Thrown when executing `dodge`, `leaveMatch`, or `saveSettings` without explicit confirmation.
- `not-in-match`: Thrown when attempting to leave a match while not in an active game.

### Player Settings & Local API Caveats

- `game-not-running`: Thrown when accessing or saving cloud player settings without VALORANT running. The local endpoint requires basic authentication using the `-remoting-auth-token` passed to VALORANT's process launch arguments.
- **Settings synchronization**: VALORANT re-reads settings from Riot's cloud only upon process launch. Writing settings with `account.saveSettings()` updates the cloud copy, but if the in-game Settings menu is opened in a running VALORANT client, the game client will overwrite the cloud copy with its in-memory settings.
- **Own Presence Writes**: Updating own presence (`PUT /chat/v2/me`) is not supported by this client version and is skipped.
- **Raw Escape Hatches**: `client.local` and `client.riot` provide low-level HTTP access (`get`, `post`, `put`, `delete`) to local loopback and remote Riot endpoints respectively. This is provided as an escape hatch for unmodeled routes and is an unsupported surface.

### Dry-Run by Default in CLI

In the CLI, every write command defaults to a **dry run**: it validates the operation locally, outputs the validated body (tokens excluded) as JSON to stdout, and exits 0 without executing any network mutations.

Pass `--yes` to execute the actual write:

```bash
# Dry run: validates locally and prints the PUT body without sending
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2

# Execute the write
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2 --yes

# Store dry run: validates availability, ownership, and funds, printing purchase details
riotclient buy --offer 4324a482-47da-4521-b3b0-4dbfcfefd779

# Execute purchase (requires BOTH --yes and --confirm)
riotclient buy --offer 4324a482-47da-4521-b3b0-4dbfcfefd779 --yes --confirm
```

If validation fails, the command exits with code `6` and writes the validation error to stderr:

```json
{
  "error": {
    "code": "VALIDATION",
    "reason": "card-not-owned",
    "message": "Card is not owned",
    "details": { "card": "00000000-0000-0000-0000-000000000000" }
  }
}
```

## Raw Layer

Consumers that maintain their own domain models or view models can use the library's session handling, transport, raw endpoints, local API, socket, and validators without importing high-level models:

```ts
import {
  FileCatalogueStore,
  HttpGateway,
  MemoryCatalogueCache,
  RiotApi,
  SessionManager,
  ValorantApi,
} from "@valoranchi/riot-client/raw";

const gateway = new HttpGateway();
const valorantApi = new ValorantApi(gateway, new MemoryCatalogueCache(), new FileCatalogueStore());
const sessions = new SessionManager({ valorantApi });

const session = await sessions.session();
const api = new RiotApi(gateway, session);

const loadout = await api.loadout();
console.log(loadout);
```

> **Stability note**: The raw entry follows Riot's shapes and may change with the game.

## From Other Languages

Any runtime can spawn the `riotclient` binary as a child process and parse stdout as JSON. Type definitions can be generated directly from the committed JSON Schemas in `schema/` using tools such as `quicktype`:

```bash
npx quicktype schema/OwnedItems.json -o OwnedItems.cs --namespace Valoranchi
```

Example C# snippet using `System.Diagnostics.Process`:

```csharp
using System;
using System.Diagnostics;
using System.Text.Json;

var startInfo = new ProcessStartInfo
{
    FileName = "riotclient",
    Arguments = "whoami",
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    UseShellExecute = false,
    CreateNoWindow = true,
};

using var process = Process.Start(startInfo);
string output = process.StandardOutput.ReadToEnd();
process.WaitForExit();

if (process.ExitCode == 0)
{
    using var doc = JsonDocument.Parse(output);
    Console.WriteLine($"Player: {doc.RootElement.GetProperty("gameName").GetString()}");
}
```

## Model Context Protocol (MCP) Server

Run an MCP server over stdio for AI assistants (Claude Code, Claude Desktop, Cursor) to inspect your own player data:

```bash
npx @valoranchi/riot-client mcp
```

All MCP tools are strictly read-only by design: assistants can inspect inventory, daily store offers, match history, and party state, but cannot purchase items, modify loadouts, or change settings. See the [MCP Guide](https://valoranchi.github.io/valoranchi/guide/mcp) for configuration snippets.

## How Authentication Works

1. The local Riot Client creates a lockfile at `%LOCALAPPDATA%\Riot Games\Riot Client\Config\lockfile`.
2. The library reads the lockfile port and basic authentication password.
3. Credentials are exchanged with the loopback API over local TLS to obtain entitlements and access tokens.
4. Active region and shard are resolved from product sessions or game logs.
5. The resulting session headers authenticate subsequent requests directly to Riot PVP game servers.

## Catalogue Cache

Names, images, bundles, and tiers come from valorant-api.com. The catalogue for each language is stored on disk, under `%LOCALAPPDATA%\valoranchi-riot-client\catalogue` on Windows and the system temp directory elsewhere, keyed by the game version, so it is downloaded once per patch. Pass `catalogueDir` to `RiotClient` to move it, or `null` to keep it in memory only.

## Response Cache

Riot answers are fetched live by default. To reuse them for a while, pass `responseCache: { ttlMs: 60_000 }` to `RiotClient`, or `--cache 60` to the CLI. Entries are stored per player and endpoint under `%LOCALAPPDATA%\valoranchi-riot-client\responses`, hold only the response body, never a token, and are refetched once older than the TTL. Keep the TTL short: a purchase or a loadout change is invisible until it expires.

Chat data (friends, presence, friend requests, blocked players, conversations, and messages) comes directly from the local Riot Client loopback API and is never cached.

## Token Host Rule

Access tokens and entitlements JWTs are strictly scoped. They may only ever be sent to hosts matching `*.pvp.net`, `*.riotgames.com`, or loopback `127.0.0.1`. The HTTP gateway enforces this policy and throws a `ForbiddenHostError` before sending any request that would transmit credentials to an unauthorized host. Requests to public endpoints such as `valorant-api.com` never carry authorization headers.

## Releasing

`npm run fixtures:record` refreshes the anonymized Riot payloads under `test/fixtures/recorded/` (see the docs).

Releases are published automatically to npm and GitHub Releases via GitHub Actions:

1. Navigate to the **Actions** tab on GitHub and select the **Release** workflow.
2. Click **Run workflow** (dispatch).
3. Select the version bump (`patch`, `minor`, or `major`). You can optionally provide additional release notes.
4. The workflow runs the full verification suite (lint, typecheck, tests, build, JSON schemas, and tarball contents).
5. The `## [Unreleased]` section from `CHANGELOG.md` is automatically converted into the new version entry (`## [X.Y.Z] - YYYY-MM-DD`).
6. `@valoranchi/riot-client` is published to npm with provenance first; only then the version commit and tag (`vX.Y.Z`) are pushed and a GitHub Release is created with the changelog notes. A failed publish leaves the repository untouched.

If a publish failed after the version was already committed (for example the npm token could not reach the scope), fix the cause and run the workflow again: it notices the tagged version is missing from npm and publishes it instead of bumping. The **Publish the version already in package.json** checkbox forces that mode.

The token check at the start of the workflow expects a granular npm token with **Read and write** on all packages of the `@valoranchi` organization. An npm `404` on publish means the scope does not exist for that token: the organization is missing or the token is limited to selected packages.

## What It Does Not Do

- No automated gameplay, bots, or match orchestration
- No background telemetry or credential logging
- No unconfirmed store purchases (all purchases require explicit dual confirmation)

## Disclaimer

This project is an unofficial tool and is not endorsed by, directly affiliated with, maintained, authorized, or sponsored by Riot Games, Inc. VALORANT and all related properties are trademarks or registered trademarks of Riot Games, Inc.
