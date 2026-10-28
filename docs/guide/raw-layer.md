# Raw Layer

The `@valoranchi/riot-client/raw` entry point provides direct access to underlying transports, credential managers, low-level HTTP clients, WebSocket parsers, and validation engines without high-level view models.

## Overview

Applications maintaining their own domain models or custom architectures can consume the low-level primitives:

- **Session Management**: `SessionManager` resolves lockfiles, tokens, entitlements, and deployment shards.
- **Transport**: `HttpGateway` enforces credential allowlisting and connection timeouts.
- **Riot PVP API**: `RiotApi` exposes raw methods for matchmaking, loadouts, contracts, and storefront.
- **Local Client API**: `RiotClientLocalApi`, `ChatApi`, `PlayerAccountApi` (riot id lookups) and `ProductLauncherApi` (launching the game) handle loopback queries.
- **Player Preferences**: `PlayerPreferencesApi` reads and writes the player's settings through Riot's preferences service and falls back to the running game, and `PreferenceCodec` packs and unpacks the payload.
- **Sockets & Frames**: `RiotSocket` and `parseFrame` manage real-time WebSocket communication.
- **Validation**: Individual validators (`LoadoutValidator`, `PartyValidator`, `StoreValidator`, `MatchValidator`).
- **Catalogue & Caching**: `ValorantApi`, `MemoryCatalogueCache`, `FileCatalogueStore`, and `FileResponseCache`.

## Stability Note

The raw entry point follows Riot internal REST and RPC payloads directly. Unlike the primary view model API (`RiotClient`), raw response shapes are subject to change across game updates without library major version bumps.

## Example

Construct low-level session handlers and query raw endpoint responses directly:

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

// Raw RiotLoadoutResponse directly from Riot PVP servers
const loadout = await api.loadout();
console.log(loadout.Subject, loadout.Guns.length);
```
