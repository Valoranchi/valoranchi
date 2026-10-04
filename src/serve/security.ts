import type { IncomingMessage } from "node:http";
import {
  ForbiddenHostError,
  ForbiddenOriginError,
  UnsupportedMediaTypeError,
} from "../errors.js";

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function isAllowedHost(
  hostHeader: string | undefined,
  port: number,
  allowRemote: boolean,
): boolean {
  if (allowRemote) {
    return true;
  }
  if (!hostHeader) {
    return false;
  }
  const normalized = hostHeader.toLowerCase();
  const allowed = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ]);
  if (port === 80) {
    allowed.add("127.0.0.1");
    allowed.add("localhost");
    allowed.add("[::1]");
  }
  return allowed.has(normalized);
}

export function isAllowedOrigin(
  originHeader: string | undefined,
  hostHeader: string | undefined,
): boolean {
  if (originHeader === undefined) {
    return true;
  }
  if (!hostHeader) {
    return false;
  }
  return originHeader.toLowerCase() === `http://${hostHeader.toLowerCase()}`;
}

export function isAllowedJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }
  const parts = contentType.toLowerCase().split(";").map((p) => p.trim());
  if (parts[0] !== "application/json") {
    return false;
  }
  for (let i = 1; i < parts.length; i++) {
    if (!parts[i]!.startsWith("charset=")) {
      return false;
    }
  }
  return true;
}

export function validateRequestSecurity(
  req: IncomingMessage,
  port: number,
  allowRemote: boolean,
): void {
  const hostHeader = getHeaderValue(req.headers.host);
  if (!isAllowedHost(hostHeader, port, allowRemote)) {
    throw new ForbiddenHostError(
      hostHeader ?? "missing",
      `Forbidden host: ${hostHeader ?? "missing"}`,
    );
  }

  const originHeader = getHeaderValue(req.headers.origin);
  if (!isAllowedOrigin(originHeader, hostHeader)) {
    throw new ForbiddenOriginError(originHeader);
  }

  if (req.method === "POST" && !isAllowedJsonContentType(getHeaderValue(req.headers["content-type"]))) {
    throw new UnsupportedMediaTypeError(getHeaderValue(req.headers["content-type"]));
  }
}
