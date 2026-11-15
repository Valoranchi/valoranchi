import { describe, expect, it } from "vitest";
import {
  ACTIVE_CROSSHAIR,
  SAVED_CROSSHAIRS,
  applyCrosshairProfileToSettings,
  deduplicateProfileName,
  readCrosshairProfilesFromSettings,
  renameCrosshairProfileInSettings,
} from "../src/collection/CrosshairProfiles.js";
import type { PreferenceBlob } from "../src/riot/PreferenceCodec.js";

const sampleProfile1 = {
  profileName: "Default Crosshair",
  primary: {
    color: "#00ff00",
    outlines: true,
    centerDot: false,
  },
  aDS: {
    color: "#00ff00",
  },
  sniper: {
    centerDot: true,
  },
  bUsePrimaryCrosshairForADS: true,
};

const sampleProfile2 = {
  profileName: "Dot",
  primary: {
    color: "#ffffff",
    outlines: false,
    centerDot: true,
  },
  aDS: {
    color: "#ffffff",
  },
  sniper: {
    centerDot: true,
  },
  bUsePrimaryCrosshairForADS: false,
};

const handWrittenSettings: PreferenceBlob = {
  actionMappings: [
    {
      name: "Ping",
      key: "MiddleMouseButton",
      characterName: "None",
      alt: false,
      ctrl: false,
      shift: false,
      cmd: false,
      bindIndex: 0,
      tapHoldType: "None",
    },
  ],
  boolSettings: [{ settingEnum: "EAresBoolSettingName::ShowBlood", value: false }],
  roamingSetttingsVersion: 7,
  stringSettings: [
    { settingEnum: "Language", value: "en-US" },
    {
      settingEnum: SAVED_CROSSHAIRS,
      value: JSON.stringify({
        currentProfile: 0,
        profiles: [sampleProfile1, sampleProfile2],
      }),
    },
    { settingEnum: ACTIVE_CROSSHAIR, value: sampleProfile1.profileName },
  ],
};

function withSaved(value: unknown): PreferenceBlob {
  return {
    ...handWrittenSettings,
    stringSettings: [
      { settingEnum: "Language", value: "en-US" },
      { settingEnum: SAVED_CROSSHAIRS, value },
    ],
  };
}

function stringSettingsOf(settings: PreferenceBlob): { settingEnum: string; value: unknown }[] {
  return settings.stringSettings as { settingEnum: string; value: unknown }[];
}

function savedOf(settings: PreferenceBlob): string {
  return stringSettingsOf(settings).find((entry) => entry.settingEnum === SAVED_CROSSHAIRS)
    ?.value as string;
}

describe("deduplicateProfileName", () => {
  it("deduplicates names with (2) and incremental numbering", () => {
    expect(deduplicateProfileName("Aim", [])).toBe("Aim");
    expect(deduplicateProfileName("Aim", ["Aim"])).toBe("Aim (2)");
    expect(deduplicateProfileName("Aim", ["Aim", "Aim (2)"])).toBe("Aim (3)");
  });
});

