import fs from "node:fs";
import path from "node:path";

// Unreal writes FullscreenMode=0 for exclusive fullscreen, 1 for windowed fullscreen, 2 for a window.
export const EXCLUSIVE_FULLSCREEN = 0;

export function parseFullscreenMode(ini: string): number | null {
  // Some files carry only the mode the player last confirmed; PreferredFullscreenMode is the one
  // to go back to from a window, not the one in use.
  const match =
    /^FullscreenMode=(\d+)\s*$/m.exec(ini) ?? /^LastConfirmedFullscreenMode=(\d+)\s*$/m.exec(ini);
  return match ? Number(match[1]) : null;
}

export function defaultConfigDir(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData ? path.join(localAppData, "VALORANT", "Saved", "Config") : null;
}

// One folder per account and region; the one written to last is the one in use.
export function readGameUserSettings(
  puuid: string,
  configDir: string | null = defaultConfigDir(),
): string | null {
  if (!configDir) return null;
  try {
    const files = fs
      .readdirSync(configDir)
      .filter((name) => name.toLowerCase().startsWith(puuid.toLowerCase()))
      .map((name) => path.join(configDir, name, "WindowsClient", "GameUserSettings.ini"))
      .filter((file) => fs.existsSync(file))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return files.length > 0 ? fs.readFileSync(files[0], "utf8") : null;
  } catch {
    return null;
  }
}

export function isExclusiveFullscreen(
  puuid: string | null,
  configDir: string | null = defaultConfigDir(),
): boolean {
  if (!puuid) return false;
  const ini = readGameUserSettings(puuid, configDir);
  return ini !== null && parseFullscreenMode(ini) === EXCLUSIVE_FULLSCREEN;
}
