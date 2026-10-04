import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RiotClientError, ValidationError } from "./errors.js";
import { PACKAGE_VERSION } from "./version.js";
import { formatError } from "./formatError.js";
import { McpServer } from "./mcp/index.js";
import { RiotClient, type LoadoutChange, type LoadoutGunChange } from "./RiotClient.js";
import {
  isSea,
  openBrowser,
  printDashboardBanner,
  runDashboard,
  shouldLaunchDashboard,
  startDashboardServer,
} from "./dashboardLauncher.js";

export {
  isSea,
  openBrowser,
  printDashboardBanner,
  runDashboard,
  shouldLaunchDashboard,
  startDashboardServer,
};

export const USAGE = `Usage: riotclient <command> [options]

Account:
  whoami           Print signed-in player profile and region
  owned-items      Print owned inventory items
  collection-value Calculate estimated VP and Radianite value of owned collection
  loadout          Print currently equipped loadout
  wallet           Print VP, Radianite, and Kingdom Credits balances
  xp               Print account level, XP progression and recent match XP history
  contracts        Print progression across agent, battlepass and event contracts
  missions         Print active daily and weekly missions and objectives
  penalties        Print active penalties and restrictions
  favourites       Print favorited weapon skins
  session          Print current client session loop state and playtime
  config           Print shared client configuration mapping
  client           Print client identity, locale, region, and Valorant running state
  settings         Print cloud player settings (--raw for unprocessed dump)
  settings-save    Save player settings from JSON file (<file.json>, requires --yes --confirm)
  equip            Equip skins, buddies, sprays, card, title, border, flex (dry-run, --yes to apply)
  equip-collection Equip a collection of skins (<skinUuid,...>) (dry-run, --yes to apply)
  loadout-export   Export current loadout as a preset JSON
  loadout-diff     Compare current loadout against preset JSON file (<preset.json>)
  loadout-apply    Apply loadout preset from JSON file (<preset.json>, dry-run, --yes to apply)
  contract-activate Activate an agent contract (<uuid>) (dry-run, --yes to apply)
  favourite-add    Add skin to favourites (<skin>) (dry-run, --yes to apply)
  favourite-remove Remove skin from favourites (<skin>) (dry-run, --yes to apply)
  privacy          Update account privacy toggles (--badge on|off, --leaderboard on|off)

Social:
  friends          Print friends roster and presence
  friend-requests  Print incoming and outgoing friend requests
  blocked          Print blocked players
  conversations    Print whisper and match chat conversations
  messages         Print chat messages (filter with --cid <id>)
  participants     Print chat participants (filter with --cid <id>)
  send             Send chat message (--to <puuid|name#tag|cid> --text <msg>)
  friend-request   Send friend request (<name#tag>)
  friend-accept    Accept friend request (<puuid>)
  friend-decline   Decline friend request (<puuid>)
  friend-cancel    Cancel friend request (<puuid>)
  friend-remove    Remove friend (<puuid>)
  block            Block player (<puuid|name#tag>)
  unblock          Unblock player (<puuid>)

Store:
  store            Print storefront (daily, night market, bundles, accessories)
  store-history    Print recorded daily store rotations [--days <n>]
  store-seen       Print when a skin was last seen in daily store (<skin>)
  offers           Print full item offers catalog and pricing
  order <id>       Print store order details
  night-market-reveal Reveal night market offers (dry-run, --yes to apply)
  buy              Purchase offer or bundle (--offer <id> | --bundle <id>, requires --yes --confirm)
  wishlist         Print skin wishlist or manage items (add <skin>, remove <skin>, check)

Matches:
  matches          Print recent match history summaries
  matches-sync     Synchronize match history to local cache [--pages <n>]
  match <id>       Print full match details by ID
  mmr              Print current rank, rating, and MMR breakdown
  rank-history     Print competitive rating adjustments and tier changes
  live             Print live pregame or in-game lobby status and loadouts
  matches-for <puuid> Print recent match history summaries for player
  mmr-for <puuid>  Print rank, rating, and MMR for player
  rank-history-for <puuid> Print competitive updates for player
  leaderboard      Print competitive leaderboard [--season] [--start] [--size] [--query]
  content          Print active act, episode and live events
  premier          Print premier eligibility, roster, and season info
  trend            Print competitive rating streak, net RR gains, and climbing pace
  summary          Print player performance summary across recent matches [--count n] [--queue q]
  assess [puuid]   Assess player rank anomalies, streaks, and warning flags
  agent-select     Select an agent in pregame (<uuid|name>) (dry-run, --yes to apply)
  agent-lock       Lock in an agent in pregame (<uuid|name>) (dry-run, --yes to apply)
  dodge            Dodge pregame agent select (requires --yes --confirm)
  leave-match      Leave active in-game match (requires --yes --confirm)

Party:
  party            Print current party details and members
  queues           Print matchmaking queue configurations
  custom-game-configs Print custom game configuration options
  party-invite     Invite player to party (<name#tag>)
  party-kick       Kick member from party (<puuid>)
  party-promote    Promote member to party owner (<puuid>)
  party-code       Generate or revoke party invite code [--revoke]
  party-join       Join party by invite code or party ID (<partyId|code>)
  party-invites    Print incoming party invites
  party-requests   Print incoming party join requests
  party-decline-invite Decline party invite (<id>) (dry-run, --yes to apply)
  party-request    Request to join party (<partyId>) (dry-run, --yes to apply)
  party-decline-request Decline party join request (<id>) (dry-run, --yes to apply)
  custom-game      Convert party into a custom game (dry-run, --yes to apply)
  custom-game-settings Configure custom game (--map <name> --mode <name> [--server <id>] [--rule k=v...])
  custom-game-team Set member custom game team (<puuid> <team>) (dry-run, --yes to apply)
  custom-game-start Start custom game match (dry-run, --yes to apply)
  custom-game-balance Balance custom game teams (dry-run, --yes to apply)
  party-default    Set party default queue (<queue>) (dry-run, --yes to apply)
  party-servers    Set preferred game servers (<id,...>) (dry-run, --yes to apply)
  party-moderator  Set member moderator status (<puuid> on|off) (dry-run, --yes to apply)
  party-refresh    Refresh party member pings and identity (dry-run, --yes to apply)
  party-ready      Set party ready state (on|off)
  party-queue      Change party queue (<queue>)
  party-access     Set party accessibility (open|closed)
  party-start      Start party matchmaking
  party-stop       Stop party matchmaking
  party-leave      Leave current party

Raw (unsupported):
  local            Send raw request to local Riot client API (<get|post|put|delete> <path> [--body json])
  riot             Send raw request to remote Riot game servers (<get|post|put|delete> <url> [--body json])

Events:
  watch            Stream real-time events as JSON lines until interrupted
  watch store      Stream store wishlist rotation hits until interrupted [--webhook <url>] [--interval <min>]
  watch-match      Stream match lifecycle events until interrupted
  watch-friends    Stream friend activity and presence events until interrupted

Server:
  dashboard        Start local server and open interactive web dashboard
  serve            Start local HTTP server with SSE events and OpenAPI docs [--port 47800] [--host 127.0.0.1] [--allow-remote]
  mcp              Start Model Context Protocol (MCP) server over stdio for AI assistants

Official:
  official account <name#tag> Print player PUUID and active shard
  official matches <name#tag> Print player match history [--queue <q>] [--count <n>]
  official match <id> Print full match details (--shard <shard> [--self <puuid>])
  official leaderboard Print competitive leaderboard (--shard <shard> [--act <id>] [--start <n>] [--size <n>])
  official status Print platform status and maintenance alerts (--shard <shard>)
  official summary <name#tag> Print player performance summary [--queue <q>] [--count <n>]
  official profile <name#tag> Print player scouting profile [--count <n>]

Options:
  --yes              Execute write command (default is dry-run)
  --confirm          Confirm write action (required with buy, dodge, leave-match, settings-save)
  --offer <id>       Store offer ID to purchase
  --bundle <id>      Store bundle ID to purchase
  --badge <on|off>   Hide or show act rank badge
  --leaderboard <on|off> Anonymize or reveal leaderboard presence
  --season <uuid>    Season ID for leaderboard
  --start <n>        Leaderboard starting index
  --size <n>         Leaderboard page size (max 510)
  --query <text>     Leaderboard player search query
  --revoke           Revoke party invite code (used with party-code)
  --to <target>      Message recipient (puuid, name#tag, or cid)
  --text <msg>       Message text
  --gun <spec>       Gun to equip: <weapon>=<skin>[:level[:chroma]] (repeatable)
  --buddy <spec>     Buddy to equip: <weapon>=<buddy|none> (repeatable)
  --spray <spec>     Spray to equip: <slot>=<uuid|none> (repeatable)
  --card <uuid>      Player card UUID
  --title <uuid>     Player title UUID
  --flex <uuid|none> Flex item UUID or none
  --border <uuid>    Level border UUID
  --incognito <on|off> Enable or disable incognito
  --hide-level <on|off> Hide or show account level
  --count <n>        Number of matches or rank history entries to fetch
  --queue <queue>    Queue filter (e.g. competitive, unrated)
  --ranks            Fetch MMR and rank for each player in live match
  --no-loadouts      Skip fetching player loadouts in live match
  --map <name>       Map name or path for custom game
  --mode <name>      Game mode name or path for custom game
  --server <id>      Server pod ID for custom game
  --rule <spec>      Game rule override: <name>=<value> (repeatable)
  --body <json>      JSON request body for local and riot raw commands
  --only <events>    Comma-separated list of event names to print
  --raw              Include raw client event frames or unformatted settings
  --cid <id>         Conversation ID for filtering messages or participants
  --api-key <key>    Riot Developer API key (or RIOT_API_KEY env)
  --shard <shard>    Riot shard (na, latam, br, eu, ap, kr)
  --self <puuid>     Player PUUID for self perspective in official match
  --act <uuid>       Act or season UUID for official leaderboard
  --language <lang>  Catalogue language (default: en-US)
  --cache <seconds>  Reuse Riot responses younger than this many seconds
  --no-official-cache Disable official match disk cache
  --webhook <url>    Webhook URL for store alerts (Discord or generic)
  --interval <min>   Check interval in minutes for store watcher
  --port <n>         Port to bind HTTP server (default: 47800)
  --host <ip>        Host address to bind HTTP server (default: 127.0.0.1)
  --allow-remote     Allow binding HTTP server to non-loopback address
  --pretty           Pretty-print JSON output
  --help             Show usage instructions
  --version          Show version number
`;

