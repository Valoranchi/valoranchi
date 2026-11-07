# Analytics

The `analytics` capabilities provide derived metrics, competitive trends, performance summaries, player assessments, and inventory valuation. All computations run locally on data fetched by the library without calling undocumented or risky third-party APIs.

## Methods

### matches.trend

Computes competitive rating progression, streaks, net Rating Point (RR) movement, pace, and distance to rank promotion or demotion from the player's recent competitive updates (up to 20 matches by default).

```ts
const trend = await client.matches.trend({ count: 20 });
console.log(`Pace: ${trend.pace}, Streak: ${trend.streak.kind} x${trend.streak.length}`);
console.log(`Net RR (last 10): ${trend.net.last10}`);
```

```bash
riotclient trend
```

```json
{
  "streak": {
    "kind": "win",
    "length": 3
  },
  "net": {
    "last5": 42,
    "last10": 68,
    "last20": 95
  },
  "winRate": 0.65,
  "perGame": {
    "averageGain": 21.5,
    "averageLoss": 16.2
  },
  "toNextRank": {
    "rating": 35,
    "winsAtCurrentPace": 2
  },
  "toDemotion": {
    "rating": 65,
    "lossesAtCurrentPace": 6
  },
  "pace": "climbing"
}
```

#### Fields

- `streak`: Current consecutive win or loss streak (`kind`: `"win"` | `"loss"` | `null`, `length`: count of games).
- `net`: Total RR delta over the last 5, 10, and 20 competitive matches.
- `winRate`: Proportion of wins in the analyzed sample (0.0 to 1.0).
- `perGame`: Average RR gained per win (`averageGain`) and RR lost per defeat (`averageLoss`).
- `toNextRank`: RR remaining to reach 100 RR for promotion, with estimated `winsAtCurrentPace`.
- `toDemotion`: RR left above 0 RR, with estimated `lossesAtCurrentPace`: the losses that reach 0 RR plus the one taken there, which is what demotes.
- `pace`: Trend momentum category based on the last 10 games:
  - `"climbing"`: Net RR > +15.
  - `"falling"`: Net RR < -15.
  - `"holding"`: Net RR between -15 and +15.

---

### matches.summary

Aggregates detailed match stats across the signed-in player's recent match history (default 10, capped at 50). Matches are fetched sequentially with 250ms spacing and stored in the 30-day response cache to prevent rate limits.

```ts
const summary = await client.matches.summary({
  count: 10,
  queue: "competitive",
  onProgress: (fetched, total) => {
    console.log(`Fetched match details: ${fetched}/${total}`);
  },
});

console.log(`Overall K/D: ${summary.overall.kd}, Win Rate: ${summary.overall.winRate}`);
if (summary.best.agent) {
  console.log(`Best Agent: ${summary.best.agent.name} (${summary.best.agent.winRate * 100}%)`);
}
```

```bash
riotclient summary --count 10 --queue competitive
```

```json
{
  "overall": {
    "games": 10,
    "wins": 7,
    "winRate": 0.7,
    "kd": 1.35,
    "kda": 1.72,
    "headshotRate": 0.28,
    "averageScore": 245.8,
    "averageDamagePerRound": 158.4,
    "firstBloodsPerGame": 3.2,
    "plantsPerGame": 1.1,
    "defusesPerGame": 0.8
  },
  "byAgent": [
    {
      "uuid": "add6443a-41bd-e414-f6ad-e58d267f4e95",
      "name": "Jett",
      "icon": "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png",
      "games": 6,
      "wins": 5,
      "winRate": 0.833,
      "kd": 1.48,
      "kda": 1.82,
      "headshotRate": 0.3,
      "averageScore": 268.0,
      "averageDamagePerRound": 172.5,
      "firstBloodsPerGame": 4.1,
      "plantsPerGame": 0.5,
      "defusesPerGame": 0.6
    }
  ],
  "byMap": [
    {
      "uuid": "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
      "name": "Ascent",
      "icon": "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/displayicon.png",
      "games": 4,
      "wins": 3,
      "winRate": 0.75,
      "kd": 1.25,
      "kda": 1.6,
      "headshotRate": 0.26,
      "averageScore": 235.0,
      "averageDamagePerRound": 150.0,
      "firstBloodsPerGame": 2.8,
      "plantsPerGame": 1.5,
      "defusesPerGame": 1.0
    }
  ],
  "best": {
    "agent": { "name": "Jett", "winRate": 0.833, "kd": 1.48 },
    "map": { "name": "Ascent", "winRate": 0.75, "kd": 1.25 }
  },
  "worst": {
    "agent": null,
    "map": null
  },
  "consistency": {
    "scoreStdDev": 42.6,
    "gamesNonNegative": 8,
    "longestNonNegativeStreak": 6
  }
}
```

