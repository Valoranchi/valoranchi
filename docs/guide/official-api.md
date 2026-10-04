# Official Developer API

`@valoranchi/riot-client` provides access to Riot Games' official developer API (`*.api.riotgames.com`) via `client.official` and the CLI `riotclient official ...` commands.

Unlike local client integrations, the official API operates entirely without the Riot Client running on the machine. It allows you to query any player, match history, leaderboard, and platform status by supplying a Riot Developer API key.

## Obtaining an API Key

To use the official developer endpoints:

1. Visit the [Riot Developer Portal](https://developer.riotgames.com/).
2. Log in with your Riot Games account.
3. Generate a **Development API Key** on the dashboard, or register a **Personal/Production Project** for higher limits.

::: tip Development Key Expiry
Development API keys expire automatically every 24 hours. Production and personal API keys remain active indefinitely.
:::

## Key Security

Official API keys are sensitive secrets:

- The API key stays server-side and is never exposed in client bundles or public repositories.
- `HttpGateway` enforces that `X-Riot-Token` is strictly sent to official Riot hosts (`*.riotgames.com`) and never forwarded to third-party endpoints or asset hosts like `valorant-api.com`.
- API keys are never included in log outputs or formatted error messages.

## Rate Limiting & Resilience

Riot's official developer API enforces sliding-window rate limits (defaulting to 20 requests per second and 100 requests per 2 minutes for development keys).

The library includes an integrated sliding-window `RateLimiter`:

- Concurrent requests are automatically serialized across sliding windows to prevent exceeding rate quotas.
- When encountering HTTP 429 (Rate Limited), the client respects the `Retry-After` header (up to 10 seconds) and automatically retries once.
- Transient 5xx server errors trigger an automatic retry after a 500 ms backoff.

## Caching

Official match details for completed matches (`isCompleted: true`) are permanently cached on disk under the `official/` subdirectory within the response cache directory. Once fetched, finished matches are read from local disk on subsequent queries across client instances and never re-requested over the network. Incomplete or missing matches are never stored.

Caching is enabled by default. To disable caching, pass `officialCache: false` in `RiotClientOptions`, or use `--no-official-cache` in the CLI:

```ts
const client = new RiotClient({
  officialApiKey: process.env.RIOT_API_KEY,
  officialCache: false,
});
```

## Scouting a Player

The official API enables performance analysis and player scouting for any player without requiring access to their local client.

### Performance Summary

Aggregate performance statistics across recent matches with by-agent and by-map breakdowns, consistency metrics, and highlight stats:

```ts
// Library usage: defaults to queue "competitive" and count 10
const summary = await client.official.summary("TenZ#SEN", {
  queue: "competitive",
  count: 10,
});
console.log(summary.overall.winRate, summary.overall.kd);
console.log(summary.best.agent, summary.best.map);
```

```bash
# CLI usage:
riotclient official summary "TenZ#SEN" --queue competitive --count 10
```

### Player Profile

Retrieve an `OfficialProfile` containing account identity, current competitive rank, account level, time of the last played match, and performance summary across recent games:

```ts
// Library usage:
const profile = await client.official.profile("TenZ#SEN", { count: 10 });
console.log(profile.account.puuid, profile.account.shard);
console.log(profile.accountLevel, profile.rank?.name);
console.log(profile.lastPlayedAt);
console.log(profile.summary.overall);
```

```bash
# CLI usage:
riotclient official profile "TenZ#SEN" --count 10
```

`accountLevel` and `rank` are derived from the player's entry in their most recent competitive match (returning `null` if no competitive matches are found in the evaluated window).

## Library Usage

Pass `officialApiKey` in options when creating `RiotClient`, or define the `RIOT_API_KEY` environment variable:

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient({
  officialApiKey: process.env.RIOT_API_KEY,
});

// 1. Resolve player PUUID and active shard by Riot ID
const account = await client.official.account("TenZ#SEN");
console.log(account.puuid, account.shard);

// 2. Fetch recent matches for any player (newest first)
const summaries = await client.official.matches("TenZ#SEN", {
  queue: "competitive",
  count: 5,
});
console.log(summaries);

// 3. Retrieve detailed match information
const match = await client.official.match("match-uuid-here", {
  shard: account.shard,
});
console.log(match.map.name, match.teams);

// 4. Retrieve competitive leaderboard
const leaderboard = await client.official.leaderboard({
  shard: "na",
  size: 50,
});
console.log(leaderboard.entries[0]);

// 5. Inspect platform status and maintenance incidents
const status = await client.official.status("na");
console.log(status.maintenances, status.incidents);
```

If neither `officialApiKey` nor `process.env.RIOT_API_KEY` is present, calling any `client.official` method immediately throws `OfficialApiKeyMissingError` without making network requests.

## CLI Usage

The CLI supports all official API endpoints under the `official` subcommand. You can pass the key explicitly with `--api-key` or set `RIOT_API_KEY`:

```bash
# Resolve player PUUID and shard
riotclient official account "TenZ#SEN" --api-key RGAPI-xxx

# Query match history
riotclient official matches "TenZ#SEN" --queue competitive --count 5

# Inspect specific match details
riotclient official match <matchId> --shard na

# Query act leaderboard
riotclient official leaderboard --shard na --size 20

# Query regional platform data
riotclient official status --shard na
```

If the API key is missing, the CLI exits with code `7` and outputs a JSON error:

```json
{
  "error": {
    "code": "OFFICIAL_API_KEY_MISSING",
    "message": "Official Riot API key is missing"
  }
}
```
