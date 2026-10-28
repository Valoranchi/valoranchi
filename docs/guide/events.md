# Real-Time Events

Subscribe to live events emitted by the local Riot Client WebSocket, including friend presence updates, incoming chat messages, roster changes, and match phase transitions.

Events originate exclusively from the local loopback WebSocket connection and carry no authentication secrets.

## Subscribing to Events

Call `client.events()` to obtain a `RiotEvents` instance. The emitter connects to the local Riot Client WebSocket and begins dispatching events:

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();
const events = client.events();

events.on("connected", () => {
  console.log("Connected to Riot Client WebSocket");
});

events.on("disconnected", () => {
  console.log("Disconnected from Riot Client WebSocket");
});

events.on("friend:presence", ({ friend, change }) => {
  console.log(`${friend.gameName} is now ${change} (${friend.presence.state})`);
});

events.on("message", (msg) => {
  console.log(`[${msg.from.gameName}]: ${msg.body}`);
});

events.on("game", ({ phase, matchId }) => {
  console.log(`Game phase entered: ${phase} (match ID: ${matchId})`);
});

// Stop listening and disconnect cleanly
await client.close();
```

## Event Map and Payload Shapes

The library types all event payloads through `RiotEventMap`:

| Event             | Payload Type                                                    | Description                                                      |
| :---------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------- |
| `connected`       | `void`                                                          | Emitted when loopback WebSocket connection opens.                |
| `disconnected`    | `void`                                                          | Emitted when loopback WebSocket connection drops or closes.      |
| `friend:presence` | `{ friend: Friend; change: "update" \| "offline" }`             | Emitted when a friend updates state, queue, map, or party.       |
| `friend:added`    | `Friend`                                                        | Emitted when a new friendship is accepted or added.              |
| `friend:removed`  | `{ puuid: string }`                                             | Emitted when a friend is unfriended.                             |
| `friend:request`  | `{ request: FriendRequest; change: "created" \| "resolved" }`   | Emitted on incoming or outgoing friend request changes.          |
| `message`         | `Message`                                                       | Emitted when receiving whispers or chat room messages.           |
| `conversation`    | `{ cid: string; unreadCount: number }`                          | Emitted per conversation in a chat update with its unread count. |
| `party`           | `{ partyId: string }`                                           | Emitted when active party ID changes or members join/leave.      |
| `game`            | `{ phase: "pregame" \| "ingame"; matchId: string }`             | Emitted on game phase transitions (agent select or match start). |
| `self:state`      | `{ state: string \| null; presence: ValorantPresence \| null }` | Emitted when the local player's presence state updates.          |
| `raw`             | `RiotFrame`                                                     | Emitted for every unprocessed JSON-RPC frame from Riot Client.   |
| `error`           | `Error`                                                         | Emitted when a socket or parsing error occurs.                   |

## Automatic Reconnection

If the Riot Client process restarts or the socket connection drops unexpectedly, `RiotSocket` automatically enters exponential backoff retry:

1. A `disconnected` event is emitted immediately upon disconnect.
2. The internal socket periodically attempts to locate the new lockfile and reconnect to the fresh port.
3. Upon reconnection, `connected` is fired again and subscriptions resume without manual client restarts.

## CLI Watch Command

Stream real-time events directly from the terminal. Each event is emitted as a single JSON line on stdout:

```bash
riotclient watch
```

Filter specific event streams using `--only`:

```bash
riotclient watch --only friend:presence,message,game
```

Inspect raw unprocessed WebSocket frames using `--raw`:

```bash
riotclient watch --raw
```

Pipe the JSON stream into tools like `jq` to build shell automations:

```bash
riotclient watch --only message | jq -r '.body'
```
