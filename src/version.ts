import { readFileSync } from "node:fs";

function readPackageVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    return (JSON.parse(readFileSync(url, "utf-8")) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

export const PACKAGE_VERSION = process.env.RIOTCLIENT_BUNDLED_VERSION ?? readPackageVersion();
