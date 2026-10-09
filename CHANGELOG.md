# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `client.matches.instalock()` and `riotclient instalock` lock an agent the moment agent select starts, with an agent per map, fallbacks, an optional delay, hover only and dry run modes. It goes against Riot's rules for third party tools; the docs say so.
- `client.watch.match({ webhook })` and `riotclient watch match --webhook <url>` post a recap when a match ends: map, result, score, K/D/A, ACS, HS% and RR change, as a Discord embed or JSON.
- `client.matches.session()`, `riotclient play-session` and `GET /api/matches/session`: today's games, wins, losses, RR net, streak, best and worst match, and a flag after three losses in a row.

## [0.6.1] - 2026-10-08

### Fixed

- `clientConfig()` and `content()` send the session's headers. Riot answers both with `400 BAD_CLAIMS` without them, so every call failed.
- Both entry points also export a `default` condition, so bundlers that resolve with `require` (webpack for Electron main, for example) find them.

## [0.6.0] - 2026-10-04

### Added

- Interactive browser dashboard served at `GET /` (`/dashboard.css`, `/dashboard.js`) with responsive dark theme and tabs for Home (player profile, card, rank with RR and rank fit, wallet), Store (daily rotation with countdown reset timer, bundles, night market), Wishlist (with skin autocomplete, local add/remove, and in-store highlights), Matches (last 10 matches with map, agent, score, KDA, result, and RR change), and Friends (online friends and live presence activity).
- Friendly full-width status banner when VALORANT is closed or starting up (`RIOT_CLIENT_NOT_RUNNING` or `RIOT_CLIENT_NOT_READY`) with automatic 10-second background reconnection polling.
- Bilingual interface in English and Spanish, automatically selected from browser language (`navigator.language`).
- Catalogue skin autocomplete endpoint `GET /api/store/skins` returning purchasable weapon skins (`{ uuid, name, weapon, icon, tier }`) without requiring an active Riot session.
- Moved route index directory to `GET /api` with direct links to documentation and the web dashboard.
- Double-click desktop mode for Node Single Executable Applications (`riotclient-win-x64.exe`): launches the local HTTP server with automatic port fallback (47800-47810), prints a friendly console banner, and automatically opens the user's default browser.
- CLI command `riotclient dashboard` to launch the local server and open the web dashboard from any environment.

### Security

- Serve HTTP server hardening against DNS rebinding and cross-site request forgery:
  - Strict `Host` header validation against loopback addresses (`127.0.0.1:<port>`, `localhost:<port>`, `[::1]:<port>`), returning `403 Forbidden` (`FORBIDDEN_HOST`) on unauthorized hostnames.
  - Same-origin validation for requests carrying an `Origin` header, blocking foreign cross-origin web callers with `403 Forbidden` (`FORBIDDEN_ORIGIN`).
  - Strict `Content-Type: application/json` enforcement on all `POST` requests, returning `415 Unsupported Media Type` (`UNSUPPORTED_MEDIA_TYPE`) to mandate CORS preflight requests from browsers.
  - Zero cross-origin permissive headers: the server never returns `Access-Control-Allow-Origin`, ensuring cross-site preflights fail.

## [0.5.0] - 2026-10-02

### Added

- Skin wishlist management and storefront rotation matching via `client.store.wishlist()`, `client.store.wishlistAdd(skin)`, `client.store.wishlistRemove(skin)`, and `client.store.wishlistCheck()` (`Wishlist`, `WishlistHit`, `WishlistCheck`), persisting wishlists per-puuid to disk cache with local validation against owned inventory, unpurchasable cosmetics, and unknown skin names without Riot mutations.
- Store watcher `client.watch.store(options?)` (`StoreWatcher`) monitoring daily storefront, night market, and featured bundle rotations with interval polling, post-rotation timeout realignment, and rotation-scoped hit deduplication (`<uuid>:<where>:<endsAt>`).
- Outbound webhook notifier `WebhookNotifier` delivering store wishlist alerts to Discord webhooks and generic HTTPS endpoints with 10-second request timeouts and non-Riot fetch isolation.
- CLI commands `riotclient wishlist [list]`, `riotclient wishlist add <skin>`, `riotclient wishlist remove <skin>`, `riotclient wishlist check`, and `riotclient watch store [--webhook <url>] [--interval <min>]`.
- Local serve REST API endpoints `GET /api/store/wishlist`, `GET /api/store/wishlistCheck`, `POST /api/store/wishlistAdd`, and `POST /api/store/wishlistRemove`, exposing wishlist queries through the local server and MCP read-only tools.
- JSON Schema definitions for `Wishlist`, `WishlistHit`, and `WishlistCheck` models under `schema/`.

- Model Context Protocol (MCP) server over stdio (`riotclient mcp`, `McpServer`) allowing AI assistants (Claude Code, Claude Desktop, Cursor) to inspect active session, inventory, loadout, store, matches, and party data read-only over JSON-RPC 2.0.

- Permanent disk caching for completed official matches (`isCompleted: true`) stored under `official/` in the cache directory, avoiding redundant network requests, with toggle via `officialCache: false` and CLI `--no-official-cache`.
- Player scouting and performance analysis via `client.official.summary(riotId, options?)` and `client.official.profile(riotId, options?)` (and CLI `riotclient official summary` and `riotclient official profile`), returning `PerformanceSummary` and `OfficialProfile` with rank, level, and match statistics.
- Official Riot Developer API support (`client.official` and CLI `riotclient official ...`) for remote inspection of player profiles (`account`), match history (`matches`), match details (`match`), competitive leaderboards (`leaderboard`), and platform status (`status`) without running the Riot Client, backed by sliding-window rate limiting (`RateLimiter`), automatic retry handling on 429/5xx, and credential protection.

