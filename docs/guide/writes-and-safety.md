# Writes and Safety

All state mutations in `@valoranchi/riot-client` are governed by a strict local validation layer. Before any HTTP request is dispatched to Riot PVP servers, your current session state, inventory, balances, and party conditions are evaluated locally.

If a requested mutation violates game constraints, a `ValidationError` is thrown immediately and zero network traffic is sent.

## The Validation Model

The validation system acts as a protective shield:

1. **Local Pre-flight Check**: Gathers active player data (owned items, party state, match lobby, wallet).
2. **Constraint Enforcement**: Checks ownership, currency requirements, state prerequisites, and format rules.
3. **Dual Confirmation Guard**: Enforces explicit opt-in for disruptive or irreversible operations.
4. **Network Dispatch**: Transmits the request only when all validation checks succeed.

## Validation Reasons Grouped by Area

When a validation rule fails, the library raises a `ValidationError` containing a machine-readable `reason`, a descriptive `message`, and contextual `details`.

### Account

| Reason                    | Description                                                                                                     |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------- |
| `contract-not-agent`      | Attempted to activate a non-agent contract (e.g. battlepass or event pass).                                     |
| `agent-owned`             | Attempted to activate a contract for an agent that is already unlocked.                                         |
| `contract-active`         | Attempted to activate an agent contract that is already active.                                                 |
| `not-favourite`           | Attempted to remove a skin from favourites that is not currently favorited.                                     |
| `already-favourite`       | Attempted to add a skin to favourites that is already marked as favourite.                                      |
| `preferences-unavailable` | Attempted to read or save cloud player settings while neither Riot's preferences service nor VALORANT answered. |

### Loadout

| Reason                      | Description                                                                  |
| :-------------------------- | :--------------------------------------------------------------------------- |
| `weapon-unknown`            | Weapon identifier or name does not exist in the catalogue.                   |
| `skin-not-owned`            | The specified weapon skin is not in the player's owned inventory.            |
| `level-not-owned`           | The specified skin level has not been unlocked with Radianite.               |
| `chroma-not-owned`          | The specified skin chroma variant has not been unlocked.                     |
| `buddy-not-owned`           | Gun buddy is not owned in inventory.                                         |
| `buddy-instances-exhausted` | All owned instances of this gun buddy are already equipped on other weapons. |
| `spray-not-owned`           | Player does not own the requested spray in inventory.                        |
| `card-not-owned`            | Player does not own the requested player card in inventory.                  |
| `title-not-owned`           | Player does not own the requested title in inventory.                        |

### Social

| Reason                   | Description                                                                   |
| :----------------------- | :---------------------------------------------------------------------------- |
| `invalid-riot-id`        | Riot ID does not match valid `Name#Tag` syntax.                               |
| `friend-request-missing` | Attempted to accept, decline, or cancel a friend request that does not exist. |
| `friend-missing`         | Target PUUID is not currently on your friends roster.                         |
| `player-blocked`         | Target player is already blocked or invalid.                                  |

### Store

| Reason                  | Description                                                                                          |
| :---------------------- | :--------------------------------------------------------------------------------------------------- |
| `offer-not-in-store`    | The requested skin offer or bundle is not currently active in daily rotation or featured storefront. |
| `already-owned`         | Attempted to purchase a skin or bundle that is already fully owned.                                  |
| `insufficient-funds`    | Current wallet balance (VP, Radianite, or Kingdom Credits) is lower than item cost.                  |
| `confirm-required`      | Purchase initiated without explicit confirmation.                                                    |
| `night-market-missing`  | Attempted to reveal Night Market offers when no Night Market event is active.                        |
| `night-market-revealed` | All Night Market offers are already unveiled.                                                        |

### Matches & Pregame

| Reason                 | Description                                                                          |
| :--------------------- | :----------------------------------------------------------------------------------- |
| `not-in-pregame`       | Attempted agent selection, locking, or dodging outside of the pregame lobby phase.   |
| `unknown-agent`        | Specified agent name or UUID does not match any playable character in the catalogue. |
| `agent-not-owned`      | Attempted to pick or lock an agent that has not been unlocked on the account.        |
| `agent-locked-by-ally` | Attempted to select or lock an agent that has already been locked by a teammate.     |
| `already-locked`       | Attempted to select an agent after already locking in your choice.                   |
| `confirm-required`     | Dodge or leave-match called without explicit confirmation.                           |
| `not-in-match`         | Attempted to leave an active match when not currently inside a game.                 |