#### Highlights & Best/Worst Rules

- `best` and `worst` select the standout agent and map based on highest / lowest win rate, broken by K/D ratio. A minimum sample of **3 games** is required for an agent or map to qualify for best or worst status.
- `consistency.gamesNonNegative`: Number of games where kills $\ge$ deaths.
- `consistency.longestNonNegativeStreak`: Maximum consecutive games maintaining a non-negative K/D ratio.

---

### matches.assess & Live Warnings

Evaluates a player's rank stability, potential smurfing, and anomalies from their account level, MMR fit, and recent competitive match history.

```ts
const assessment = await client.matches.assess("puuid-of-player");
for (const flag of assessment.flags) {
  console.log(`[${flag.flag}] ${flag.reason}`);
}
```

```bash
riotclient assess 4a7b9c1d-1234-5678-9abc-def012345678
```

```json
{
  "puuid": "4a7b9c1d-1234-5678-9abc-def012345678",
  "accountLevel": 22,
  "flags": [
    {
      "flag": "low-level-high-rank",
      "reason": "Account level 22 is below 50 while holding rank Diamond 2"
    }
  ],
  "warnings": ["Account level 22 is below 50 while holding rank Diamond 2"]
}
```

#### Warning Flags

| Flag                  | Trigger Condition                                                                    |
| :-------------------- | :----------------------------------------------------------------------------------- |
| `low-level-high-rank` | Account level under 50 while holding rank Platinum 1 or higher (tier $\ge 15$).      |
| `inflated`            | MMR fit is `"above"` (visible rank is noticeably above hidden MMR; small RR gains).  |
| `underranked`         | MMR fit is `"below"` with two or more ranks discrepancy (hidden MMR is much higher). |
| `long-streak`         | Active win or loss streak of 5 or more games.                                        |
| `new-act`             | Fewer than 5 competitive matches recorded in the current act.                        |

#### Live Match Integration

When calling `client.matches.live({ ranks: true })`, warnings are computed automatically for every player in the lobby and exposed on `LiveMatchPlayer.warnings`:

```bash
riotclient live --ranks
```

---

### account.collectionValue

Calculates the total monetary and upgrade value of owned weapon skins by cross-referencing owned inventory with store offers and bundles from the catalogue.

```ts
const value = await client.account.collectionValue();
console.log(`Total VP: ${value.total.vp}, Radianite: ${value.total.radianite}`);
console.log(`Priced items: ${value.total.priced}/${value.total.totalItems}`);
```

```bash
riotclient collection-value
```

```json
{
  "total": {
    "vp": 35500,
    "radianite": 720,
    "priced": 24,
    "totalItems": 28
  },
  "byWeapon": [
    {
      "name": "Vandal",
      "uuid": "ee61337c-4ab5-9b0f-3f90-46347473887c",
      "vp": 12425,
      "radianite": 280,
      "items": 7,
      "priced": 7
    }
  ],
  "byTier": [
    {
      "name": "Exclusive",
      "uuid": "e046854e-406c-37f4-6607-19a9ba8426fc",
      "vp": 15400,
      "radianite": 320,
      "items": 7,
      "priced": 7
    }
  ],
  "items": [
    {
      "skin": {
        "uuid": "8908f237-47b2-031a-e905-1a89c93cc8f5",
        "name": "Prime Vandal",
        "icon": "https://media.valorant-api.com/weaponskinlevels/7209796e-4f76-88c9-04fa-fb81498b5e9d/displayicon.png"
      },
      "weapon": {
        "uuid": "ee61337c-4ab5-9b0f-3f90-46347473887c",
        "name": "Vandal"
      },
      "tier": {
        "uuid": "e046854e-406c-37f4-6607-19a9ba8426fc",
        "name": "Exclusive",
        "rank": 5,
        "icon": "https://media.valorant-api.com/contenttiers/exclusive.png"
      },
      "vp": 1775,
      "radianite": 40,
      "source": "offer"
    }
  ]
}
```

> [!NOTE]
> **Radianite Calculation Caveat**: Riot Games does not expose historical individual Radianite upgrade purchases through the store endpoints. The Radianite values reported are an **estimate** computed using Riot's standard progression formula: **10 Radianite Points per unlocked level beyond the base level**, plus **15 Radianite Points per unlocked chroma/variant**. Promotional bundles, battle pass progressions, or discounted upgrades may differ from this estimate.
>
> Skins with unlisted prices (e.g. Battlepass skins or promotional rewards) have `vp: null` and are excluded from the `total.vp` figure, but are tracked in `total.totalItems` alongside `total.priced`.