describe("readCrosshairProfilesFromSettings", () => {
  it("reads valid profiles and current profile from settings", () => {
    const res = readCrosshairProfilesFromSettings(handWrittenSettings);
    if (res.unsupported === true) throw new Error("Expected supported result");
    expect(res.currentProfile).toBe(0);
    expect(res.profiles).toHaveLength(2);
    expect(res.profiles[0].name).toBe("Default Crosshair");
    expect(res.profiles[0].index).toBe(0);
    expect(res.profiles[0].raw).toEqual(sampleProfile1);
    expect(res.profiles[1].name).toBe("Dot");
    expect(res.profiles[1].index).toBe(1);
  });

  it("returns unsupported on missing or non-string saved crosshairs", () => {
    expect(readCrosshairProfilesFromSettings(withSaved(undefined))).toEqual({
      unsupported: true,
    });

    expect(readCrosshairProfilesFromSettings(withSaved(12345 as unknown as string))).toEqual({
      unsupported: true,
    });
  });

  it("returns unsupported on invalid JSON", () => {
    expect(readCrosshairProfilesFromSettings(withSaved("{ not valid json"))).toEqual({
      unsupported: true,
    });
  });

  it("returns unsupported on missing or empty profiles array", () => {
    expect(
      readCrosshairProfilesFromSettings(withSaved(JSON.stringify({ currentProfile: 0 }))),
    ).toEqual({ unsupported: true });

    expect(
      readCrosshairProfilesFromSettings(
        withSaved(JSON.stringify({ currentProfile: 0, profiles: [] })),
      ),
    ).toEqual({ unsupported: true });
  });

  it("returns unsupported if any profile lacks a string profileName", () => {
    expect(
      readCrosshairProfilesFromSettings(
        withSaved(JSON.stringify({ currentProfile: 0, profiles: [{ foo: "bar" }] })),
      ),
    ).toEqual({ unsupported: true });
  });
});

