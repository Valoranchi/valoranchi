import fs from "node:fs";
import { RegionUnknownError } from "../errors.js";
import { defaultLogPath } from "./GameLog.js";
import type { RiotClientLocalApi } from "./RiotClientLocalApi.js";

const REGION_SHARD_OVERRIDES: Record<string, string> = {
  latam: "na",
  br: "na",
};

export function shardOf(region: string): string {
  const normalized = region.trim().toLowerCase();
  return REGION_SHARD_OVERRIDES[normalized] ?? normalized;
}

// The region in a game pod id such as `aresriot.aws-scl1-prod.latam-gp-santiago-1`.
export function gamePodRegion(podId: unknown): string | null {
  if (typeof podId !== "string") return null;
  const region = /\.([a-z]+)-gp-/i.exec(podId)?.[1];
  return region ? region.toLowerCase() : null;
}

export function defaultLogReader(): string | null {
  const logPath = defaultLogPath();
  if (!logPath) {
    return null;
  }
  try {
    if (!fs.existsSync(logPath)) {
      return null;
    }
    return fs.readFileSync(logPath, "utf-8");
  } catch {
    return null;
  }
}

export function parseRegionFromLog(text: string): { region: string; shard: string } | null {
  const match = text.match(/https:\/\/glz-([a-z0-9]+)-1\.([a-z]+)\.a\.pvp\.net/i);
  if (!match) {
    return null;
  }
  const region = match[1]!.toLowerCase();
  const shard = match[2]!.toLowerCase();
  return { region, shard };
}

export async function resolveRegion(
  localApi: Pick<RiotClientLocalApi, "valorantSession">,
  logReader: () => string | null = defaultLogReader,
): Promise<{ region: string; shard: string }> {
  const primary = await localApi.valorantSession();
  if (primary) {
    return primary;
  }

  const logText = logReader();
  if (logText) {
    const fromLog = parseRegionFromLog(logText);
    if (fromLog) {
      return fromLog;
    }
  }

  throw new RegionUnknownError();
}