const ERROR_EXIT_CODES: Record<string, number> = {
  RIOT_CLIENT_NOT_RUNNING: 2,
  RIOT_CLIENT_NOT_READY: 3,
  REGION_UNKNOWN: 4,
  RIOT_API_ERROR: 5,
  VALIDATION: 6,
  OFFICIAL_API_KEY_MISSING: 7,
};

export function exitCodeForError(error: unknown): number {
  if (error instanceof RiotClientError) {
    return ERROR_EXIT_CODES[error.code] ?? 1;
  }
  return 1;
}

export { formatError };

export function formatWatchLine(
  event: string,
  data: unknown,
  at: string = new Date().toISOString(),
): string {
  return JSON.stringify({
    event,
    at,
    data: data !== undefined ? data : null,
  });
}

const WATCH_EVENTS = [
  "connected",
  "disconnected",
  "friend:presence",
  "friend:added",
  "friend:removed",
  "friend:request",
  "message",
  "party",
  "game",
  "self:state",
  "raw",
  "error",
] as const;

export async function runWatch(
  client: RiotClient,
  options: { only?: string; raw?: boolean } = {},
): Promise<number> {
  const allowed = options.only
    ? new Set(
        options.only
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;
  const includeRaw = Boolean(options.raw);
  const events = client.events();

  const printEvent = (event: string, data?: unknown) => {
    if (event === "raw" && !includeRaw) return;
    if (allowed && !allowed.has(event)) return;
    const payload = data instanceof Error ? { name: data.name, message: data.message } : data;
    process.stdout.write(`${formatWatchLine(event, payload)}\n`);
  };

  for (const name of WATCH_EVENTS) {
    events.on(name, (...args: unknown[]) => {
      printEvent(name, args[0]);
    });
  }

  await new Promise<void>((resolve) => {
    const onSignal = () => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });

  await client.close();
  return 0;
}

export async function runWatchMatch(client: RiotClient): Promise<number> {
  const watcher = client.watch.match();
  const onSignal = () => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    watcher.stop();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    for await (const item of watcher) {
      process.stdout.write(`${JSON.stringify(item)}\n`);
    }
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    watcher.stop();
    await client.close();
  }
  return 0;
}