## [0.4.0] - 2026-09-29

### Added

- Every language example is a compilable project under `examples/` that the docs import, and CI compiles all of them.
- `npm run fixtures:record` captures anonymized Riot payloads; snapshot tests rebuild the models from them.

- `client.watch.match()` and `client.watch.friends()` provide high-level typed event watchers with async iteration (`[Symbol.asyncIterator]`), 5-second polling floor, and 300ms friend presence debouncing. CLI `watch-match` and `watch-friends`.
- Serve mode (`client.serve()`, CLI `riotclient serve`) runs a local HTTP integration server with REST endpoints (`GET`/`POST /api/<namespace>/<method>`), Server-Sent Events (`GET /events`), auto-generated OpenAPI 3.0 specs (`GET /openapi.json`), route index dashboard (`GET /`), and loopback binding security.
- Single executable distribution (`npm run exe`) builds a standalone Windows executable (`release/riotclient-win-x64.exe`) with Node.js Single Executable Application (SEA) flow and automated GitHub release workflow attachment.
- `matches.trend(options?)` calculates competitive rating trends, streaks, net RR movement over 5/10/20 games, win rate, pace (`climbing`, `holding`, `falling`), and distance to next rank or demotion (`RatingTrend`). CLI `trend`.
- `matches.summary(options?)` aggregates performance stats across recent matches with by-agent and by-map breakdowns, best/worst highlights, and consistency metrics (`PerformanceSummary`). CLI `summary [--count n] [--queue q]`.
- `matches.assess(puuid)` and live match warnings on `LiveMatchPlayer.warnings` detect rank anomalies (`low-level-high-rank`, `inflated`, `underranked`, `long-streak`, `new-act`) (`PlayerAssessment`). CLI `assess [puuid]`.
- `account.diffLoadout()`, `account.equipPreset()`, and `account.exportLoadout()` calculate minimal loadout diffs, validate and equip preset changes, and export active loadouts (`LoadoutDiff`). CLI `loadout-export`, `loadout-diff`, `loadout-apply`.
- `account.collectionValue()` computes total Valorant Points and estimated Radianite Points for owned skins grouped by weapon and tier (`CollectionValue`). CLI `collection-value`.
- `store.history()` and `store.seen(skinUuid)` persist daily storefront rotations to local cache deduplicated per day and query skin appearance history (`StoreHistory`, `StoreSeen`). CLI `store-history`, `store-seen <skin>`.
- `matches.sync(options?)` and `matches.known()` synchronize match history to disk cache paging until reaching known matches and list cached matches (`MatchSyncResult`). CLI `matches-sync`.
- `mmr().fit` says whether the account sits at its right rank, judged by the rating won per victory over the last twenty competitive games: `above`, `fit` or `below`, with the expected rank and the average gain and loss.

## [0.3.0] - 2026-09-29

### Added

- Raw entry point `@valoranchi/riot-client/raw` with the transport, session, endpoints, local API, socket and validators.
- Live match actions: select agent, lock agent, dodge agent select, and leave match with validation.
- Expanded party operations: party invites, join requests, custom game configuration, team assignment, team balancing, preferred servers, and member promotion.
- Cloud player settings inspection and persistence (`client.account.settings()`, `client.account.saveSettings()`).
- Local game authorization, client session details, and chat participants inspection (`client.social.participants()`).
- Raw escape hatches on `client.local` and `client.riot` for direct HTTP access to unmodeled routes.
- Remote API operations: account XP, player contracts, active missions, penalties, favourites, and game configs.
- Store catalogue offers and order status inspection (`client.store.offers()`, `client.store.order()`).
- Matchmaking queues, custom game configs, premier details, content, and competitive leaderboard lookup.
- CLI commands and JSON schemas for all new operations.

## [0.2.0] - 2026-09-29

### Added

- Namespaced client API organized into five core domains: `account`, `social`, `store`, `matches`, and `party`.
- Party actions with local pre-flight validation: party invites, promote, kick, invite codes, queue selection, ready state, and matchmaking controls.
- Validated writes for loadout changes, skin equipping, contract activation, and social interactions (chat messages, friend requests, player blocking).
- Real-time event streaming (`client.events()`) listening to local Riot Client WebSocket notifications.
- Match history summaries, detailed match inspection, competitive MMR breakdown, and rank movement history.
- Storefront rotation inspection including daily offers, night market, featured bundles, accessories, and Radianite offers.
- Disk caching for remote responses and catalogue data keyed by game version.

### Changed

- Reorganized client methods under namespaces (`client.store()` -> `client.store.current()`, `client.matches()` -> `client.matches.list()`, `client.party()` -> `client.party.current()`).

## [0.1.0] - 2026-09-27

### Added

- Local Riot Client lockfile discovery and TLS loopback authentication.
- Player identity resolution (`whoami`) with region and shard detection.
- Owned items inventory builder for weapons, skins, chromas, buddies, player cards, titles, and sprays.
- Equipped loadout inspection and currency balance tracking (VP, Radianite, Kingdom Credits).
- `riotclient` CLI entry point with JSON output for integration with scripts and external applications.
- JSON Schema generation for domain models.
