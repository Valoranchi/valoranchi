import { deflateRawSync, inflateRawSync } from "node:zlib";

export type PreferenceBlob = Record<string, unknown>;

export function isPreferenceBlob(value: unknown): value is PreferenceBlob {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class PreferenceCodec {
  static decode(data: string): PreferenceBlob {
    const parsed: unknown = JSON.parse(
      inflateRawSync(Buffer.from(data, "base64")).toString("utf8"),
    );
    if (!isPreferenceBlob(parsed)) {
      throw new TypeError("Preference payload is not a JSON object");
    }
    return parsed;
  }

  static encode(settings: PreferenceBlob): string {
    return deflateRawSync(Buffer.from(JSON.stringify(settings), "utf8")).toString("base64");
  }

  static roundTrips(settings: PreferenceBlob): boolean {
    try {
      const restored = PreferenceCodec.decode(PreferenceCodec.encode(settings));
      return JSON.stringify(restored) === JSON.stringify(settings);
    } catch {
      return false;
    }
  }
}
