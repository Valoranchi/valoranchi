import type { PreferenceBlob } from "../riot/PreferenceCodec.js";

// Two entries of `stringSettings`, not the blob's `settingsProfileData`: a JSON string
// `{ currentProfile, profiles: [{ profileName, ... }] }` and the name of the active profile.
export const SAVED_CROSSHAIRS = "EAresStringSettingName::SavedCrosshairProfileData";
export const ACTIVE_CROSSHAIR = "EAresStringSettingName::CrosshairProfileName";

interface StringSetting {
  settingEnum: string;
  value: unknown;
}

export interface CrosshairProfileRaw {
  profileName: string;
  [key: string]: unknown;
}

export interface SettingsProfileData {
  currentProfile: number;
  profiles: CrosshairProfileRaw[];
  [key: string]: unknown;
}

export type ReadCrosshairsResult =
  | { unsupported: true }
  | {
      unsupported: false;
      currentProfile: number;
      profiles: { name: string; index: number; raw: CrosshairProfileRaw }[];
    };

function stringSettingsOf(settings: PreferenceBlob): StringSetting[] {
  return Array.isArray(settings.stringSettings) ? (settings.stringSettings as StringSetting[]) : [];
}

function stringSetting(settings: PreferenceBlob, key: string): unknown {
  return stringSettingsOf(settings).find((entry) => entry.settingEnum === key)?.value;
}

function withStringSettings<T extends PreferenceBlob>(
  settings: T,
  values: Record<string, string>,
): T {
  const entries = stringSettingsOf(settings).map((entry) =>
    entry.settingEnum in values ? { ...entry, value: values[entry.settingEnum] } : entry,
  );
  for (const [settingEnum, value] of Object.entries(values)) {
    if (!entries.some((entry) => entry.settingEnum === settingEnum)) {
      entries.push({ settingEnum, value });
    }
  }
  return { ...settings, stringSettings: entries };
}

export function deduplicateProfileName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name;
  let counter = 2;
  while (existingNames.includes(`${name} (${counter})`)) {
    counter++;
  }
  return `${name} (${counter})`;
}

export function parseSettingsProfileData(
  settings: PreferenceBlob,
): { unsupported: true } | { unsupported: false; data: SettingsProfileData } {
  const rawData = stringSetting(settings, SAVED_CROSSHAIRS);
  if (typeof rawData !== "string") {
    return { unsupported: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return { unsupported: true };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { unsupported: true };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.profiles) || obj.profiles.length === 0) {
    return { unsupported: true };
  }

  for (const p of obj.profiles) {
    if (
      !p ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      typeof (p as Record<string, unknown>).profileName !== "string"
    ) {
      return { unsupported: true };
    }
  }

  return { unsupported: false, data: obj as SettingsProfileData };
}

export function readCrosshairProfilesFromSettings(settings: PreferenceBlob): ReadCrosshairsResult {
  const parsedRes = parseSettingsProfileData(settings);
  if (parsedRes.unsupported === true) {
    return { unsupported: true };
  }

  const { data } = parsedRes;
  const currentProfile =
    typeof data.currentProfile === "number" &&
    data.currentProfile >= 0 &&
    data.currentProfile < data.profiles.length
      ? data.currentProfile
      : 0;

  return {
    unsupported: false,
    currentProfile,
    profiles: data.profiles.map((p: CrosshairProfileRaw, index: number) => ({
      name: p.profileName,
      index,
      raw: p,
    })),
  };
}

// A profile is accepted only when its top-level keys match an existing profile's.
export function applyCrosshairProfileToSettings<T extends PreferenceBlob>(
  settings: T,
  raw: Record<string, unknown>,
  options: { asNew: boolean; select: boolean },
):
  | {
      ok: true;
      settings: T;
      name: string;
      index: number;
    }
  | {
      ok: false;
      reason: "unsupported" | "invalid-profile" | "profile-not-found";
    } {
  const parsedRes = parseSettingsProfileData(settings);
  if (parsedRes.unsupported === true) {
    return { ok: false, reason: "unsupported" };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid-profile" };
  }

  if (typeof raw.profileName !== "string" || !raw.profileName.trim()) {
    return { ok: false, reason: "invalid-profile" };
  }

  const rawKeys = Object.keys(raw);
  const rawKeySet = new Set(rawKeys);
  const matchesExisting = parsedRes.data.profiles.some((p: CrosshairProfileRaw) => {
    const pKeys = Object.keys(p);
    return pKeys.length === rawKeys.length && pKeys.every((k) => rawKeySet.has(k));
  });

  if (!matchesExisting) {
    return { ok: false, reason: "invalid-profile" };
  }

  const data = parsedRes.data;
  const profiles = [...data.profiles];
  let targetIndex = -1;
  let finalName = raw.profileName as string;

  if (options.asNew) {
    const existingNames = profiles.map((p) => p.profileName);
    finalName = deduplicateProfileName(finalName, existingNames);
    const newProfile = { ...raw, profileName: finalName };
    profiles.push(newProfile);
    targetIndex = profiles.length - 1;
  } else {
    const matchIndex = profiles.findIndex((p) => p.profileName === raw.profileName);
    if (matchIndex === -1) {
      return { ok: false, reason: "profile-not-found" };
    }
    profiles[matchIndex] = { ...raw, profileName: raw.profileName };
    targetIndex = matchIndex;
  }

  let nextCurrentProfile = typeof data.currentProfile === "number" ? data.currentProfile : 0;
  if (options.select && targetIndex >= 0) {
    nextCurrentProfile = targetIndex;
  }

  const nextProfileData: SettingsProfileData = {
    ...data,
    currentProfile: nextCurrentProfile,
    profiles,
  };

  const nextSettings = withStringSettings(settings, {
    [SAVED_CROSSHAIRS]: JSON.stringify(nextProfileData),
    ...(options.select ? { [ACTIVE_CROSSHAIR]: finalName } : {}),
  });

  return {
    ok: true,
    settings: nextSettings,
    name: finalName,
    index: targetIndex,
  };
}

// The active profile's name follows a rename because the game finds the active crosshair by name.
export function renameCrosshairProfileInSettings<T extends PreferenceBlob>(
  settings: T,
  index: number,
  newName: string,
):
  | { ok: true; settings: T; name: string }
  | {
      ok: false;
      reason: "unsupported" | "profile-not-found" | "invalid-name";
    } {
  const parsed = parseSettingsProfileData(settings);
  if (parsed.unsupported === true) return { ok: false, reason: "unsupported" };
  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > 64) {
    return { ok: false, reason: "invalid-name" };
  }
  const profiles = [...parsed.data.profiles];
  const target = profiles[index];
  if (!target) return { ok: false, reason: "profile-not-found" };

  const others = profiles.filter((_, i) => i !== index).map((p) => p.profileName);
  const name = deduplicateProfileName(trimmed, others);
  profiles[index] = { ...target, profileName: name };
  const isActive = parsed.data.currentProfile === index;

  return {
    ok: true,
    name,
    settings: withStringSettings(settings, {
      [SAVED_CROSSHAIRS]: JSON.stringify({ ...parsed.data, profiles }),
      ...(isActive ? { [ACTIVE_CROSSHAIR]: name } : {}),
    }),
  };
}
