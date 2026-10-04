import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { RiotClient } from "./RiotClient.js";
import type { ServerInstance } from "./serve/types.js";

export function isSea(): boolean {
  try {
    const req = createRequire(import.meta.url);
    const sea = req("node:sea") as { isSea?: () => boolean };
    return typeof sea?.isSea === "function" && sea.isSea();
  } catch {
    return false;
  }
}

export function shouldLaunchDashboard(options: {
  argsLength: number;
  isSea: boolean;
}): boolean {
  return options.argsLength === 0 && options.isSea;
}

export function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    if (platform === "win32") {
      const child = spawn("cmd", ["/c", "start", "", url], {
        windowsHide: true,
        stdio: "ignore",
        detached: true,
      });
      child.on("error", () => {});
      child.unref();
    } else if (platform === "darwin") {
      const child = spawn("open", [url], {
        stdio: "ignore",
        detached: true,
      });
      child.on("error", () => {});
      child.unref();
    } else {
      const child = spawn("xdg-open", [url], {
        stdio: "ignore",
        detached: true,
      });
      child.on("error", () => {});
      child.unref();
    }
  } catch {
    // Failures only print the URL
  }
}

export function printDashboardBanner(url: string): void {
  process.stdout.write(`
==================================================
  Valoranchi Dashboard
  ${url}
==================================================
Keep this window open. Close it to stop the server.

`);
}

export async function startDashboardServer(
  client: RiotClient,
  startPort = 47800,
  maxAttempts = 10,
): Promise<ServerInstance> {
  let lastError: unknown;
  for (let offset = 0; offset <= maxAttempts; offset++) {
    const port = startPort + offset;
    try {
      return await client.serve({ port, host: "127.0.0.1", allowRemote: false });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "EADDRINUSE") {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function runDashboard(client: RiotClient): Promise<number> {
  const server = await startDashboardServer(client, 47800, 10);
  printDashboardBanner(server.url);
  openBrowser(server.url);

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
