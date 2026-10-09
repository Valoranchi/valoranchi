# Instalock

::: danger Against Riot's rules
Automating agent select is not allowed by Riot's policies for third party tools. The library offers it because it is a library: whoever turns it on does so on their own account and at their own risk. Valoranchi's desktop app does not use it.
:::

`client.matches.instalock()` watches for agent select and locks an agent the moment it starts. It validates every candidate first (you own the agent, no teammate has it), so it never sends Riot a lock that would be refused.

## Library

```ts
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();
const instalock = client.matches.instalock({
  agent: "Jett",
  byMap: { Haven: "Omen", Breeze: "Viper" },
  fallbacks: ["Reyna", "Phoenix"],
  delayMs: 300,
});

instalock.on("locked", ({ agent, map, mode }) => console.log(mode, agent, "on", map));
instalock.on("skipped", ({ reason }) => console.log("skipped:", reason));
```

| Option      | Type                     | Default  | What it does                                           |
| ----------- | ------------------------ | -------- | ------------------------------------------------------ |
| `agent`     | `string`                 | required | Agent name or uuid to lock when no map rule applies.   |
| `byMap`     | `Record<string, string>` | `{}`     | Map name or uuid to agent. Matched without case.       |
| `fallbacks` | `string[]`               | `[]`     | Tried in order when the chosen agent is not available. |
| `delayMs`   | `number`                 | `0`      | Wait before selecting, from 0 to 10000.                |
| `select`    | `boolean`                | `false`  | Only hover the agent, never lock.                      |
| `once`      | `boolean`                | `false`  | Stop after the first agent select.                     |
| `dryRun`    | `boolean`                | `false`  | Validate and report, never call select or lock.        |

Events: `locked` with `{ matchId, agent, map, mode }` where `mode` is `locked`, `selected` or `dry-run`; `skipped` with `{ matchId, reason }` (`already-locked`, `none-valid`); `error`. The handle is also an async iterable, and `stop()` ends it.

## CLI

Without `--yes` it runs as a dry run and prints what it would lock, like every other write.

```bash
riotclient instalock Jett --on-map Haven=Omen --on-map Breeze=Viper --fallback Reyna --delay 300 --yes
```

It prints one JSON line per event until interrupted. `--once` stops after the first match and `--select` hovers without locking.
