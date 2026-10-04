import { describe, expect, it } from "vitest";
import {
  ForbiddenHostError,
  ForbiddenOriginError,
  OfficialApiKeyMissingError,
  RegionUnknownError,
  RiotApiError,
  RiotClientError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "../src/errors.js";

describe("errors", () => {
  it("creates base RiotClientError with message and code", () => {
    const error = new RiotClientError("Custom error", "CUSTOM_CODE");
    expect(error.message).toBe("Custom error");
    expect(error.code).toBe("CUSTOM_CODE");
    expect(error.name).toBe("RiotClientError");
    expect(error instanceof Error).toBe(true);
  });

  it("creates ValidationError with reason, code VALIDATION and details", () => {
    const err = new ValidationError("skin-not-owned", "Skin is not owned", { skin: "abc" });
    expect(err.code).toBe("VALIDATION");
    expect(err.reason).toBe("skin-not-owned");
    expect(err.message).toBe("Skin is not owned");
    expect(err.details).toEqual({ skin: "abc" });
    expect(err instanceof RiotClientError).toBe(true);

    const simple = new ValidationError("not-a-friend");
    expect(simple.reason).toBe("not-a-friend");
    expect(simple.message).toBe("not-a-friend");
    expect(simple.details).toEqual({});
  });

  it("creates specific error types with default codes", () => {
    const notRunning = new RiotClientNotRunningError();
    expect(notRunning.code).toBe("RIOT_CLIENT_NOT_RUNNING");
    expect(notRunning instanceof RiotClientError).toBe(true);

    const notReady = new RiotClientNotReadyError();
    expect(notReady.code).toBe("RIOT_CLIENT_NOT_READY");
    expect(notReady instanceof RiotClientError).toBe(true);

    const regionUnknown = new RegionUnknownError();
    expect(regionUnknown.code).toBe("REGION_UNKNOWN");
    expect(regionUnknown instanceof RiotClientError).toBe(true);

    const forbidden = new ForbiddenHostError("evil.com");
    expect(forbidden.code).toBe("FORBIDDEN_HOST");
    expect(forbidden.message).toContain("evil.com");
    expect(forbidden instanceof RiotClientError).toBe(true);

    const forbiddenOrigin = new ForbiddenOriginError("https://evil.example");
    expect(forbiddenOrigin.code).toBe("FORBIDDEN_ORIGIN");
    expect(forbiddenOrigin.message).toContain("evil.example");
    expect(forbiddenOrigin instanceof RiotClientError).toBe(true);

    const unsupportedMedia = new UnsupportedMediaTypeError("text/plain");
    expect(unsupportedMedia.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(unsupportedMedia.message).toContain("text/plain");
    expect(unsupportedMedia instanceof RiotClientError).toBe(true);
  });

  it("sanitizes url in RiotApiError by stripping query strings and captures retryAfterSeconds", () => {
    const apiError = new RiotApiError(
      429,
      "https://pd.na.a.pvp.net/store/v1/wallet/123?token=secret",
      undefined,
      5,
    );
    expect(apiError.status).toBe(429);
    expect(apiError.url).toBe("https://pd.na.a.pvp.net/store/v1/wallet/123");
    expect(apiError.code).toBe("RIOT_API_ERROR");
    expect(apiError.retryAfterSeconds).toBe(5);
    expect(apiError.message).not.toContain("secret");
  });

  it("creates OfficialApiKeyMissingError with default code and message", () => {
    const keyMissing = new OfficialApiKeyMissingError();
    expect(keyMissing.code).toBe("OFFICIAL_API_KEY_MISSING");
    expect(keyMissing.message).toContain("Official Riot API key is missing");
    expect(keyMissing instanceof RiotClientError).toBe(true);
  });
});
