import { ROUTE_DEFINITIONS } from "./routes.js";

export function renderIndexHtml(): string {
  const routesList = ROUTE_DEFINITIONS.map(
    (r) => `<li><code><strong>${r.method}</strong> ${r.path}</code> — ${r.summary}</li>`,
  ).join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Valoranchi Riot Client API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; max-width: 900px; line-height: 1.5; color: #222; }
    h1 { margin-bottom: 0.5rem; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    ul { list-style: none; padding-left: 0; }
    li { margin: 0.5rem 0; padding: 0.4rem 0; border-bottom: 1px solid #eee; }
    .links a { margin-right: 1.5rem; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Valoranchi Riot Client API</h1>
  <p>Local HTTP integration server for Riot Client and Valorant.</p>
  <div class="links">
    <a href="/">Dashboard</a>
    <a href="/openapi.json">OpenAPI Specification (JSON)</a>
    <a href="/events">Server-Sent Events Stream (/events)</a>
    <a href="https://github.com/Valoranchi/valoranchi#readme" target="_blank" rel="noopener">Documentation</a>
  </div>
  <h2>Available Routes</h2>
  <ul>
    <li><code><strong>GET</strong> /events</code> — Real-time Server-Sent Events stream (?only=)</li>
    <li><code><strong>GET</strong> /openapi.json</code> — OpenAPI 3.0 specification</li>
    ${routesList}
  </ul>
</body>
</html>`;
}
