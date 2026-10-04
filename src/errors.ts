export class RiotClientError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class RiotClientNotRunningError extends RiotClientError {
  constructor(message = "Riot Client is not running") {
    super(message, "RIOT_CLIENT_NOT_RUNNING");
  }
}

export class RiotClientNotReadyError extends RiotClientError {
  constructor(message = "Riot Client is not ready yet") {
    super(message, "RIOT_CLIENT_NOT_READY");
  }
}

export class RegionUnknownError extends RiotClientError {
  constructor(message = "Could not resolve region and shard") {
    super(message, "REGION_UNKNOWN");
  }
}

export class ForbiddenHostError extends RiotClientError {
  constructor(host: string, message?: string) {
    super(message ?? `Host '${host}' is not allowed to receive Riot credentials`, "FORBIDDEN_HOST");
  }
}

export class ForbiddenOriginError extends RiotClientError {
  constructor(origin?: string) {
    super(
      origin ? `Origin '${origin}' is not allowed` : "Origin is not allowed",
      "FORBIDDEN_ORIGIN",
    );
  }
}

export class UnsupportedMediaTypeError extends RiotClientError {
  constructor(contentType?: string) {
    super(
      `Unsupported media type: ${contentType ?? "none"}. Expected application/json`,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  }
}

export class RiotApiError extends RiotClientError {
  readonly status: number;
  readonly url: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, rawUrl: string, message?: string, retryAfterSeconds?: number) {
    const sanitizedUrl = rawUrl.split("?")[0]!;
    super(
      message ?? `Riot API request to ${sanitizedUrl} failed with status ${status}`,
      "RIOT_API_ERROR",
    );
    this.status = status;
    this.url = sanitizedUrl;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OfficialApiKeyMissingError extends RiotClientError {
  constructor(message = "Official Riot API key is missing") {
    super(message, "OFFICIAL_API_KEY_MISSING");
  }
}

export class ValidationError extends RiotClientError {
  readonly reason: string;
  readonly details: Record<string, unknown>;

  constructor(
    reason: string,
    messageOrDetails?: string | Record<string, unknown>,
    details?: Record<string, unknown>,
  ) {
    const message = typeof messageOrDetails === "string" ? messageOrDetails : reason;
    const finalDetails =
      typeof messageOrDetails === "object" && messageOrDetails !== null
        ? messageOrDetails
        : (details ?? {});
    super(message, "VALIDATION");
    this.reason = reason;
    this.details = finalDetails;
  }
}
