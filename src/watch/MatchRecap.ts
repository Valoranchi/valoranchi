import type { Match, MatchPlayer } from "../model/index.js";

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  color: number;
  fields: DiscordEmbedField[];
}

export interface DiscordRecapPayload {
  embeds: DiscordEmbed[];
}

export interface MatchRecapOptions {
  rrChange?: number | null;
  selfPuuid?: string;
}

function resolveSelfPlayer(
  match: Match,
  selfPuuid?: string,
): MatchPlayer | undefined {
  if (selfPuuid) {
    const byPuuid = match.players.find((p) => p.puuid === selfPuuid);
    if (byPuuid) return byPuuid;
  }
  if (match.self?.team) {
    const byTeam = match.players.find((p) => p.team === match.self?.team);
    if (byTeam) return byTeam;
  }
  return match.players[0];
}

function resolveOutcome(match: Match, allyScore: number, enemyScore: number): string {
  if (match.self?.won === true) return "Victory";
  if (match.self?.won === false) return "Defeat";
  if (allyScore > enemyScore) return "Victory";
  if (enemyScore > allyScore) return "Defeat";
  return "Draw";
}

export function buildMatchRecapDiscord(
  match: Match,
  options?: MatchRecapOptions,
): DiscordRecapPayload {
  const mapName = match.map.name ?? "Unknown Map";
  const allyTeam = match.self?.team
    ? match.teams.find((t) => t.id === match.self?.team)
    : match.teams[0];
  const enemyTeam = match.self?.team
    ? match.teams.find((t) => t.id !== match.self?.team)
    : match.teams[1];

  const allyScore = allyTeam?.roundsWon ?? 0;
  const enemyScore = enemyTeam?.roundsWon ?? 0;
  const outcome = resolveOutcome(match, allyScore, enemyScore);
  const color = outcome === "Victory" ? 0x2ecc71 : outcome === "Defeat" ? 0xe74c3c : 0x95a5a6;

  const player = resolveSelfPlayer(match, options?.selfPuuid);
  const stats = player?.stats;
  const rounds = stats?.roundsPlayed && stats.roundsPlayed > 0
    ? stats.roundsPlayed
    : allyScore + enemyScore;
  const score = stats?.score ?? 0;
  const acs = rounds > 0 ? Math.round(score / rounds) : 0;

  const headshots = stats?.headshots ?? 0;
  const bodyshots = stats?.bodyshots ?? 0;
  const legshots = stats?.legshots ?? 0;
  const totalShots = headshots + bodyshots + legshots;
  const hsPercent = totalShots > 0 ? Math.round((headshots / totalShots) * 100) : 0;

  const fields: DiscordEmbedField[] = [
    {
      name: "K/D/A",
      value: `${stats?.kills ?? 0}/${stats?.deaths ?? 0}/${stats?.assists ?? 0}`,
      inline: true,
    },
    { name: "ACS", value: String(acs), inline: true },
    { name: "HS%", value: `${hsPercent}%`, inline: true },
    { name: "Agent", value: player?.agent?.name ?? "Unknown", inline: true },
  ];

  if (options?.rrChange !== null && options?.rrChange !== undefined) {
    const change = options.rrChange;
    const sign = change > 0 ? `+${change}` : String(change);
    fields.push({ name: "RR Change", value: sign, inline: true });
  }

  return {
    embeds: [
      {
        title: `${mapName} · ${outcome} ${allyScore}:${enemyScore}`,
        color,
        fields,
      },
    ],
  };
}

export function buildMatchRecap(
  match: Match,
  isDiscord: boolean,
  options?: MatchRecapOptions,
): DiscordRecapPayload | Match {
  if (isDiscord) {
    return buildMatchRecapDiscord(match, options);
  }
  return match;
}