### Party

| Reason                | Description                                                                        |
| :-------------------- | :--------------------------------------------------------------------------------- |
| `no-party`            | Player is not currently part of any party lobby.                                   |
| `not-owner`           | Caller attempted an owner-restricted command (kick, promote, queue, matchmaking).  |
| `not-a-member`        | Target player or caller is not a member of the current party.                      |
| `self-target`         | Caller attempted to kick or promote their own account.                             |
| `already-in-party`    | Attempted to join a party that the player already belongs to.                      |
| `queue-not-eligible`  | Selected matchmaking queue is not permitted for current party composition or size. |
| `queue-restricted`    | Party members have active matchmaking penalties or rank disparities.               |
| `party-not-idle`      | Attempted party modifications while party state is not `DEFAULT`.                  |
| `not-matchmaking`     | Attempted to stop matchmaking while the party is not searching for a game.         |
| `members-not-ready`   | Attempted to start matchmaking while one or more party members are unready.        |
| `invalid-code`        | Party invite code is not 6 to 12 alphanumeric characters.                          |
| `invite-code-missing` | Attempted to revoke invite code when none was generated.                           |
| `restricted`          | Party currently has an active queue cooldown or dodge restriction penalty.         |
| `invite-missing`      | Specified party invitation does not exist.                                         |
| `request-missing`     | Specified join request is not pending on the party.                                |
| `not-custom-game`     | Custom game settings applied while party is in standard matchmaking mode.          |
| `map-not-enabled`     | Specified custom game map is disabled in server configurations.                    |
| `mode-not-enabled`    | Specified custom game mode is disabled in server configurations.                   |
| `server-unknown`      | Specified server pod ID is not in the ping index.                                  |
| `no-team-players`     | Attempted to start a custom game with zero players on TeamOne or TeamTwo.          |

## Dry-Run by Default in CLI

In the CLI, every write command runs in **dry-run** mode by default. It validates the operation locally, outputs the validated body (with credentials excluded) to stdout, and exits with code 0 without executing any network mutations.

Pass `--yes` to authorize the mutation:

```bash
# Dry run: validates locally and outputs the intended PUT payload
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2

# Execute mutation: sends the validated request
riotclient equip --card 0819fbcd-4bd4-c379-5384-52803440f2b2 --yes
```

## Explicit Confirmation for Destructive Actions

Disruptive operations require explicit dual confirmation to prevent unintended purchases or match penalties.

The operations requiring explicit confirmation are:

1. **Purchases** (`store.buy` / `riotclient buy`)
2. **Dodging Agent Select** (`matches.dodge` / `riotclient dodge`)
3. **Leaving In-Game Match** (`matches.leaveMatch` / `riotclient leave-match`)
4. **Overwriting Cloud Settings** (`account.saveSettings` / `riotclient settings-save`)

In Node, pass `{ confirm: true }`:

```ts
await client.store.buy({ offerId: "offer-uuid" }, { confirm: true });
await client.matches.dodge({ confirm: true });
await client.matches.leaveMatch({ confirm: true });
await client.account.saveSettings(newSettings, { confirm: true });
```

From the CLI, pass both `--yes` and `--confirm`:

```bash
riotclient buy --offer <id> --yes --confirm
riotclient dodge --yes --confirm
riotclient leave-match --yes --confirm
riotclient settings-save <file.json> --yes --confirm
```

If `--confirm` is omitted on these operations, the command fails with exit code `6` and `reason: confirm-required`.

## What the Library Refuses to Do

To preserve account safety and integrity, the library enforces strict operational boundaries:

- **No automated gameplay or bots**: The library does not orchestrate gameplay inputs or match automation.
- **No telemetry logging**: Access tokens, session cookies, and credentials are never stored, logged, or sent to telemetry.
- **No unconfirmed transactions**: No currency transaction can ever be triggered implicitly or without explicit confirmation.
- **No arbitrary player lookup without presence**: Arbitrary player search by `Name#Tag` (`social.lookup`) is not supported because Riot player-data endpoints do not expose lookup outside mutual presence or match history.
