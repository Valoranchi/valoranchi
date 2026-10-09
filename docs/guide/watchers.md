# High-Level Watchers

`@valoranchi/riot-client` provides high-level watchers that translate raw socket messages and polling fallbacks into clean, typed lifecycle events for match play and friend activity.

## Match Watcher (`client.watch.match()`)

The match watcher tracks the full lifecycle of a Valorant match through a unified state machine. It listens to `self:state` presence and game relay events while maintaining a 5-second polling floor against `client.matches.live()` during pregame and ingame sessions as a safety net.

### Events Emitted

| Event     | Type / Payload                                   | Description                                                                                                                            |
| :-------- | :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `pregame` | `LiveMatch`                                      | Emitted when entering agent selection in a pregame lobby.                                                                              |
| `locked`  | `LiveMatch`                                      | Emitted once your own agent has been locked in.                                                                                        |
| `started` | `LiveMatch`                                      | Emitted when loading into the match with full player loadouts.                                                                         |
| `round`   | `{ round: number, ally: number, enemy: number }` | Emitted whenever own presence scores change between rounds.                                                                            |
| `ended`   | `Match`                                          | Emitted when the match concludes and full match details are fetched from `matches.get` (retrying every 5 seconds for up to 2 minutes). |
| `left`    | `null`                                           | Emitted if agent selection is dodged or the active match is abandoned.                                                                 |
| `error`   | `Error`                                          | Emitted if an unhandled error occurs during polling or dispatch.                                                                       |

### Usage with Event Listener

```typescript
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();
const match = client.watch.match().start();

match.on("pregame", (live) => {
  console.log(`In agent select for match ${live.matchId} on map ${live.map.name}`);
});

match.on("locked", (live) => {
  console.log(`Agent locked: ${live.self?.agent?.name}`);
});

match.on("round", ({ round, ally, enemy }) => {
  console.log(`Round ${round}: ${ally} - ${enemy}`);
});

match.on("ended", (details) => {
  console.log(
    `Match ${details.id} ended. Score: ${details.teams[0]?.roundsWon} - ${details.teams[1]?.roundsWon}`,
  );
});
```

### Usage with Async Iterator

Each watcher implements `[Symbol.asyncIterator]`, allowing clean event streams with `for await`:

```typescript
for await (const { event, at, data } of client.watch.match()) {
  console.log(`[${at}] ${event}:`, data);
}
```

---

## Friends Watcher (`client.watch.friends()`)

The friends watcher monitors your friends list for presence changes, game activity transitions, direct messages, and incoming friend requests. To avoid event spam when Riot Client sends presence bursts, updates are debounced by 300 ms per player `puuid`.

### Events Emitted

| Event         | Type / Payload                         | Description                                                                                |
| :------------ | :------------------------------------- | :----------------------------------------------------------------------------------------- |
| `online`      | `Friend`                               | Emitted when a friend transitions from offline to online.                                  |
| `offline`     | `Friend`                               | Emitted when a friend goes offline.                                                        |
| `in-game`     | `{ friend: Friend, activity: string }` | Emitted when a friend enters a game or updates their in-game activity (queue, map, score). |
| `out-of-game` | `Friend`                               | Emitted when a friend finishes or leaves a game back to menus/party.                       |
| `message`     | `Message`                              | Emitted when an incoming chat whisper or party message is received.                        |
| `request`     | `FriendRequest`                        | Emitted when a new incoming friend request is created.                                     |
| `error`       | `Error`                                | Emitted if an unhandled error occurs.                                                      |

### Example

```typescript
const friends = client.watch.friends().start();

friends.on("online", (f) => {
  console.log(`${f.gameName}#${f.tagLine} is now online`);
});

friends.on("in-game", ({ friend, activity }) => {
  console.log(`${friend.gameName}#${friend.tagLine} is playing: ${activity}`);
});

friends.on("out-of-game", (f) => {
  console.log(`${f.gameName}#${f.tagLine} finished playing`);
});