export async function runWatchFriends(client: RiotClient): Promise<number> {
  const watcher = client.watch.friends();
  const onSignal = () => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    watcher.stop();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    for await (const item of watcher) {
      process.stdout.write(`${JSON.stringify(item)}\n`);
    }
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    watcher.stop();
    await client.close();
  }
  return 0;
}

export async function runWatchStore(
  client: RiotClient,
  options: { webhook?: string; intervalMinutes?: number } = {},
): Promise<number> {
  const intervalMs =
    options.intervalMinutes && options.intervalMinutes > 0
      ? options.intervalMinutes * 60 * 1000
      : undefined;
  const watcher = client.watch.store({
    webhook: options.webhook,
    intervalMs,
  });
  const onSignal = () => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    watcher.stop();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    for await (const item of watcher) {
      process.stdout.write(`${JSON.stringify(item)}\n`);
    }
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    watcher.stop();
    await client.close();
  }
  return 0;
}

export async function runServe(
  client: RiotClient,
  options: { port?: number; host?: string; allowRemote?: boolean } = {},
): Promise<number> {
  const server = await client.serve(options);
  process.stdout.write(`Riot Client HTTP server listening on ${server.url}\n`);

  await new Promise<void>((resolve) => {
    const onSignal = () => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });

  await server.close();
  await client.close();
  return 0;
}

export async function runMcp(client: RiotClient): Promise<number> {
  const server = new McpServer(client);

  const onSignal = () => {
    server.close();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    await server.start();
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await client.close();
  }

  return 0;
}

interface CliCommandOptions {
  language?: string;
  cid?: string;
  count?: number;
  queue?: string;
  ranks?: boolean;
  loadouts?: boolean;
  matchId?: string;
  yes?: boolean;
  days?: number;
  pages?: number;
  positionals?: string[];
  rawValues?: Record<string, unknown>;
}

const UNKNOWN_COMMAND = Symbol("UNKNOWN_COMMAND");

function parseTarget(
  to: string,
): { puuid: string } | { conversationId: string } | { riotId: string } {
  if (to.includes("#")) return { riotId: to };
  if (to.includes("@")) return { conversationId: to };
  return { puuid: to };
}

function parseBooleanFlag(name: string, value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).toLowerCase();
  if (str === "on" || str === "true") return true;
  if (str === "off" || str === "false") return false;
  throw new ValidationError(
    "invalid-argument",
    `Expected ${name} on|off, received: ${String(value)}`,
  );
}

function parseNullableUuid(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value);
  if (str.toLowerCase() === "none" || str.toLowerCase() === "null") return null;
  return str;
}

function parseSprays(
  sprayArgs: string[] | undefined,
): Array<string | null | undefined> | undefined {
  if (!sprayArgs) return undefined;
  const sprays: Array<string | null | undefined> = [undefined, undefined, undefined];
  for (const arg of sprayArgs) {
    const eqIdx = arg.indexOf("=");
    if (eqIdx === -1) {
      throw new ValidationError(
        "invalid-argument",
        `Invalid spray spec: ${arg}. Expected <slot>=<uuid|none>`,
      );
    }
    const slotNum = Number(arg.slice(0, eqIdx));
    if (isNaN(slotNum) || slotNum < 0 || slotNum > 2) {
      throw new ValidationError(
        "too-many-sprays",
        `Invalid spray slot: ${arg.slice(0, eqIdx)}. Expected 0, 1, or 2`,
      );
    }
    sprays[slotNum] = parseNullableUuid(arg.slice(eqIdx + 1));
  }
  return sprays;
}

function parseGuns(
  gunArgs: string[] | undefined,
  buddyArgs: string[] | undefined,
): LoadoutGunChange[] | undefined {
  if (!gunArgs && !buddyArgs) return undefined;
  const gunsMap = new Map<string, LoadoutGunChange>();

  if (gunArgs) {
    for (const arg of gunArgs) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        throw new ValidationError(
          "invalid-argument",
          `Invalid gun spec: ${arg}. Expected <weapon>=<skin>[:level[:chroma]]`,
        );
      }
      const weapon = arg.slice(0, eqIdx);
      const rest = arg.slice(eqIdx + 1);
      const parts = rest.split(":");
      const skin = parts[0] || undefined;
      const level = parts[1] || undefined;
      const chroma = parts[2] || undefined;
      gunsMap.set(weapon.toLowerCase(), { weapon, skin, level, chroma });
    }
  }

  if (buddyArgs) {
    for (const arg of buddyArgs) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        throw new ValidationError(
          "invalid-argument",
          `Invalid buddy spec: ${arg}. Expected <weapon>=<buddy|none>`,
        );
      }
      const weapon = arg.slice(0, eqIdx);
      const buddy = parseNullableUuid(arg.slice(eqIdx + 1));
      const existing = gunsMap.get(weapon.toLowerCase());
      if (existing) {
        existing.buddy = buddy;
      } else {
        gunsMap.set(weapon.toLowerCase(), { weapon, buddy });
      }
    }
  }

  return Array.from(gunsMap.values());
}

function parseEquipChange(values: Record<string, unknown>): LoadoutChange {
  const border = (values.border ?? values["level-border"]) as string | undefined;
  return {
    guns: parseGuns(values.gun as string[] | undefined, values.buddy as string[] | undefined),
    sprays: parseSprays(values.spray as string[] | undefined),
    flex: parseNullableUuid(values.flex),
    card: values.card as string | undefined,
    title: values.title as string | undefined,
    levelBorder: border,
    incognito: parseBooleanFlag("incognito", values.incognito),
    hideAccountLevel: parseBooleanFlag(
      "hide-level",
      values["hide-level"] ?? values["hide-account-level"],
    ),
  };
}

