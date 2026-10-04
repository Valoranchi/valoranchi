import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { formatError } from "../formatError.js";
import {
  ForbiddenHostError,
  ForbiddenOriginError,
  RiotApiError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "../errors.js";
import type { RiotClient } from "../RiotClient.js";
import { renderDashboardCss, renderDashboardHtml, renderDashboardJs } from "./dashboard/index.js";
import { renderIndexHtml } from "./indexHtml.js";
import { buildOpenApiSpec } from "./openapi.js";
import { dispatchApiRoute } from "./routes.js";
import { validateRequestSecurity } from "./security.js";
import { handleSse } from "./sse.js";
import type { ServeOptions, ServerInstance } from "./types.js";

export function isLoopback(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return true;
  }
  if (/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(host)) {
    return true;
  }
  return false;
}

const DASHBOARD_CSP =
  "default-src 'self'; img-src 'self' https://media.valorant-api.com data:; connect-src 'self'";

const DASHBOARD_ASSETS: Record<string, { type: string; render: () => string }> = {
  "/": { type: "text/html; charset=utf-8", render: renderDashboardHtml },
  "/index.html": { type: "text/html; charset=utf-8", render: renderDashboardHtml },
  "/dashboard.css": { type: "text/css; charset=utf-8", render: renderDashboardCss },
  "/dashboard.js": { type: "application/javascript; charset=utf-8", render: renderDashboardJs },
};

export function httpStatusForError(error: unknown): number {
  if (error instanceof RiotClientNotRunningError || error instanceof RiotClientNotReadyError) {
    return 503;
  }
  if (error instanceof ValidationError) {
    return 400;
  }
  if (error instanceof ForbiddenHostError || error instanceof ForbiddenOriginError) {
    return 403;
  }
  if (error instanceof UnsupportedMediaTypeError) {
    return 415;
  }
  if (error instanceof RiotApiError) {
    return 502;
  }
  return 500;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf-8");
      if (raw.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new ValidationError("payload-too-large", "Request body too large"));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object") {
          resolve(parsed as Record<string, unknown>);
        } else {
          resolve({});
        }
      } catch {
        reject(new ValidationError("invalid-json", "Invalid JSON request body"));
      }
    });
    req.on("error", reject);
  });
}

export async function createRiotServer(
  client: RiotClient,
  options: ServeOptions = {},
): Promise<ServerInstance> {
  const port = options.port ?? 47800;
  const host = options.host ?? "127.0.0.1";
  const allowRemote = Boolean(options.allowRemote);
  let activePort = port;

  if (!allowRemote && !isLoopback(host)) {
    throw new ForbiddenHostError(
      `Refusing to bind non-loopback host '${host}' without --allow-remote`,
    );
  }

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      validateRequestSecurity(req, activePort, allowRemote);
      const parsedUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
      const pathname = parsedUrl.pathname;
      const query: Record<string, string> = {};
      for (const [key, value] of parsedUrl.searchParams.entries()) {
        query[key] = value;
      }

      const asset = req.method === "GET" ? DASHBOARD_ASSETS[pathname] : undefined;
      if (asset) {
        const body = asset.render();
        res.writeHead(200, {
          "Content-Type": asset.type,
          "Content-Length": Buffer.byteLength(body),
          "Content-Security-Policy": DASHBOARD_CSP,
          "X-Content-Type-Options": "nosniff",
        });
        res.end(body);
        return;
      }

      if (req.method === "GET" && (pathname === "/api" || pathname === "/api/")) {
        const html = renderIndexHtml();
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": Buffer.byteLength(html),
        });
        res.end(html);
        return;
      }

      if (req.method === "GET" && pathname === "/openapi.json") {
        const spec = buildOpenApiSpec();
        const json = JSON.stringify(spec, null, 2);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(json),
        });
        res.end(json);
        return;
      }

      if (req.method === "GET" && pathname === "/events") {
        handleSse(client, req, res, query);
        return;
      }

      if (pathname.startsWith("/api/")) {
        const parts = pathname.slice("/api/".length).split("/").filter(Boolean);
        if (parts.length >= 2) {
          const namespace = parts[0]!;
          const methodName = parts[1]!;
          const body = req.method === "POST" ? await readJsonBody(req) : {};
          const result = await dispatchApiRoute(client, namespace, methodName, query, body, req);

          const json = JSON.stringify(result ?? null);
          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(json),
          });
          res.end(json);
          return;
        }
      }

      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: `Not found: ${req.url}` } }));
    } catch (error: unknown) {
      const status = httpStatusForError(error);
      const formatted = formatError(error);
      const json = JSON.stringify(formatted);
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(json),
      });
      res.end(json);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (address && typeof address === "object") {
    activePort = address.port;
  }

  const url = `http://${host}:${activePort}`;
  return {
    server,
    port: activePort,
    host,
    url,
    close: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
