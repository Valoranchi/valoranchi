import type { LoadoutChange } from "../client/LoadoutValidator.js";
import type { BuyTarget } from "../client/StoreValidator.js";
import { ValidationError } from "../errors.js";
import type { CustomGameSettings } from "../model/index.js";
import type { RiotClient } from "../RiotClient.js";
import type { RouteDefinition } from "./types.js";

export const CONFIRM_GATED_ROUTES = new Set([
  "matches/dodge",
  "matches/leaveMatch",
  "matches/leave-match",
  "store/buy",
  "account/saveSettings",
  "account/settings-save",
]);

export const ROUTE_DEFINITIONS: RouteDefinition[] = [
  {
    method: "GET",
    namespace: "account",
    action: "whoami",
    path: "/api/account/whoami",
    summary: "Get signed-in player profile",
    responseSchema: "Player",
  },
  {
    method: "GET",
    namespace: "account",
    action: "ownedItems",
    path: "/api/account/ownedItems",
    summary: "Get owned inventory collection",
    responseSchema: "OwnedItems",
    params: [
      {
        name: "language",
        type: "string",
        description: "Locale code for localized item names (e.g. en-US)",
      },
    ],
  },
  {
    method: "GET",
    namespace: "account",
    action: "loadout",
    path: "/api/account/loadout",
    summary: "Get currently equipped loadout",
    responseSchema: "Loadout",
  },
  {
    method: "GET",
    namespace: "account",
    action: "collectionValue",
    path: "/api/account/collectionValue",
    summary: "Calculate estimated value of inventory",
    responseSchema: "CollectionValue",
  },
  {
    method: "GET",
    namespace: "account",
    action: "wallet",
    path: "/api/account/wallet",
    summary: "Get currency balances",
    responseSchema: "Wallet",
  },
  {
    method: "GET",
    namespace: "account",
    action: "xp",
    path: "/api/account/xp",
    summary: "Get account level and XP progression",
    responseSchema: "AccountXp",
  },
  {
    method: "GET",
    namespace: "account",
    action: "contracts",
    path: "/api/account/contracts",
    summary: "Get agent and battlepass contracts progress",
    responseSchema: "ContractProgress",
  },
  {
    method: "GET",
    namespace: "account",
    action: "missions",
    path: "/api/account/missions",
    summary: "Get daily and weekly missions",
    responseSchema: "Mission",
  },
  {
    method: "GET",
    namespace: "account",
    action: "penalties",
    path: "/api/account/penalties",
    summary: "Get active account penalties",
    responseSchema: "Penalty",
  },
  {
    method: "GET",
    namespace: "account",
    action: "favourites",
    path: "/api/account/favourites",
    summary: "Get favorited skins",
    responseSchema: "Favourite",
  },
  {
    method: "GET",
    namespace: "account",
    action: "session",
    path: "/api/account/session",
    summary: "Get client session loop state",
    responseSchema: "GameSession",
  },
  {
    method: "GET",
    namespace: "account",
    action: "config",
    path: "/api/account/config",
    summary: "Get shared client configuration",
  },
  {
    method: "GET",
    namespace: "account",
    action: "settings",
    path: "/api/account/settings",
    summary: "Get cloud player settings",
    responseSchema: "PlayerSettings",
  },
  {
    method: "GET",
    namespace: "account",
    action: "client",
    path: "/api/account/client",
    summary: "Get client identity and locale",
    responseSchema: "ClientInfo",
  },
  {
    method: "GET",
    namespace: "account",
    action: "exportLoadout",
    path: "/api/account/exportLoadout",
    summary: "Export loadout as preset",
  },
  {
    method: "POST",
    namespace: "account",
    action: "equip",
    path: "/api/account/equip",
    summary: "Equip skins, buddies, sprays, or cards",
    responseSchema: "Loadout",
  },
  {
    method: "POST",
    namespace: "account",
    action: "equipCollection",
    path: "/api/account/equipCollection",
    summary: "Equip a skin collection",
    responseSchema: "Loadout",
  },
  {
    method: "POST",
    namespace: "account",
    action: "equipPreset",
    path: "/api/account/equipPreset",
    summary: "Equip a full loadout preset",
    responseSchema: "Loadout",
  },
  {
    method: "POST",
    namespace: "account",
    action: "diffLoadout",
    path: "/api/account/diffLoadout",
    summary: "Compare loadout against preset",
    responseSchema: "LoadoutDiff",
  },
  {
    method: "POST",
    namespace: "account",
    action: "activateContract",
    path: "/api/account/activateContract",
    summary: "Activate an agent contract",
  },
  {
    method: "POST",
    namespace: "account",
    action: "addFavourite",
    path: "/api/account/addFavourite",
    summary: "Add skin to favourites",
  },
  {
    method: "POST",
    namespace: "account",
    action: "removeFavourite",
    path: "/api/account/removeFavourite",
    summary: "Remove skin from favourites",
  },
  {
    method: "POST",
    namespace: "account",
    action: "setActRankBadgeHidden",
    path: "/api/account/setActRankBadgeHidden",
    summary: "Hide or show act rank badge",
  },
  {
    method: "POST",
    namespace: "account",
    action: "setLeaderboardAnonymized",
    path: "/api/account/setLeaderboardAnonymized",
    summary: "Anonymize or reveal leaderboard presence",
  },
  {
    method: "POST",
    namespace: "account",
    action: "saveSettings",
    path: "/api/account/saveSettings",
    summary: "Save cloud player settings",
    isConfirmGated: true,
    responseSchema: "PlayerSettings",
  },

  {
    method: "GET",
    namespace: "social",
    action: "friends",
    path: "/api/social/friends",
    summary: "Get friends list and presence",
    responseSchema: "Friend",
  },
  {
    method: "GET",
    namespace: "social",
    action: "friendRequests",
    path: "/api/social/friendRequests",
    summary: "Get friend requests",
    responseSchema: "FriendRequest",
  },
  {
    method: "GET",
    namespace: "social",
    action: "blocked",
    path: "/api/social/blocked",
    summary: "Get blocked players",
    responseSchema: "BlockedPlayer",
  },
  {
    method: "GET",
    namespace: "social",
    action: "conversations",
    path: "/api/social/conversations",
    summary: "Get chat conversations",
    responseSchema: "Conversation",
  },
  {
    method: "GET",
    namespace: "social",
    action: "messages",
    path: "/api/social/messages",
    summary: "Get chat messages",
    responseSchema: "Message",
    params: [
      {
        name: "cid",
        type: "string",
        description: "Conversation ID to filter messages",
      },
    ],
  },
  {
    method: "GET",
    namespace: "social",
    action: "participants",
    path: "/api/social/participants",
    summary: "Get chat participants",
    responseSchema: "Participant",
    params: [
      {
        name: "cid",
        type: "string",
        description: "Conversation ID to filter participants",
      },
    ],
  },
  {
    method: "POST",
    namespace: "social",
    action: "sendMessage",
    path: "/api/social/sendMessage",
    summary: "Send a chat message",
    responseSchema: "Message",
  },
  {
    method: "POST",
    namespace: "social",
    action: "sendFriendRequest",
    path: "/api/social/sendFriendRequest",
    summary: "Send a friend request",
    responseSchema: "FriendRequest",
  },
  {
    method: "POST",
    namespace: "social",
    action: "acceptFriendRequest",
    path: "/api/social/acceptFriendRequest",
    summary: "Accept a friend request",
    responseSchema: "Friend",
  },
  {
    method: "POST",
    namespace: "social",
    action: "declineFriendRequest",
    path: "/api/social/declineFriendRequest",
    summary: "Decline a friend request",
    responseSchema: "FriendRequest",
  },
  {
    method: "POST",
    namespace: "social",
    action: "cancelFriendRequest",
    path: "/api/social/cancelFriendRequest",
    summary: "Cancel an outgoing friend request",
    responseSchema: "FriendRequest",
  },
  {
    method: "POST",
    namespace: "social",
    action: "removeFriend",
    path: "/api/social/removeFriend",
    summary: "Remove a friend",
    responseSchema: "Friend",
  },
  {
    method: "POST",
    namespace: "social",
    action: "blockPlayer",
    path: "/api/social/blockPlayer",
    summary: "Block a player",
    responseSchema: "BlockedPlayer",
  },
  {
    method: "POST",
    namespace: "social",
    action: "unblockPlayer",
    path: "/api/social/unblockPlayer",
    summary: "Unblock a player",
    responseSchema: "BlockedPlayer",
  },

  {
    method: "GET",
    namespace: "store",
    action: "current",
    path: "/api/store/current",
    summary: "Get current store offers and storefront",
    responseSchema: "Store",
    params: [
      {
        name: "language",
        type: "string",
        description: "Locale code for localized item names",
      },
    ],
  },
  {
    method: "GET",
    namespace: "store",
    action: "store",
    path: "/api/store/store",
    summary: "Get storefront alias",
    alias: true,
    responseSchema: "Store",
    params: [
      {
        name: "language",
        type: "string",
        description: "Locale code for localized item names",
      },
    ],
  },
  {
    method: "GET",
    namespace: "store",
    action: "offers",
    path: "/api/store/offers",
    summary: "Get all item offers and pricing",
    responseSchema: "Offer",
  },
  {
    method: "GET",
    namespace: "store",
    action: "order",
    path: "/api/store/order",
    summary: "Get store order details",
    responseSchema: "Order",
    params: [
      {
        name: "id",
        type: "string",
        description: "Order ID",
        required: true,
      },
    ],
  },
  {
    method: "GET",
    namespace: "store",
    action: "history",
    path: "/api/store/history",
    summary: "Get recorded store rotation history",
    responseSchema: "StoreHistory",
    params: [
      {
        name: "days",
        type: "number",
        description: "Number of past days to query",
      },
    ],
  },
  {
    method: "GET",
    namespace: "store",
    action: "seen",
    path: "/api/store/seen",
    summary: "Get when a skin was last seen in store",
    params: [
      {
        name: "skin",
        type: "string",
        description: "Skin name or UUID to check",
        required: true,
      },
    ],
  },
  {
    method: "POST",
    namespace: "store",
    action: "revealNightMarket",
    path: "/api/store/revealNightMarket",
    summary: "Reveal night market cards",
    responseSchema: "Store",
  },
  {
    method: "POST",
    namespace: "store",
    action: "buy",
    path: "/api/store/buy",
    summary: "Purchase store offer or bundle",
    isConfirmGated: true,
    responseSchema: "Order",
  },
  {
    method: "GET",
    namespace: "store",
    action: "wishlist",
    path: "/api/store/wishlist",
    summary: "Get current skin wishlist",
    responseSchema: "Wishlist",
  },
  {
    method: "GET",
    namespace: "store",
    action: "wishlistCheck",
    path: "/api/store/wishlistCheck",
    summary: "Check current store offers against wishlist",
    responseSchema: "WishlistCheck",
  },
  {
    method: "POST",
    namespace: "store",
    action: "wishlistAdd",
    path: "/api/store/wishlistAdd",
    summary: "Add skin to wishlist",
    responseSchema: "Wishlist",
    params: [
      {
        name: "skin",
        type: "string",
        description: "Skin name or UUID to add",
        required: true,
      },
    ],
  },
  {
    method: "POST",
    namespace: "store",
    action: "wishlistRemove",
    path: "/api/store/wishlistRemove",
    summary: "Remove skin from wishlist",
    responseSchema: "Wishlist",
    params: [
      {
        name: "skin",
        type: "string",
        description: "Skin name or UUID to remove",
        required: true,
      },
    ],
  },
  {
    method: "GET",
    namespace: "store",
    action: "skins",
    path: "/api/store/skins",
    summary: "Get purchasable weapon skins for autocomplete",
    responseSchema: "CatalogSkin",
  },

  {
    method: "GET",
    namespace: "matches",
    action: "list",
    path: "/api/matches/list",
    summary: "List recent match summaries",
    responseSchema: "MatchSummary",
    params: [
      {
        name: "count",
        type: "number",
        description: "Number of matches to return",
      },
      {
        name: "queue",
        type: "string",
        description: "Match queue type (e.g. competitive, unrated)",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "matches",
    path: "/api/matches/matches",
    summary: "List match summaries alias",
    alias: true,
    responseSchema: "MatchSummary",
    params: [
      {
        name: "count",
        type: "number",
        description: "Number of matches to return",
      },
      {
        name: "queue",
        type: "string",
        description: "Match queue type (e.g. competitive, unrated)",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "sync",
    path: "/api/matches/sync",
    summary: "Synchronize matches into cache",
    responseSchema: "MatchSyncResult",
    params: [
      {
        name: "maxPages",
        type: "number",
        description: "Maximum number of history pages to fetch",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "known",
    path: "/api/matches/known",
    summary: "Get cached match summaries",
    responseSchema: "MatchSummary",
    params: [
      {
        name: "puuid",
        type: "string",
        description: "Target player PUUID (defaults to signed-in player)",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "get",
    path: "/api/matches/get",
    summary: "Get full match details by ID",
    responseSchema: "Match",
    params: [
      {
        name: "id",
        type: "string",
        description: "Match ID",
        required: true,
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "match",
    path: "/api/matches/match",
    summary: "Get match details alias",
    alias: true,
    responseSchema: "Match",
    params: [
      {
        name: "id",
        type: "string",
        description: "Match ID",
        required: true,
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "mmr",
    path: "/api/matches/mmr",
    summary: "Get current MMR and rating",
    responseSchema: "Mmr",
  },
  {
    method: "GET",
    namespace: "matches",
    action: "rankHistory",
    path: "/api/matches/rankHistory",
    summary: "Get competitive rating updates",
    responseSchema: "RankChange",
    params: [
      {
        name: "count",
        type: "number",
        description: "Number of rank updates to return",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "live",
    path: "/api/matches/live",
    summary: "Get live pregame or coregame lobby",
    responseSchema: "LiveMatch",
    params: [
      {
        name: "ranks",
        type: "boolean",
        description: "Include player competitive ranks",
      },
      {
        name: "loadouts",
        type: "boolean",
        description: "Include player loadout details",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "listFor",
    path: "/api/matches/listFor",
    summary: "List matches for specific player",
    responseSchema: "MatchSummary",
    params: [
      {
        name: "puuid",
        type: "string",
        description: "Target player PUUID",
        required: true,
      },
      {
        name: "count",
        type: "number",
        description: "Number of matches to return",
      },
      {
        name: "queue",
        type: "string",
        description: "Match queue type",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "mmrFor",
    path: "/api/matches/mmrFor",
    summary: "Get MMR for specific player",
    responseSchema: "Mmr",
    params: [
      {
        name: "puuid",
        type: "string",
        description: "Target player PUUID",
        required: true,
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "rankHistoryFor",
    path: "/api/matches/rankHistoryFor",
    summary: "Get rank history for player",
    responseSchema: "RankChange",
    params: [
      {
        name: "puuid",
        type: "string",
        description: "Target player PUUID",
        required: true,
      },
      {
        name: "count",
        type: "number",
        description: "Number of rank updates to return",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "leaderboard",
    path: "/api/matches/leaderboard",
    summary: "Get competitive leaderboard",
    responseSchema: "Leaderboard",
    params: [
      {
        name: "season",
        type: "string",
        description: "Season or act UUID",
      },
      {
        name: "start",
        type: "number",
        description: "Starting rank offset (0-indexed)",
      },
      {
        name: "size",
        type: "number",
        description: "Number of players to return",
      },
      {
        name: "query",
        type: "string",
        description: "Search query for player name",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "content",
    path: "/api/matches/content",
    summary: "Get seasonal content and acts",
    responseSchema: "Content",
  },
  {
    method: "GET",
    namespace: "matches",
    action: "premier",
    path: "/api/matches/premier",
    summary: "Get premier standings",
    responseSchema: "Premier",
  },
  {
    method: "GET",
    namespace: "matches",
    action: "trend",
    path: "/api/matches/trend",
    summary: "Get competitive rating trend",
    responseSchema: "RatingTrend",
    params: [
      {
        name: "count",
        type: "number",
        description: "Number of matches to evaluate",
      },
      {
        name: "puuid",
        type: "string",
        description: "Target player PUUID",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "summary",
    path: "/api/matches/summary",
    summary: "Get recent performance summary",
    responseSchema: "PerformanceSummary",
    params: [
      {
        name: "count",
        type: "number",
        description: "Number of matches to summarize",
      },
      {
        name: "queue",
        type: "string",
        description: "Match queue type",
      },
      {
        name: "puuid",
        type: "string",
        description: "Target player PUUID",
      },
    ],
  },
  {
    method: "GET",
    namespace: "matches",
    action: "assess",
    path: "/api/matches/assess",
    summary: "Assess player rank anomalies",
    responseSchema: "PlayerAssessment",
    params: [
      {
        name: "puuid",
        type: "string",
        description: "Target player PUUID (defaults to signed-in player)",
      },
    ],
  },
  {
    method: "POST",
    namespace: "matches",
    action: "selectAgent",
    path: "/api/matches/selectAgent",
    summary: "Select pregame agent",
    responseSchema: "LiveMatch",
  },
  {
    method: "POST",
    namespace: "matches",
    action: "lockAgent",
    path: "/api/matches/lockAgent",
    summary: "Lock pregame agent",
    responseSchema: "LiveMatch",
  },
  {
    method: "POST",
    namespace: "matches",
    action: "dodge",
    path: "/api/matches/dodge",
    summary: "Dodge pregame agent select",
    isConfirmGated: true,
  },
  {
    method: "POST",
    namespace: "matches",
    action: "leaveMatch",
    path: "/api/matches/leaveMatch",
    summary: "Leave active match",
    isConfirmGated: true,
  },

  {
    method: "GET",
    namespace: "party",
    action: "current",
    path: "/api/party/current",
    summary: "Get current party details",
    responseSchema: "Party",
  },
  {
    method: "GET",
    namespace: "party",
    action: "party",
    path: "/api/party/party",
    summary: "Get party alias",
    alias: true,
    responseSchema: "Party",
  },
  {
    method: "GET",
    namespace: "party",
    action: "queues",
    path: "/api/party/queues",
    summary: "Get matchmaking queues",
    responseSchema: "QueueConfig",
  },
  {
    method: "GET",
    namespace: "party",
    action: "customGameConfigs",
    path: "/api/party/customGameConfigs",
    summary: "Get custom game configs",
    responseSchema: "CustomGameConfigs",
  },
  {
    method: "GET",
    namespace: "party",
    action: "invites",
    path: "/api/party/invites",
    summary: "Get party invites",
    responseSchema: "PartyInvite",
  },
  {
    method: "GET",
    namespace: "party",
    action: "requests",
    path: "/api/party/requests",
    summary: "Get party join requests",
    responseSchema: "PartyRequest",
  },
  {
    method: "POST",
    namespace: "party",
    action: "invite",
    path: "/api/party/invite",
    summary: "Invite player to party",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "kick",
    path: "/api/party/kick",
    summary: "Kick player from party",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "promote",
    path: "/api/party/promote",
    summary: "Promote player to party leader",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "createInviteCode",
    path: "/api/party/createInviteCode",
    summary: "Generate party code",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "revokeInviteCode",
    path: "/api/party/revokeInviteCode",
    summary: "Revoke party code",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "joinByCode",
    path: "/api/party/joinByCode",
    summary: "Join party using code",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "setReady",
    path: "/api/party/setReady",
    summary: "Set party ready status",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "setQueue",
    path: "/api/party/setQueue",
    summary: "Set party matchmaking queue",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "setAccessibility",
    path: "/api/party/setAccessibility",
    summary: "Set party accessibility",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "startMatchmaking",
    path: "/api/party/startMatchmaking",
    summary: "Start matchmaking queue",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "stopMatchmaking",
    path: "/api/party/stopMatchmaking",
    summary: "Stop matchmaking queue",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "leave",
    path: "/api/party/leave",
    summary: "Leave party",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "join",
    path: "/api/party/join",
    summary: "Join party by ID",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "declineInvite",
    path: "/api/party/declineInvite",
    summary: "Decline party invite",
  },
  {
    method: "POST",
    namespace: "party",
    action: "requestToJoin",
    path: "/api/party/requestToJoin",
    summary: "Request to join party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "declineRequest",
    path: "/api/party/declineRequest",
    summary: "Decline join request",
  },
  {
    method: "POST",
    namespace: "party",
    action: "makeCustomGame",
    path: "/api/party/makeCustomGame",
    summary: "Convert party to custom game",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "makeDefault",
    path: "/api/party/makeDefault",
    summary: "Set party default queue",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "setCustomGameSettings",
    path: "/api/party/setCustomGameSettings",
    summary: "Configure custom game",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "setTeam",
    path: "/api/party/setTeam",
    summary: "Set player team in custom game",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "startCustomGame",
    path: "/api/party/startCustomGame",
    summary: "Start custom game match",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "balanceTeams",
    path: "/api/party/balanceTeams",
    summary: "Auto-balance custom game teams",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "setPreferredServers",
    path: "/api/party/setPreferredServers",
    summary: "Set preferred servers",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "setModerator",
    path: "/api/party/setModerator",
    summary: "Set moderator status",
    responseSchema: "Party",
  },
  {
    method: "POST",
    namespace: "party",
    action: "refresh",
    path: "/api/party/refresh",
    summary: "Refresh party state",
    responseSchema: "Party",
  },
  {
    method: "GET",
    namespace: "official",
    action: "account",
    path: "/api/official/account",
    summary: "Resolve any player's account and shard through Riot's official API",
    responseSchema: "OfficialAccount",
    params: [
      { name: "riotId", type: "string", description: "Riot ID as Name#Tag", required: true },
    ],
  },
  {
    method: "GET",
    namespace: "official",
    action: "matches",
    path: "/api/official/matches",
    summary: "Recent match summaries of any player through Riot's official API",
    responseSchema: "MatchSummary",
    params: [
      { name: "riotId", type: "string", description: "Riot ID as Name#Tag", required: true },
      { name: "queue", type: "string", description: "Queue id filter, e.g. competitive" },
      { name: "count", type: "number", description: "Number of matches, default 10" },
    ],
  },
  {
    method: "GET",
    namespace: "official",
    action: "match",
    path: "/api/official/match",
    summary: "Full match details through Riot's official API",
    responseSchema: "Match",
    params: [
      { name: "matchId", type: "string", description: "Match id", required: true },
      {
        name: "shard",
        type: "string",
        description: "Shard: na, latam, br, eu, ap or kr",
        required: true,
      },
      { name: "self", type: "string", description: "Puuid whose point of view to use" },
    ],
  },
  {
    method: "GET",
    namespace: "official",
    action: "summary",
    path: "/api/official/summary",
    summary: "Performance summary of any player through Riot's official API",
    responseSchema: "PerformanceSummary",
    params: [
      { name: "riotId", type: "string", description: "Riot ID as Name#Tag", required: true },
      { name: "queue", type: "string", description: "Queue id, default competitive" },
      { name: "count", type: "number", description: "Number of matches, default 10" },
    ],
  },
  {
    method: "GET",
    namespace: "official",
    action: "profile",
    path: "/api/official/profile",
    summary: "Level, rank and performance of any player through Riot's official API",
    responseSchema: "OfficialProfile",
    params: [
      { name: "riotId", type: "string", description: "Riot ID as Name#Tag", required: true },
      { name: "count", type: "number", description: "Number of matches, default 10" },
    ],
  },
  {
    method: "GET",
    namespace: "official",
    action: "leaderboard",
    path: "/api/official/leaderboard",
    summary: "Ranked leaderboard of a shard through Riot's official API",
    responseSchema: "Leaderboard",
    params: [
      {
        name: "shard",
        type: "string",
        description: "Shard: na, latam, br, eu, ap or kr",
        required: true,
      },
      { name: "act", type: "string", description: "Act id, default the active act" },
      { name: "start", type: "number", description: "Start index, default 0" },
      { name: "size", type: "number", description: "Page size, default 50" },
    ],
  },
  {
    method: "GET",
    namespace: "official",
    action: "status",
    path: "/api/official/status",
    summary: "Platform status of a shard through Riot's official API",
    params: [
      {
        name: "shard",
        type: "string",
        description: "Shard: na, latam, br, eu, ap or kr",
        required: true,
      },
    ],
  },
];

function isDryRun(
  query: Record<string, string>,
  body: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
): boolean {
  if (query.dryRun !== undefined) {
    return query.dryRun === "1" || query.dryRun.toLowerCase() === "true";
  }
  if (headers["x-dry-run"] !== undefined) {
    const val = String(headers["x-dry-run"]).toLowerCase();
    return val === "1" || val === "true";
  }
  if (body.dryRun !== undefined) {
    return Boolean(body.dryRun);
  }
  return true;
}

export async function dispatchApiRoute(
  client: RiotClient,
  namespace: string,
  methodName: string,
  query: Record<string, string>,
  body: Record<string, unknown>,
  req: { method?: string; headers: Record<string, string | string[] | undefined> },
): Promise<unknown> {
  const normMethod = methodName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const routeKey = `${namespace}/${normMethod}`;
  const isWrite = req.method === "POST";
  const dryRun = isDryRun(query, body, req.headers);

  if (isWrite && CONFIRM_GATED_ROUTES.has(routeKey)) {
    const hasConfirmHeader = String(req.headers["x-confirm"] ?? "").toLowerCase() === "yes";
    const hasConfirmBody = body.confirm === true;
    if (!dryRun && (!hasConfirmHeader || !hasConfirmBody)) {
      throw new ValidationError(
        "confirm-required",
        `${normMethod} requires explicit confirmation: header X-Confirm: yes and body { confirm: true }`,
      );
    }
  }

  if (namespace === "account") {
    switch (normMethod) {
      case "whoami":
        return client.account.whoami();
      case "ownedItems":
        return client.account.ownedItems({ language: query.language });
      case "loadout":
        return client.account.loadout();
      case "collectionValue":
        return client.account.collectionValue();
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
      case "settings":
        return client.account.settings();
      case "client":
        return client.account.client();
      case "exportLoadout":
        return client.account.exportLoadout();
      case "diffLoadout":
        return client.account.diffLoadout((body.preset ?? body) as unknown as LoadoutChange);
      case "equip":
        return dryRun
          ? client.account.validateEquip(body as unknown as LoadoutChange)
          : client.account.equip(body as unknown as LoadoutChange);
      case "equipCollection": {
        const uuids = (body.skinUuids ?? body) as string[];
        return dryRun
          ? client.account.validateEquipCollection(uuids)
          : client.account.equipCollection(uuids);
      }
      case "equipPreset":
        return dryRun
          ? client.account.validateEquipPreset(body as unknown as LoadoutChange)
          : client.account.equipPreset(body as unknown as LoadoutChange);
      case "activateContract": {
        const uuid = String(body.uuid ?? body.contractId ?? query.uuid);
        return dryRun
          ? client.account.validateActivateContract(uuid)
          : client.account.activateContract(uuid);
      }
      case "addFavourite": {
        const skin = String(body.skin ?? body.itemId ?? query.skin);
        return dryRun
          ? client.account.validateAddFavourite(skin)
          : client.account.addFavourite(skin);
      }
      case "removeFavourite": {
        const skin = String(body.skin ?? body.itemId ?? query.skin);
        return dryRun
          ? client.account.validateRemoveFavourite(skin)
          : client.account.removeFavourite(skin);
      }
      case "setActRankBadgeHidden": {
        const hidden = Boolean(body.hidden ?? query.hidden === "true");
        return dryRun
          ? client.account.validateSetActRankBadgeHidden(hidden)
          : client.account.setActRankBadgeHidden(hidden);
      }
      case "setLeaderboardAnonymized": {
        const anon = Boolean(body.anonymized ?? query.anonymized === "true");
        return dryRun
          ? client.account.validateSetLeaderboardAnonymized(anon)
          : client.account.setLeaderboardAnonymized(anon);
      }
      case "saveSettings": {
        const data = body.data ?? body;
        return dryRun
          ? client.account.validateSaveSettings(data, { confirm: true })
          : client.account.saveSettings(data, { confirm: true });
      }
    }
  }

  if (namespace === "social") {
    switch (normMethod) {
      case "friends":
        return client.social.friends();
      case "friendRequests":
        return client.social.friendRequests();
      case "blocked":
        return client.social.blocked();
      case "conversations":
        return client.social.conversations();
      case "messages":
        return client.social.messages(query.cid ?? query.conversationId);
      case "participants":
        return client.social.participants(query.cid ?? query.conversationId);
      case "sendMessage": {
        const target = (body.to ?? {
          puuid: String(body.puuid ?? ""),
          conversationId: String(body.cid ?? ""),
        }) as { puuid: string } | { conversationId: string } | { riotId: string };
        const text = String(body.text ?? "");
        return dryRun
          ? client.social.validateSendMessage(target, text)
          : client.social.sendMessage(target, text);
      }
      case "sendFriendRequest": {
        const riotId = String(body.riotId ?? query.riotId);
        return dryRun
          ? client.social.validateSendFriendRequest(riotId)
          : client.social.sendFriendRequest(riotId);
      }
      case "acceptFriendRequest": {
        const puuid = String(body.puuid ?? query.puuid);
        return dryRun
          ? client.social.validateAcceptFriendRequest(puuid)
          : client.social.acceptFriendRequest(puuid);
      }
      case "declineFriendRequest": {
        const puuid = String(body.puuid ?? query.puuid);
        return dryRun
          ? client.social.validateDeclineFriendRequest(puuid)
          : client.social.declineFriendRequest(puuid);
      }
      case "cancelFriendRequest": {
        const puuid = String(body.puuid ?? query.puuid);
        return dryRun
          ? client.social.validateCancelFriendRequest(puuid)
          : client.social.cancelFriendRequest(puuid);
      }
      case "removeFriend": {
        const puuid = String(body.puuid ?? query.puuid);
        return dryRun
          ? client.social.validateRemoveFriend(puuid)
          : client.social.removeFriend(puuid);
      }
      case "blockPlayer": {
        const target = String(body.target ?? body.puuid ?? query.target);
        return dryRun
          ? client.social.validateBlockPlayer(target)
          : client.social.blockPlayer(target);
      }
      case "unblockPlayer": {
        const puuid = String(body.puuid ?? query.puuid);
        return dryRun
          ? client.social.validateUnblockPlayer(puuid)
          : client.social.unblockPlayer(puuid);
      }
    }
  }

  if (namespace === "store") {
    switch (normMethod) {
      case "current":
      case "store":
        return client.store.current({ language: query.language });
      case "offers":
        return client.store.offers();
      case "order":
        return client.store.order(query.id);
      case "history":
        return client.store.history({ days: query.days ? Number(query.days) : undefined });
      case "seen":
        return client.store.seen(query.skin);
      case "revealNightMarket":
        return dryRun ? client.store.validateRevealNightMarket() : client.store.revealNightMarket();
      case "buy": {
        const target = (body.target ?? body) as unknown as BuyTarget;
        return dryRun
          ? client.store.validateBuy(target, { confirm: true })
          : client.store.buy(target, { confirm: true });
      }
      case "wishlist":
        return client.store.wishlist();
      case "wishlistCheck":
        return client.store.wishlistCheck();
      case "wishlistAdd":
        return client.store.wishlistAdd(String(body.skin ?? query.skin));
      case "wishlistRemove":
        return client.store.wishlistRemove(String(body.skin ?? query.skin));
      case "skins":
        return client.store.skins();
    }
  }

  if (namespace === "matches") {
    switch (normMethod) {
      case "list":
      case "matches":
        return client.matches.list({
          count: query.count ? Number(query.count) : undefined,
          queue: query.queue,
        });
      case "sync":
        return client.matches.sync({
          maxPages: query.maxPages
            ? Number(query.maxPages)
            : query.pages
              ? Number(query.pages)
              : undefined,
        });
      case "known":
        return client.matches.known(query.puuid);
      case "get":
      case "match":
        return client.matches.get(query.id);
      case "mmr":
        return client.matches.mmr();
      case "rankHistory":
        return client.matches.rankHistory({ count: query.count ? Number(query.count) : undefined });
      case "live":
        return client.matches.live({
          ranks: query.ranks === "true" || query.ranks === "1",
          loadouts: query.loadouts !== "false" && query.loadouts !== "0",
        });
      case "listFor":
        return client.matches.listFor(query.puuid, {
          count: query.count ? Number(query.count) : undefined,
          queue: query.queue,
        });
      case "mmrFor":
        return client.matches.mmrFor(query.puuid);
      case "rankHistoryFor":
        return client.matches.rankHistoryFor(query.puuid, {
          count: query.count ? Number(query.count) : undefined,
        });
      case "leaderboard":
        return client.matches.leaderboard({
          season: query.season,
          start: query.start ? Number(query.start) : undefined,
          size: query.size ? Number(query.size) : undefined,
          query: query.query,
        });
      case "content":
        return client.matches.content();
      case "premier":
        return client.matches.premier();
      case "trend":
        return client.matches.trend({
          count: query.count ? Number(query.count) : undefined,
          puuid: query.puuid,
        });
      case "summary":
        return client.matches.summary({
          count: query.count ? Number(query.count) : undefined,
          queue: query.queue,
          puuid: query.puuid,
        });
      case "assess":
        return client.matches.assess(query.puuid);
      case "selectAgent": {
        const agent = String(body.agent ?? query.agent);
        return dryRun
          ? client.matches.validateSelectAgent(agent)
          : client.matches.selectAgent(agent);
      }
      case "lockAgent": {
        const agent = String(body.agent ?? query.agent);
        return dryRun ? client.matches.validateLockAgent(agent) : client.matches.lockAgent(agent);
      }
      case "dodge":
        return dryRun
          ? client.matches.validateDodge({ confirm: true })
          : client.matches.dodge({ confirm: true });
      case "leaveMatch":
        return dryRun
          ? client.matches.validateLeaveMatch({ confirm: true })
          : client.matches.leaveMatch({ confirm: true });
    }
  }

  if (namespace === "party") {
    switch (normMethod) {
      case "current":
      case "party":
        return client.party.current();
      case "queues":
        return client.party.queues();
      case "customGameConfigs":
        return client.party.customGameConfigs();
      case "invites":
        return client.party.invites();
      case "requests":
        return client.party.requests();
      case "invite": {
        const riotId = String(body.riotId ?? query.riotId);
        return dryRun ? client.party.validateInvite(riotId) : client.party.invite(riotId);
      }
      case "kick": {
        const puuid = String(body.puuid ?? query.puuid);
        return dryRun ? client.party.validateKick(puuid) : client.party.kick(puuid);
      }
      case "promote": {
        const puuid = String(body.puuid ?? query.puuid);
        return dryRun ? client.party.validatePromote(puuid) : client.party.promote(puuid);
      }
      case "createInviteCode":
        return dryRun ? client.party.validateCreateInviteCode() : client.party.createInviteCode();
      case "revokeInviteCode":
        return dryRun ? client.party.validateRevokeInviteCode() : client.party.revokeInviteCode();
      case "joinByCode": {
        const code = String(body.code ?? query.code);
        return dryRun ? client.party.validateJoinByCode(code) : client.party.joinByCode(code);
      }
      case "setReady": {
        const ready = Boolean(body.ready ?? query.ready === "true");
        return dryRun ? client.party.validateSetReady(ready) : client.party.setReady(ready);
      }
      case "setQueue": {
        const queue = String(body.queue ?? query.queue);
        return dryRun ? client.party.validateSetQueue(queue) : client.party.setQueue(queue);
      }
      case "setAccessibility": {
        const acc = (body.accessibility ?? query.accessibility) as "open" | "closed";
        return dryRun
          ? client.party.validateSetAccessibility(acc)
          : client.party.setAccessibility(acc);
      }
      case "startMatchmaking":
        return dryRun ? client.party.validateStartMatchmaking() : client.party.startMatchmaking();
      case "stopMatchmaking":
        return dryRun ? client.party.validateStopMatchmaking() : client.party.stopMatchmaking();
      case "leave":
        return dryRun ? client.party.validateLeave() : client.party.leave();
      case "join": {
        const partyId = String(body.partyId ?? query.partyId);
        return dryRun ? client.party.validateJoin(partyId) : client.party.join(partyId);
      }
      case "declineInvite": {
        const inviteId = String(body.inviteId ?? query.inviteId);
        return dryRun
          ? client.party.validateDeclineInvite(inviteId)
          : client.party.declineInvite(inviteId);
      }
      case "requestToJoin": {
        const partyId = String(body.partyId ?? query.partyId);
        return dryRun
          ? client.party.validateRequestToJoin(partyId)
          : client.party.requestToJoin(partyId);
      }
      case "declineRequest": {
        const requestId = String(body.requestId ?? query.requestId);
        return dryRun
          ? client.party.validateDeclineRequest(requestId)
          : client.party.declineRequest(requestId);
      }
      case "makeCustomGame":
        return dryRun ? client.party.validateMakeCustomGame() : client.party.makeCustomGame();
      case "makeDefault": {
        const queue = String(body.queue ?? query.queue);
        return dryRun ? client.party.validateMakeDefault(queue) : client.party.makeDefault(queue);
      }
      case "setCustomGameSettings": {
        const settings = (body.settings ?? body) as unknown as CustomGameSettings;
        return dryRun
          ? client.party.validateSetCustomGameSettings(settings)
          : client.party.setCustomGameSettings(settings);
      }
      case "setTeam": {
        const puuid = String(body.puuid ?? query.puuid);
        const team = String(body.team ?? query.team);
        return dryRun
          ? client.party.validateSetTeam(puuid, team)
          : client.party.setTeam(puuid, team);
      }
      case "startCustomGame":
        return dryRun ? client.party.validateStartCustomGame() : client.party.startCustomGame();
      case "balanceTeams":
        return dryRun ? client.party.validateBalanceTeams() : client.party.balanceTeams();
      case "setPreferredServers": {
        const ids = (body.ids ?? body) as string[];
        return dryRun
          ? client.party.validateSetPreferredServers(ids)
          : client.party.setPreferredServers(ids);
      }
      case "setModerator": {
        const puuid = String(body.puuid ?? query.puuid);
        const isMod = Boolean(body.isModerator ?? query.isModerator === "true");
        return dryRun
          ? client.party.validateSetModerator(puuid, isMod)
          : client.party.setModerator(puuid, isMod);
      }
      case "refresh":
        return dryRun ? client.party.validateRefresh() : client.party.refresh();
    }
  }

  const official = namespace === "official" && dispatchOfficialRoute(client, normMethod, query);
  if (official) return official;

  throw new ValidationError(
    "route-not-found",
    `Unknown endpoint: ${req.method} /api/${namespace}/${methodName}`,
  );
}

function optionalNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function dispatchOfficialRoute(
  client: RiotClient,
  method: string,
  query: Record<string, string>,
): Promise<unknown> | undefined {
  const count = optionalNumber(query.count);
  switch (method) {
    case "account":
      return client.official.account(query.riotId ?? "");
    case "matches":
      return client.official.matches(query.riotId ?? "", { queue: query.queue, count });
    case "match":
      return client.official.match(query.matchId ?? "", {
        shard: query.shard ?? "",
        self: query.self,
      });
    case "summary":
      return client.official.summary(query.riotId ?? "", { queue: query.queue, count });
    case "profile":
      return client.official.profile(query.riotId ?? "", { count });
    case "leaderboard":
      return client.official.leaderboard({
        shard: query.shard ?? "",
        act: query.act,
        start: optionalNumber(query.start),
        size: optionalNumber(query.size),
      });
    case "status":
      return client.official.status(query.shard ?? "");
    default:
      return undefined;
  }
}