function requirePositional(pos: string[], index: number, usage: string): string {
  const val = pos[index];
  if (!val) throw new ValidationError("invalid-argument", usage);
  return val;
}

async function executeStandardCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  const pos = options?.positionals ?? [];
  switch (command) {
    case "whoami":
      return client.account.whoami();
    case "owned-items":
      return client.account.ownedItems({ language: options?.language });
    case "collection-value":
      return client.account.collectionValue();
    case "loadout":
      return client.account.loadout();
    case "wallet":
      return client.account.wallet();
    case "xp":
      return client.account.xp();
    case "contracts":
      return client.account.contracts();
    case "missions":
      return client.account.missions();
    case "penalties":
      return client.account.penalties();
    case "favourites":
      return client.account.favourites();
    case "session":
      return client.account.session();
    case "config":
      return client.account.config();
    case "friends":
      return client.social.friends();
    case "friend-requests":
      return client.social.friendRequests();
    case "blocked":
      return client.social.blocked();
    case "conversations":
      return client.social.conversations();
    case "messages":
      return client.social.messages(options?.cid);
    case "store":
      return client.store.current({ language: options?.language });
    case "store-history":
      return client.store.history({ days: options?.days });
    case "store-seen": {
      const skin = requirePositional(pos, 1, "Usage: riotclient store-seen <skin>");
      return client.store.seen(skin);
    }
    case "offers":
      return client.store.offers();
    case "order":
      return client.store.order(requirePositional(pos, 1, "Usage: riotclient order <id>"));
    case "wishlist": {
      const action = pos[1];
      if (!action || action === "list") {
        return client.store.wishlist();
      }
      if (action === "add") {
        const skin = requirePositional(pos, 2, "Usage: riotclient wishlist add <skin>");
        return client.store.wishlistAdd(skin);
      }
      if (action === "remove") {
        const skin = requirePositional(pos, 2, "Usage: riotclient wishlist remove <skin>");
        return client.store.wishlistRemove(skin);
      }
      if (action === "check") {
        return client.store.wishlistCheck();
      }
      throw new ValidationError("unknown-command", `Unknown wishlist action: ${action}`);
    }
    case "client":
      return client.account.client();
    case "participants":
      return client.social.participants(options?.cid);
    case "settings": {
      const settings = await client.account.settings();
      return options?.rawValues?.raw ? settings.raw : settings;
    }
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeGameCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  const pos = options?.positionals ?? [];
  const vals = options?.rawValues ?? {};
  switch (command) {
    case "matches":
      return client.matches.list({ count: options?.count, queue: options?.queue });
    case "matches-sync":
      return client.matches.sync({ maxPages: options?.pages });
    case "match":
      if (!options?.matchId) throw new Error("Missing match ID: riotclient match <id>");
      return client.matches.get(options.matchId);
    case "mmr":
      return client.matches.mmr();
    case "rank-history":
      return client.matches.rankHistory({ count: options?.count });
    case "live":
      return client.matches.live({ ranks: options?.ranks, loadouts: options?.loadouts });
    case "matches-for":
      return client.matches.listFor(
        requirePositional(pos, 1, "Usage: riotclient matches-for <puuid>"),
        { count: options?.count, queue: options?.queue },
      );
    case "mmr-for":
      return client.matches.mmrFor(requirePositional(pos, 1, "Usage: riotclient mmr-for <puuid>"));
    case "rank-history-for":
      return client.matches.rankHistoryFor(
        requirePositional(pos, 1, "Usage: riotclient rank-history-for <puuid>"),
        { count: options?.count },
      );
    case "leaderboard":
      return client.matches.leaderboard({
        season: vals.season as string | undefined,
        start: vals.start ? Number(vals.start) : undefined,
        size: vals.size ? Number(vals.size) : undefined,
        query: vals.query as string | undefined,
      });
    case "content":
      return client.matches.content();
    case "premier":
      return client.matches.premier();
    case "trend":
      return client.matches.trend({ count: options?.count });
    case "summary":
      return client.matches.summary({ count: options?.count, queue: options?.queue });
    case "assess":
      return client.matches.assess(pos[1]);
    case "party":
      return client.party.current();
    case "queues":
      return client.party.queues();
    case "custom-game-configs":
      return client.party.customGameConfigs();
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeSocialWriteCommand(
  client: RiotClient,
  command: string,
  yes: boolean,
  pos: string[],
  vals: Record<string, unknown>,
): Promise<unknown> {
  switch (command) {
    case "send": {
      const to = vals.to as string | undefined;
      const text = vals.text as string | undefined;
      if (!to || text === undefined) {
        throw new ValidationError(
          "invalid-argument",
          "Usage: riotclient send --to <puuid|name#tag|cid> --text <message>",
        );
      }
      const target = parseTarget(to);
      return yes
        ? client.social.sendMessage(target, text)
        : client.social.validateSendMessage(target, text);
    }
    case "friend-request": {
      const riotId = requirePositional(pos, 1, "Usage: riotclient friend-request <name#tag>");
      return yes
        ? client.social.sendFriendRequest(riotId)
        : client.social.validateSendFriendRequest(riotId);
    }
    case "friend-accept": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient friend-accept <puuid>");
      return yes
        ? client.social.acceptFriendRequest(puuid)
        : client.social.validateAcceptFriendRequest(puuid);
    }
    case "friend-decline": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient friend-decline <puuid>");
      return yes
        ? client.social.declineFriendRequest(puuid)
        : client.social.validateDeclineFriendRequest(puuid);
    }
    case "friend-cancel": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient friend-cancel <puuid>");
      return yes
        ? client.social.cancelFriendRequest(puuid)
        : client.social.validateCancelFriendRequest(puuid);
    }
    case "friend-remove": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient friend-remove <puuid>");
      return yes ? client.social.removeFriend(puuid) : client.social.validateRemoveFriend(puuid);
    }
    case "block": {
      const target = requirePositional(pos, 1, "Usage: riotclient block <puuid|name#tag>");
      return yes ? client.social.blockPlayer(target) : client.social.validateBlockPlayer(target);
    }
    case "unblock": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient unblock <puuid>");
      return yes ? client.social.unblockPlayer(puuid) : client.social.validateUnblockPlayer(puuid);
    }
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executePrivacyCommand(
  client: RiotClient,
  yes: boolean,
  vals: Record<string, unknown>,
): Promise<unknown> {
  const badgeVal = vals.badge ? parseBooleanFlag("badge", vals.badge) : undefined;
  const lbVal = vals.leaderboard ? parseBooleanFlag("leaderboard", vals.leaderboard) : undefined;
  if (badgeVal === undefined && lbVal === undefined) {
    throw new ValidationError(
      "invalid-argument",
      "Usage: riotclient privacy [--badge on|off] [--leaderboard on|off]",
    );
  }
  const result: Record<string, unknown> = {};
  if (badgeVal !== undefined) {
    result.badge = yes
      ? await client.account.setActRankBadgeHidden(badgeVal)
      : await client.account.validateSetActRankBadgeHidden(badgeVal);
  }
  if (lbVal !== undefined) {
    result.leaderboard = yes
      ? await client.account.setLeaderboardAnonymized(lbVal)
      : await client.account.validateSetLeaderboardAnonymized(lbVal);
  }
  return result;
}