describe("applyCrosshairProfileToSettings", () => {
  it("selecting a profile also renames the active crosshair, and leaves every other string setting alone", () => {
    const result = applyCrosshairProfileToSettings(handWrittenSettings, sampleProfile2, {
      asNew: false,
      select: true,
    });
    if (result.ok !== true) throw new Error("Expected success");
    expect(stringSettingsOf(result.settings)).toEqual([
      { settingEnum: "Language", value: "en-US" },
      { settingEnum: SAVED_CROSSHAIRS, value: savedOf(result.settings) },
      { settingEnum: ACTIVE_CROSSHAIR, value: sampleProfile2.profileName },
    ]);
    expect(JSON.parse(savedOf(result.settings)).currentProfile).toBe(1);
    expect(result.settings.actionMappings).toBe(handWrittenSettings.actionMappings);
  });

  it("adds a profile as new, deduplicates name, and leaves other sections byte-identical", () => {
    const toAdd = {
      ...sampleProfile1,
      profileName: "Default Crosshair",
    };

    const result = applyCrosshairProfileToSettings(handWrittenSettings, toAdd, {
      asNew: true,
      select: true,
    });

    if (!result.ok) throw new Error("Expected ok result");

    // Verify name deduplication: "Default Crosshair" -> "Default Crosshair (2)"
    expect(result.name).toBe("Default Crosshair (2)");
    expect(result.index).toBe(2);

    // Verify selection
    const updatedParsed = JSON.parse(savedOf(result.settings));
    expect(updatedParsed.currentProfile).toBe(2);
    expect(updatedParsed.profiles).toHaveLength(3);
    expect(updatedParsed.profiles[2].profileName).toBe("Default Crosshair (2)");

    // Verify every other section is byte-identical
    expect(result.settings.actionMappings).toEqual(handWrittenSettings.actionMappings);
    expect(result.settings.boolSettings).toEqual(handWrittenSettings.boolSettings);
    expect(result.settings.roamingSetttingsVersion).toEqual(
      handWrittenSettings.roamingSetttingsVersion,
    );
    expect(stringSettingsOf(result.settings)[0]).toEqual(stringSettingsOf(handWrittenSettings)[0]);
  });

  it("applyCrosshairProfileToSettings directly applies changes to settings object", () => {
    const direct = applyCrosshairProfileToSettings(handWrittenSettings, sampleProfile1, {
      asNew: true,
      select: true,
    });
    expect(direct.ok).toBe(true);
    if (direct.ok === false) throw new Error("Expected ok");
    expect(direct.name).toBe("Default Crosshair (2)");
    expect(direct.index).toBe(2);
  });

  it("replaces a profile with the same name and updates selection", () => {
    const replacedProfile = {
      ...sampleProfile2,
      primary: {
        ...sampleProfile2.primary,
        color: "#ffff00",
      },
    };

    const result = applyCrosshairProfileToSettings(handWrittenSettings, replacedProfile, {
      asNew: false,
      select: true,
    });

    if (!result.ok) throw new Error("Expected ok result");

    expect(result.name).toBe("Dot");
    expect(result.index).toBe(1);

    const updatedParsed = JSON.parse(savedOf(result.settings));
    expect(updatedParsed.currentProfile).toBe(1);
    expect(updatedParsed.profiles).toHaveLength(2);
    expect(updatedParsed.profiles[1]).toEqual(replacedProfile);

    // Other sections untouched
    expect(result.settings.actionMappings).toEqual(handWrittenSettings.actionMappings);
    expect(result.settings.boolSettings).toEqual(handWrittenSettings.boolSettings);
  });

  it("preserves previous selection when select is false", () => {
    const toAdd = {
      ...sampleProfile1,
      profileName: "Green Cross",
    };

    const result = applyCrosshairProfileToSettings(handWrittenSettings, toAdd, {
      asNew: true,
      select: false,
    });

    if (!result.ok) throw new Error("Expected ok result");

    const updatedParsed = JSON.parse(savedOf(result.settings));
    expect(updatedParsed.currentProfile).toBe(0); // remains 0
    expect(updatedParsed.profiles).toHaveLength(3);
  });

  it("refuses profiles with mismatched top-level keys", () => {
    const invalidProfile = {
      profileName: "Malicious",
      someUnknownField: true,
    };

    const result = applyCrosshairProfileToSettings(handWrittenSettings, invalidProfile, {
      asNew: true,
      select: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok !== false) throw new Error("Expected refusal");
    expect(result.reason).toBe("invalid-profile");
  });

  it("returns unsupported on malformed saved crosshairs and never modifies settings", () => {
    const malformedSettings = withSaved("{ bad json");

    const result = applyCrosshairProfileToSettings(malformedSettings, sampleProfile1, {
      asNew: true,
      select: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok !== false) throw new Error("Expected unsupported refusal");
    expect(result.reason).toBe("unsupported");
  });
});

describe("renameCrosshairProfileInSettings", () => {
  it("renames a profile and follows it with the active name when it is active", () => {
    const result = renameCrosshairProfileInSettings(handWrittenSettings, 0, "  Mine  ");
    if (result.ok !== true) throw new Error("Expected success");
    expect(result.name).toBe("Mine");
    const saved = JSON.parse(savedOf(result.settings));
    expect(saved.profiles[0].profileName).toBe("Mine");
    expect(saved.profiles[0].primary).toEqual(sampleProfile1.primary);
    expect(saved.profiles[1]).toEqual(sampleProfile2);
    expect(
      stringSettingsOf(result.settings).find((e) => e.settingEnum === ACTIVE_CROSSHAIR)?.value,
    ).toBe("Mine");
    expect(stringSettingsOf(result.settings)[0]).toEqual(stringSettingsOf(handWrittenSettings)[0]);
  });

  it("keeps the active name when renaming another profile, and de-duplicates", () => {
    const result = renameCrosshairProfileInSettings(
      handWrittenSettings,
      1,
      sampleProfile1.profileName,
    );
    if (result.ok !== true) throw new Error("Expected success");
    expect(result.name).toBe(`${sampleProfile1.profileName} (2)`);
    expect(
      stringSettingsOf(result.settings).find((e) => e.settingEnum === ACTIVE_CROSSHAIR)?.value,
    ).toBe(sampleProfile1.profileName);
  });

  it("refuses an unknown index or an empty name", () => {
    expect(renameCrosshairProfileInSettings(handWrittenSettings, 9, "x")).toEqual({
      ok: false,
      reason: "profile-not-found",
    });
    expect(renameCrosshairProfileInSettings(handWrittenSettings, 0, "   ")).toEqual({
      ok: false,
      reason: "invalid-name",
    });
  });
});
