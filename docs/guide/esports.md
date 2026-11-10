# Esports

`client.esports` reads the VALORANT esports that the game's hub shows: leagues, tournaments and teams, rosters, brackets and standings, matches with their results and streams, and the windows when a league is live. It only reads, and it goes through the same session as the rest of the client.

| Method                            | Gives                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `overview({ locale, leagueIds })` | `leagues`, `tournaments` and `teams`                                            |
| `upcoming({ locale, leagueIds })` | Matches that have not started, in the shape `matches()` returns                 |
| `live({ locale, leagueIds })`     | The windows in which the matches and tournaments are live                       |
| `matches(matchIds, { locale })`   | Matches with their teams, results, game wins, state and streams                 |
| `stages(stageIds, { locale })`    | Stages with their sections: the rounds, the matches of each round and standings |
| `roster(teamId, { locale })`      | The players and coaches of a team, with their role                              |

`locale` defaults to `"en-US"`. `leagueIds` defaults to `VCT_LEAGUE_IDS`, the seven leagues the game asks for itself: Champions, Masters, VCT Americas, VCT EMEA, VCT Pacific, VCT CN and Game Changers Championship.

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();

const { leagues, teams } = await client.esports.overview({ locale: "es-ES" });
console.log(leagues.map((league) => league.name));

const [team] = teams;
if (team) {
  const players = await client.esports.roster(team.id);
  console.log(players.map((player) => `${player.handle} ${player.roleName ?? ""}`));
}

for (const match of await client.esports.upcoming()) {
  console.log(match.startsAt, match.stageName);
}
```

Notes:

- `streams` only comes filled for matches that are live. Other matches come with an empty list. Each stream has a `url` for Twitch and YouTube, and `null` for any other provider.
- `state` is `unstarted`, `inProgress` or `completed`. A value Riot sends that is not one of them is `unknown`.
- A team's `result` is `win`, `loss` or `tie`, or `null` when the match has none yet.
- `matches([])` and `stages([])` return an empty list without a request. `roster("")` throws a `ValidationError`.
- Image URLs come back as `https`.