async function executeAccountWriteCommand(
  client: RiotClient,
  command: string,
  yes: boolean,
  pos: string[],
  vals: Record<string, unknown>,
): Promise<unknown> {
  switch (command) {
    case "equip": {
      const change = parseEquipChange(vals);
      return yes ? client.account.equip(change) : client.account.validateEquip(change);
    }
    case "equip-collection": {
      const raw = pos.slice(1).join(",");
      const skinUuids = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (skinUuids.length === 0) {
        throw new ValidationError(
          "invalid-argument",
          "Usage: riotclient equip-collection <skinUuid,...>",
        );
      }
      return yes
        ? client.account.equipCollection(skinUuids)
        : client.account.validateEquipCollection(skinUuids);
    }
    case "loadout-export":
      return client.account.exportLoadout();
    case "loadout-diff": {
      const file = requirePositional(pos, 1, "Usage: riotclient loadout-diff <preset.json>");
      const content = JSON.parse(readFileSync(file, "utf-8")) as LoadoutChange;
      return client.account.diffLoadout(content);
    }
    case "loadout-apply": {
      const file = requirePositional(
        pos,
        1,
        "Usage: riotclient loadout-apply <preset.json> [--yes]",
      );
      const content = JSON.parse(readFileSync(file, "utf-8")) as LoadoutChange;
      return yes
        ? client.account.equipPreset(content)
        : client.account.validateEquipPreset(content);
    }
    case "contract-activate": {
      const uuid = requirePositional(pos, 1, "Usage: riotclient contract-activate <uuid>");
      return yes
        ? client.account.activateContract(uuid)
        : client.account.validateActivateContract(uuid);
    }
    case "favourite-add": {
      const skin = requirePositional(pos, 1, "Usage: riotclient favourite-add <skin>");
      return yes ? client.account.addFavourite(skin) : client.account.validateAddFavourite(skin);
    }
    case "favourite-remove": {
      const skin = requirePositional(pos, 1, "Usage: riotclient favourite-remove <skin>");
      return yes
        ? client.account.removeFavourite(skin)
        : client.account.validateRemoveFavourite(skin);
    }
    case "privacy":
      return executePrivacyCommand(client, yes, vals);
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeBuyCommand(
  client: RiotClient,
  yes: boolean,
  vals: Record<string, unknown>,
): Promise<unknown> {
  const offer = vals.offer as string | undefined;
  const bundle = vals.bundle as string | undefined;
  if (!offer && !bundle) {
    throw new ValidationError(
      "invalid-argument",
      "Usage: riotclient buy (--offer <id> | --bundle <id>) [--yes --confirm]",
    );
  }
  const target = offer ? { offerId: offer } : { bundleId: bundle! };
  if (!yes) {
    return client.store.validateBuy(target, { confirm: true });
  }
  if (!vals.confirm) {
    throw new ValidationError(
      "confirm-required",
      "Purchase confirmation required: pass --confirm with --yes",
    );
  }
  return client.store.buy(target, { confirm: true });
}

async function executeStoreWriteCommand(
  client: RiotClient,
  command: string,
  yes: boolean,
  vals: Record<string, unknown>,
): Promise<unknown> {
  switch (command) {
    case "night-market-reveal":
      return yes ? client.store.revealNightMarket() : client.store.validateRevealNightMarket();
    case "buy":
      return executeBuyCommand(client, yes, vals);
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executePartyCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  const yes = Boolean(options?.yes);
  const pos = options?.positionals ?? [];
  const vals = options?.rawValues ?? {};

  switch (command) {
    case "party-invite": {
      const riotId = requirePositional(pos, 1, "Usage: riotclient party-invite <name#tag>");
      return yes ? client.party.invite(riotId) : client.party.validateInvite(riotId);
    }
    case "party-kick": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient party-kick <puuid>");
      return yes ? client.party.kick(puuid) : client.party.validateKick(puuid);
    }
    case "party-promote": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient party-promote <puuid>");
      return yes ? client.party.promote(puuid) : client.party.validatePromote(puuid);
    }
    case "party-code":
      return vals.revoke
        ? yes
          ? client.party.revokeInviteCode()
          : client.party.validateRevokeInviteCode()
        : yes
          ? client.party.createInviteCode()
          : client.party.validateCreateInviteCode();
    case "party-join": {
      const target = requirePositional(pos, 1, "Usage: riotclient party-join <partyId|code>");
      const isPartyId = target.includes("-") || target.length >= 32;
      if (isPartyId) {
        return yes ? client.party.join(target) : client.party.validateJoin(target);
      }
      return yes ? client.party.joinByCode(target) : client.party.validateJoinByCode(target);
    }
    case "party-ready": {
      const ready = parseBooleanFlag(
        "ready",
        requirePositional(pos, 1, "Usage: riotclient party-ready on|off"),
      );
      return yes
        ? client.party.setReady(Boolean(ready))
        : client.party.validateSetReady(Boolean(ready));
    }
    case "party-queue": {
      const queue = requirePositional(pos, 1, "Usage: riotclient party-queue <queue>");
      return yes ? client.party.setQueue(queue) : client.party.validateSetQueue(queue);
    }
    case "party-access": {
      const access = requirePositional(
        pos,
        1,
        "Usage: riotclient party-access open|closed",
      ).toLowerCase();
      if (access !== "open" && access !== "closed") {
        throw new ValidationError("invalid-argument", "Usage: riotclient party-access open|closed");
      }
      return yes
        ? client.party.setAccessibility(access)
        : client.party.validateSetAccessibility(access);
    }
    case "party-start":
      return yes ? client.party.startMatchmaking() : client.party.validateStartMatchmaking();
    case "party-stop":
      return yes ? client.party.stopMatchmaking() : client.party.validateStopMatchmaking();
    case "party-leave":
      return yes ? client.party.leave() : client.party.validateLeave();
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeWriteCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  const yes = Boolean(options?.yes);
  const pos = options?.positionals ?? [];
  const vals = options?.rawValues ?? {};

  const acc = await executeAccountWriteCommand(client, command, yes, pos, vals);
  if (acc !== UNKNOWN_COMMAND) return acc;
  const soc = await executeSocialWriteCommand(client, command, yes, pos, vals);
  if (soc !== UNKNOWN_COMMAND) return soc;
  return executeStoreWriteCommand(client, command, yes, vals);
}

async function executePartyExtraCommand(
  client: RiotClient,
  command: string,
  yes: boolean,
  pos: string[],
): Promise<unknown> {
  switch (command) {
    case "party-invites":
      return client.party.invites();
    case "party-requests":
      return client.party.requests();
    case "party-decline-invite": {
      const id = requirePositional(pos, 1, "Usage: riotclient party-decline-invite <id>");
      return yes ? client.party.declineInvite(id) : client.party.validateDeclineInvite(id);
    }
    case "party-request": {
      const id = requirePositional(pos, 1, "Usage: riotclient party-request <partyId>");
      return yes ? client.party.requestToJoin(id) : client.party.validateRequestToJoin(id);
    }
    case "party-decline-request": {
      const id = requirePositional(pos, 1, "Usage: riotclient party-decline-request <id>");
      return yes ? client.party.declineRequest(id) : client.party.validateDeclineRequest(id);
    }
    case "party-default": {
      const queue = requirePositional(pos, 1, "Usage: riotclient party-default <queue>");
      return yes ? client.party.makeDefault(queue) : client.party.validateMakeDefault(queue);
    }
    case "party-servers": {
      const raw = requirePositional(pos, 1, "Usage: riotclient party-servers <id,...>");
      const ids = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return yes
        ? client.party.setPreferredServers(ids)
        : client.party.validateSetPreferredServers(ids);
    }
    case "party-moderator": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient party-moderator <puuid> on|off");
      const mod = parseBooleanFlag(
        "moderator",
        requirePositional(pos, 2, "Usage: riotclient party-moderator <puuid> on|off"),
      );
      return yes
        ? client.party.setModerator(puuid, Boolean(mod))
        : client.party.validateSetModerator(puuid, Boolean(mod));
    }
    case "party-refresh":
      return yes ? client.party.refresh() : client.party.validateRefresh();
    default:
      return UNKNOWN_COMMAND;
  }
}

function parseCustomGameRules(vals: Record<string, unknown>): Record<string, unknown> {
  const ruleList = Array.isArray(vals.rule)
    ? (vals.rule as string[])
    : vals.rule
      ? [String(vals.rule)]
      : [];
  const rules: Record<string, unknown> = {};
  for (const r of ruleList) {
    const idx = r.indexOf("=");
    if (idx !== -1) {
      const k = r.slice(0, idx);
      const v = r.slice(idx + 1);
      rules[k] = v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v);
    }
  }
  return rules;
}

