import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isExclusiveFullscreen, parseFullscreenMode } from "../src/local/GameUserSettings.js";

const PUUID = "11111111-2222-4333-8444-555555555555";

describe("parseFullscreenMode", () => {
  it("reads the mode from the game's settings file", () => {
    const ini =
      "[/Script/ShooterGame.ShooterGameUserSettings]\r\nFullscreenMode=0\r\nLastConfirmedFullscreenMode=1\r\nPreferredFullscreenMode=1\r\n";
    expect(parseFullscreenMode(ini)).toBe(0);
  });

  it("does not mistake the preferred mode for it", () => {
    expect(parseFullscreenMode("PreferredFullscreenMode=0\n")).toBeNull();
  });

  it("falls back to the last confirmed mode when the file has no current one", () => {
    expect(
      parseFullscreenMode("LastConfirmedFullscreenMode=0\r\nPreferredFullscreenMode=1\r\n"),
    ).toBe(0);
  });
});

describe("isExclusiveFullscreen", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "game-settings-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeIni(folder: string, mode: number): string {
    const file = path.join(dir, folder, "WindowsClient", "GameUserSettings.ini");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      `[/Script/ShooterGame.ShooterGameUserSettings]\r\nFullscreenMode=${mode}\r\n`,
    );
    return file;
  }

  it("is true for exclusive fullscreen", () => {
    writeIni(`${PUUID}-na`, 0);

    expect(isExclusiveFullscreen(PUUID, dir)).toBe(true);
  });

  it("is false for windowed fullscreen", () => {
    writeIni(`${PUUID}-na`, 1);

    expect(isExclusiveFullscreen(PUUID, dir)).toBe(false);
  });

  it("reads the account folder written to last", () => {
    const older = writeIni(`${PUUID}-na`, 0);
    writeIni(`${PUUID}-eu`, 1);
    const anHourAgo = new Date(Date.now() - 3_600_000);
    fs.utimesSync(older, anHourAgo, anHourAgo);

    expect(isExclusiveFullscreen(PUUID, dir)).toBe(false);
  });

  it("is false without a puuid, a config folder or a settings file", () => {
    writeIni(`${PUUID}-na`, 0);

    expect(isExclusiveFullscreen(null, dir)).toBe(false);
    expect(isExclusiveFullscreen(PUUID, path.join(dir, "missing"))).toBe(false);
    expect(isExclusiveFullscreen(PUUID, null)).toBe(false);
    expect(isExclusiveFullscreen("22222222-3333-4444-8555-666666666666", dir)).toBe(false);
  });
});
