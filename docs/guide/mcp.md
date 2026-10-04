# Model Context Protocol (MCP) Server

The `@valoranchi/riot-client` CLI includes a native Model Context Protocol (MCP) server over `stdio`. This allows AI assistants like **Claude Code**, **Claude Desktop**, and **Cursor** to inspect your active VALORANT session, inventory, store offers, match history, and party state.

## Read-Only by Design

All MCP tools are strictly **read-only**. By design:

- No tool can purchase store items or spend real money or in-game currencies.
- No tool can equip skins, activate contracts, or modify cloud player settings.
- No tool can dodge matches, leave parties, or send chat messages.
- Only safe inspection queries (`GET` routes) are exposed to the AI model.

---

## Setup & Configuration

### Claude Code

Add the MCP server directly using the Claude Code CLI:

```bash
claude mcp add valorant -- npx -y @valoranchi/riot-client mcp
```

### Claude Desktop

Edit your `claude_desktop_config.json` file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the `valorant` server configuration:

```json
{
  "mcpServers": {
    "valorant": {
      "command": "npx",
      "args": ["-y", "@valoranchi/riot-client", "mcp"],
      "env": {
        "RIOT_API_KEY": "RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

> The `RIOT_API_KEY` environment variable is optional and only required if you want the assistant to access remote Official Developer API endpoints.

### Cursor

In Cursor, open **Settings** &rarr; **Features** &rarr; **MCP**, or configure your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "valorant": {
      "command": "npx",
      "args": ["-y", "@valoranchi/riot-client", "mcp"],
      "env": {
        "RIOT_API_KEY": "RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    }
  }
}
```

---

## Running from CLI

You can also run the MCP server directly from your terminal:

```bash
# Using npx directly
npx @valoranchi/riot-client mcp

# Reusing cached Riot responses younger than 30 seconds
npx @valoranchi/riot-client mcp --cache 30

# Using a localized catalogue language
npx @valoranchi/riot-client mcp --language es-ES
```

The process runs until `stdin` closes, handling JSON-RPC 2.0 messages line-by-line and emitting protocol responses to `stdout`.

---

## Available Tools

The MCP server exposes inspection tools across all core domains:

| Tool                      | Namespace | Description                                                      |
| :------------------------ | :-------- | :--------------------------------------------------------------- |
| `account_whoami`          | Account   | Get signed-in player profile, PUUID, and region                  |
| `account_wallet`          | Account   | Get VP, Radianite, and Kingdom Credits balances                  |
| `account_ownedItems`      | Account   | Get owned weapons, skins, buddies, and sprays                    |
| `account_loadout`         | Account   | Get currently equipped weapons and cosmetics                     |
| `account_collectionValue` | Account   | Calculate estimated VP and Radianite collection value            |
| `account_xp`              | Account   | Get account level and XP progression                             |
| `account_contracts`       | Account   | Get agent and battlepass contracts progress                      |
| `account_missions`        | Account   | Get daily and weekly mission progression                         |
| `account_penalties`       | Account   | Check active penalties and restrictions                          |
| `account_favourites`      | Account   | Get favorited weapon skins                                       |
| `store_current`           | Store     | Get daily rotation, featured bundles, and night market           |
| `store_offers`            | Store     | Get all item pricing and catalogue offers                        |
| `store_history`           | Store     | Get recorded daily storefront rotation history                   |
| `store_seen`              | Store     | Check when a skin was last seen in the store                     |
| `matches_list`            | Matches   | Get recent match summaries                                       |
| `matches_get`             | Matches   | Get detailed match scoreboard and round history                  |
| `matches_mmr`             | Matches   | Get current competitive rating and rank                          |
| `matches_rankHistory`     | Matches   | Get competitive rank updates and rating changes                  |
| `matches_trend`           | Matches   | Evaluate competitive rating trend and pace                       |
| `matches_summary`         | Matches   | Summarize recent performance metrics                             |
| `matches_live`            | Matches   | Inspect active pregame or in-game lobby                          |
| `party_current`           | Party     | Get current party roster, leader, and queue                      |
| `party_queues`            | Party     | List matchmaking queue configurations                            |
| `social_friends`          | Social    | Get friends roster and live presence                             |
| `official_profile`        | Official  | Level, rank and performance of any player (needs `RIOT_API_KEY`) |
| `official_summary`        | Official  | Performance summary of any player (needs `RIOT_API_KEY`)         |
| `official_matches`        | Official  | Recent matches of any player (needs `RIOT_API_KEY`)              |
| `official_leaderboard`    | Official  | Ranked leaderboard of a shard (needs `RIOT_API_KEY`)             |

---

## Example Prompts

Once configured, you can ask your AI assistant questions such as:

- _"What is in my daily store rotation today, and can I afford any of the skins with my current VP?"_
- _"Check my current rank and summarize my win/loss trend over my last 10 competitive matches."_
- _"Who in my friends list is currently online and playing VALORANT?"_
- _"What daily and weekly missions do I still need to complete?"_
- _"Who is currently in my party and are we queued for a match?"_
- _"What skins do I have equipped on my Vandal and Phantom?"_
- _"How has Player#TAG been playing lately, and which agents do they main?"_