async function executeCustomGameCommand(
  client: RiotClient,
  command: string,
  yes: boolean,
  pos: string[],
  vals: Record<string, unknown>,
): Promise<unknown> {
  switch (command) {
    case "custom-game":
      return yes ? client.party.makeCustomGame() : client.party.validateMakeCustomGame();
    case "custom-game-settings": {
      const map = vals.map as string | undefined;
      const mode = vals.mode as string | undefined;
      if (!map || !mode) {
        throw new ValidationError(
          "invalid-argument",
          "Usage: riotclient custom-game-settings --map <name> --mode <name> [--server <id>] [--rule k=v...]",
        );
      }
      const settings = {
        map,
        mode,
        server: vals.server ? String(vals.server) : null,
        rules: parseCustomGameRules(vals),
      };
      return yes
        ? client.party.setCustomGameSettings(settings)
        : client.party.validateSetCustomGameSettings(settings);
    }
    case "custom-game-team": {
      const puuid = requirePositional(pos, 1, "Usage: riotclient custom-game-team <puuid> <team>");
      const team = requirePositional(pos, 2, "Usage: riotclient custom-game-team <puuid> <team>");
      return yes ? client.party.setTeam(puuid, team) : client.party.validateSetTeam(puuid, team);
    }
    case "custom-game-start":
      return yes ? client.party.startCustomGame() : client.party.validateStartCustomGame();
    case "custom-game-balance":
      return yes ? client.party.balanceTeams() : client.party.validateBalanceTeams();
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeMatchActionCommand(
  client: RiotClient,
  command: string,
  yes: boolean,
  pos: string[],
  vals: Record<string, unknown>,
): Promise<unknown> {
  switch (command) {
    case "agent-select": {
      const agent = requirePositional(pos, 1, "Usage: riotclient agent-select <uuid|name>");
      return yes ? client.matches.selectAgent(agent) : client.matches.validateSelectAgent(agent);
    }
    case "agent-lock": {
      const agent = requirePositional(pos, 1, "Usage: riotclient agent-lock <uuid|name>");
      return yes ? client.matches.lockAgent(agent) : client.matches.validateLockAgent(agent);
    }
    case "dodge": {
      if (!yes) {
        return client.matches.validateDodge({ confirm: true }).catch(async () => {
          return { method: "POST", path: "/pregame/v1/matches/{matchId}/quit" };
        });
      }
      if (!vals.confirm) {
        throw new ValidationError(
          "confirm-required",
          "Dodge requires explicit confirmation: pass --confirm with --yes",
        );
      }
      return client.matches.dodge({ confirm: true });
    }
    case "leave-match": {
      if (!yes) {
        return client.matches.validateLeaveMatch({ confirm: true }).catch(async () => {
          return { method: "POST", path: "/core-game/v1/players/{puuid}/disassociate/{matchId}" };
        });
      }
      if (!vals.confirm) {
        throw new ValidationError(
          "confirm-required",
          "Leaving match requires explicit confirmation: pass --confirm with --yes",
        );
      }
      return client.matches.leaveMatch({ confirm: true });
    }
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeSettingsCommand(
  client: RiotClient,
  command: string,
  yes: boolean,
  pos: string[],
  vals: Record<string, unknown>,
): Promise<unknown> {
  if (command !== "settings-save") return UNKNOWN_COMMAND;
  const filePath = requirePositional(
    pos,
    1,
    "Usage: riotclient settings-save <file.json> [--yes --confirm]",
  );
  const content = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
  if (!yes) {
    return client.account.validateSaveSettings(content, { confirm: true });
  }
  if (!vals.confirm) {
    throw new ValidationError(
      "confirm-required",
      "Settings save requires explicit confirmation: pass --confirm with --yes",
    );
  }
  return client.account.saveSettings(content, { confirm: true });
}

async function executeRawCommand(
  client: RiotClient,
  command: string,
  pos: string[],
  vals: Record<string, unknown>,
): Promise<unknown> {
  if (command !== "local" && command !== "riot") return UNKNOWN_COMMAND;
  const method = requirePositional(
    pos,
    1,
    `Usage: riotclient ${command} <get|post|put|delete> <path|url> [--body json]`,
  ).toLowerCase();
  const target = requirePositional(
    pos,
    2,
    `Usage: riotclient ${command} <get|post|put|delete> <path|url> [--body json]`,
  );
  const body = vals.body
    ? typeof vals.body === "string"
      ? JSON.parse(vals.body)
      : vals.body
    : undefined;
  const targetApi = command === "local" ? client.local : client.riot;
  switch (method) {
    case "get":
      return targetApi.get(target);
    case "post":
      return targetApi.post(target, body);
    case "put":
      return targetApi.put(target, body);
    case "delete":
      return targetApi.delete(target, body);
    default:
      throw new ValidationError(
        "invalid-argument",
        `Unknown HTTP method: ${method}. Expected get, post, put, or delete`,
      );
  }
}

async function executeOfficialCommand(
  client: RiotClient,
  command: string,
  pos: string[],
  vals: Record<string, unknown>,
): Promise<unknown> {
  if (command !== "official") {
    return UNKNOWN_COMMAND;
  }

  const sub = pos[1];
  switch (sub) {
    case "account": {
      const riotId = pos[2];
      if (!riotId) {
        throw new ValidationError("missing-riot-id", "Riot ID required (e.g. Name#Tag)");
      }
      return client.official.account(riotId);
    }
    case "matches": {
      const riotId = pos[2];
      if (!riotId) {
        throw new ValidationError("missing-riot-id", "Riot ID required (e.g. Name#Tag)");
      }
      const count = vals.count !== undefined ? Number(vals.count) : undefined;
      const queue = vals.queue !== undefined ? String(vals.queue) : undefined;
      return client.official.matches(riotId, { count, queue });
    }
    case "match": {
      const matchId = pos[2];
      if (!matchId) {
        throw new ValidationError("missing-match-id", "Match ID required");
      }
      const shard = vals.shard !== undefined ? String(vals.shard) : undefined;
      if (!shard) {
        throw new ValidationError("missing-shard", "Shard required (--shard <shard>)");
      }
      const self = vals.self !== undefined ? String(vals.self) : undefined;
      return client.official.match(matchId, { shard, self });
    }
    case "leaderboard": {
      const shard = vals.shard !== undefined ? String(vals.shard) : undefined;
      if (!shard) {
        throw new ValidationError("missing-shard", "Shard required (--shard <shard>)");
      }
      const act = vals.act !== undefined ? String(vals.act) : undefined;
      const start = vals.start !== undefined ? Number(vals.start) : undefined;
      const size = vals.size !== undefined ? Number(vals.size) : undefined;
      return client.official.leaderboard({ shard, act, start, size });
    }
    case "status": {
      const shard = vals.shard !== undefined ? String(vals.shard) : undefined;
      if (!shard) {
        throw new ValidationError("missing-shard", "Shard required (--shard <shard>)");
      }
      return client.official.status(shard);
    }
    case "summary": {
      const riotId = pos[2];
      if (!riotId) {
        throw new ValidationError("missing-riot-id", "Riot ID required (e.g. Name#Tag)");
      }
      const count = vals.count !== undefined ? Number(vals.count) : undefined;
      const queue = vals.queue !== undefined ? String(vals.queue) : undefined;
      return client.official.summary(riotId, { count, queue });
    }
    case "profile": {
      const riotId = pos[2];
      if (!riotId) {
        throw new ValidationError("missing-riot-id", "Riot ID required (e.g. Name#Tag)");
      }
      const count = vals.count !== undefined ? Number(vals.count) : undefined;
      return client.official.profile(riotId, { count });
    }
    default:
      return UNKNOWN_COMMAND;
  }
}

async function executeCommand(
  client: RiotClient,
  command: string,
  options?: CliCommandOptions,
): Promise<unknown> {
  const pos = options?.positionals ?? [];
  const vals = options?.rawValues ?? {};
  const yes = Boolean(options?.yes);

  const official = await executeOfficialCommand(client, command, pos, vals);
  if (official !== UNKNOWN_COMMAND) return official;
  const std = await executeStandardCommand(client, command, options);
  if (std !== UNKNOWN_COMMAND) return std;
  const game = await executeGameCommand(client, command, options);
  if (game !== UNKNOWN_COMMAND) return game;
  const party = await executePartyCommand(client, command, options);
  if (party !== UNKNOWN_COMMAND) return party;
  const partyExtra = await executePartyExtraCommand(client, command, yes, pos);
  if (partyExtra !== UNKNOWN_COMMAND) return partyExtra;
  const custom = await executeCustomGameCommand(client, command, yes, pos, vals);
  if (custom !== UNKNOWN_COMMAND) return custom;
  const matchAct = await executeMatchActionCommand(client, command, yes, pos, vals);
  if (matchAct !== UNKNOWN_COMMAND) return matchAct;
  const raw = await executeRawCommand(client, command, pos, vals);
  if (raw !== UNKNOWN_COMMAND) return raw;
  const setts = await executeSettingsCommand(client, command, yes, pos, vals);
  if (setts !== UNKNOWN_COMMAND) return setts;
  return executeWriteCommand(client, command, options);
}

export async function runCli(args: string[]): Promise<number> {
  if (shouldLaunchDashboard({ argsLength: args.length, isSea: isSea() })) {
    const client = new RiotClient();
    try {
      return await runDashboard(client);
    } catch (error) {
      const formatted = formatError(error);
      process.stderr.write(`${JSON.stringify(formatted)}\n`);
      return exitCodeForError(error);
    }
  }

  const parsed = parseArgs({
    args,
    options: {
      cid: { type: "string" },
      count: { type: "string" },
      queue: { type: "string" },
      ranks: { type: "boolean", default: false },
      "no-loadouts": { type: "boolean", default: false },
      loadouts: { type: "boolean" },
      language: { type: "string" },
      cache: { type: "string" },
      only: { type: "string" },
      raw: { type: "boolean", default: false },
      pretty: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      revoke: { type: "boolean", default: false },
      to: { type: "string" },
      text: { type: "string" },
      gun: { type: "string", multiple: true },
      buddy: { type: "string", multiple: true },
      spray: { type: "string", multiple: true },
      card: { type: "string" },
      title: { type: "string" },
      flex: { type: "string" },
      border: { type: "string" },
      "level-border": { type: "string" },
      incognito: { type: "string" },
      "hide-level": { type: "string" },
      "hide-account-level": { type: "string" },
      season: { type: "string" },
      start: { type: "string" },
      size: { type: "string" },
      query: { type: "string" },
      offer: { type: "string" },
      bundle: { type: "string" },
      confirm: { type: "boolean", default: false },
      badge: { type: "string" },
      leaderboard: { type: "string" },
      map: { type: "string" },
      mode: { type: "string" },
      server: { type: "string" },
      rule: { type: "string", multiple: true },
      body: { type: "string" },
      days: { type: "string" },
      pages: { type: "string" },
      port: { type: "string" },
      host: { type: "string" },
      "allow-remote": { type: "boolean", default: false },
      "api-key": { type: "string" },
      shard: { type: "string" },
      self: { type: "string" },
      act: { type: "string" },
      "no-official-cache": { type: "boolean", default: false },
      webhook: { type: "string" },
      interval: { type: "string" },
    },
    allowPositionals: true,
  });

  if (parsed.values.version) {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return 0;
  }

  if (parsed.values.help || parsed.positionals.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }

  const command = parsed.positionals[0]!;
  const cacheSeconds = Number(parsed.values.cache ?? 0);
  const apiKey = parsed.values["api-key"]
    ? String(parsed.values["api-key"])
    : process.env.RIOT_API_KEY;
  const officialCache = parsed.values["no-official-cache"] ? false : undefined;
  const client = new RiotClient({
    language: parsed.values.language,
    responseCache: cacheSeconds > 0 ? { ttlMs: cacheSeconds * 1000 } : undefined,
    officialApiKey: apiKey,
    officialCache,
  });

  try {
    if (command === "watch") {
      if (parsed.positionals[1] === "store") {
        const intervalMinutes = parsed.values.interval ? Number(parsed.values.interval) : undefined;
        const webhook = parsed.values.webhook ? String(parsed.values.webhook) : undefined;
        return await runWatchStore(client, { webhook, intervalMinutes });
      }
      return await runWatch(client, {
        only: parsed.values.only,
        raw: parsed.values.raw,
      });
    }

    if (command === "watch-store") {
      const intervalMinutes = parsed.values.interval ? Number(parsed.values.interval) : undefined;
      const webhook = parsed.values.webhook ? String(parsed.values.webhook) : undefined;
      return await runWatchStore(client, { webhook, intervalMinutes });
    }

    if (command === "watch-match") {
      return await runWatchMatch(client);
    }

    if (command === "watch-friends") {
      return await runWatchFriends(client);
    }

    if (command === "dashboard") {
      return await runDashboard(client);
    }

    if (command === "serve") {
      const port = parsed.values.port ? Number(parsed.values.port) : undefined;
      const host = parsed.values.host;
      const allowRemote = Boolean(parsed.values["allow-remote"]);
      return await runServe(client, { port, host, allowRemote });
    }

    if (command === "mcp") {
      return await runMcp(client);
    }

    const count = parsed.values.count ? Number(parsed.values.count) : undefined;
    const loadouts = parsed.values["no-loadouts"] ? false : (parsed.values.loadouts ?? true);
    const result = await executeCommand(client, command, {
      language: parsed.values.language,
      cid: parsed.values.cid,
      count,
      queue: parsed.values.queue,
      ranks: Boolean(parsed.values.ranks),
      loadouts,
      matchId: command === "match" ? parsed.positionals[1] : undefined,
      yes: Boolean(parsed.values.yes),
      days: parsed.values.days ? Number(parsed.values.days) : undefined,
      pages: parsed.values.pages ? Number(parsed.values.pages) : undefined,
      positionals: parsed.positionals,
      rawValues: parsed.values,
    });
    if (result === UNKNOWN_COMMAND) {
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      return 1;
    }

    const output = parsed.values.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
    process.stdout.write(`${output}\n`);
    return 0;
  } catch (error) {
    const formatted = formatError(error);
    process.stderr.write(`${JSON.stringify(formatted)}\n`);
    return exitCodeForError(error);
  } finally {
    await client.close();
  }
}