friends.on("message", (msg) => {
  console.log(`Message from ${msg.from.gameName}: ${msg.body}`);
});
```

---

## Store Watcher (`client.watch.store()`)

The store watcher monitors your daily storefront, night market, and featured bundle offers for skins on your local wishlist (`client.store.wishlist()`). When a wishlisted skin appears in your shop, it emits a `hit` event and can optionally notify an external webhook (such as a Discord channel).

Hits are deduplicated by rotation window (`<skinUuid>:<where>:<endsAt>`), ensuring repeated checks within the same store rotation do not trigger duplicate notifications.

### Options

| Option            | Type      | Default     | Description                                                                                                              |
| :---------------- | :-------- | :---------- | :----------------------------------------------------------------------------------------------------------------------- |
| `intervalMinutes` | `number`  | `60`        | Polling interval in minutes between rotation checks (minimum 1 minute).                                                  |
| `webhook`         | `string`  | `undefined` | Optional webhook URL (`https:` only) to post hit notifications to.                                                       |
| `discord`         | `boolean` | auto        | Format notification for Discord webhooks (defaults to `true` if webhook URL contains `discord.com` or `discordapp.com`). |

### Events Emitted

| Event   | Type / Payload  | Description                                                                                     |
| :------ | :-------------- | :---------------------------------------------------------------------------------------------- |
| `hit`   | `WishlistHit`   | Emitted whenever a wishlisted skin appears in daily rotation, night market, or featured bundle. |
| `check` | `WishlistCheck` | Emitted on each storefront check, providing current shop offers and any matching hits.          |
| `error` | `Error`         | Emitted if an unhandled error occurs during store inspection or webhook notification dispatch.  |

### Usage with Event Listener

```typescript
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();

// Add skins to wishlist
await client.store.wishlistAdd("Reaver Vandal");
await client.store.wishlistAdd("Prime Karambit");

const watcher = client.watch
  .store({
    intervalMinutes: 30,
    webhook: "https://discord.com/api/webhooks/...",
  })
  .start();

watcher.on("hit", (hit) => {
  console.log(`Wishlist hit! ${hit.skin.name} is in your ${hit.where} for ${hit.price} VP`);
});

watcher.on("check", (check) => {
  console.log(`Checked store at ${check.checkedAt}. Hits: ${check.hits.length}`);
});
```

### Usage with Async Iterator

```typescript
for await (const { event, at, data } of client.watch.store()) {
  if (event === "hit") {
    console.log(`[${at}] Wishlist hit:`, data);
  }
}
```

---

## CLI Streaming Commands

Watchers are exposed directly from the CLI and print newline-delimited JSON (NDJSON):

```bash
# Stream match events
riotclient watch-match

# Stream friend events
riotclient watch-friends

# Stream store wishlist alerts (optionally forwarding to Discord webhook)
riotclient watch store --webhook https://discord.com/api/webhooks/... --interval 30
```

Output format:

```json
{"event":"pregame","at":"2026-09-29T20:00:00.000Z","data":{...}}
{"event":"locked","at":"2026-09-29T20:00:15.000Z","data":{...}}
{"event":"round","at":"2026-09-29T20:05:00.000Z","data":{"round":1,"ally":1,"enemy":0}}
{"event":"hit","at":"2026-10-02T12:00:00.000Z","data":{"skin":{"name":"Reaver Vandal",...},"where":"daily",...}}
```

## Match recap webhook

`client.watch.match({ webhook })` posts a recap every time a match ends: map, result and score, K/D/A, ACS, HS%, agent and the RR change when Riot has published it. A Discord webhook (`https://discord.com/api/webhooks/...`) gets an embed, green on a win and red on a loss; any other `https:` URL gets the `Match` JSON. Failures are emitted as `error` and never stop the watcher.

```bash
riotclient watch match --webhook https://discord.com/api/webhooks/...
```
