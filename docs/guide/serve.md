# Serve Mode (HTTP Server & SSE)

Serve mode exposes the full Riot Client integration as a lightweight, framework-free HTTP server built with Node's native `node:http` module. It allows any tool or programming language to read account data, execute validated writes, and subscribe to real-time events over standard HTTP without spawning child processes.

## Starting the Server

### From the CLI

```bash
# Start on loopback default (127.0.0.1:47800)
riotclient serve

# Custom port and response cache TTL
riotclient serve --port 47800 --cache 30

# Allow binding to an external network interface
riotclient serve --host 0.0.0.0 --allow-remote
```

### Programmatically in Node.js / TypeScript

```typescript
import { RiotClient } from "@valoranchi/riot-client";

const client = new RiotClient();
const server = await client.serve({
  port: 47800,
  host: "127.0.0.1",
});

console.log(`Server listening on ${server.url}`);

// Later, shutdown gracefully
await server.close();
```

---

## HTTP Endpoints

### 1. Read Operations (`GET /api/<namespace>/<method>`)

All read methods across all namespaces (`account`, `social`, `store`, `matches`, `party`) are available as `GET` requests. Query parameters are automatically parsed and passed to the underlying service:

```bash
# Account profile
curl -s http://127.0.0.1:47800/api/account/whoami

# Match history with query options
curl -s "http://127.0.0.1:47800/api/matches/list?count=5&queue=competitive"

# Item offers
curl -s http://127.0.0.1:47800/api/store/offers

# Current party
curl -s http://127.0.0.1:47800/api/party/current
```

### 2. Write Operations (`POST /api/<namespace>/<method>`)

Write operations accept a JSON payload in the request body.

- **Dry-run by default**: All writes default to dry-run validation (`?dryRun=1`). No game state changes are made unless you explicitly set `?dryRun=0`.
- **Confirmation-gated writes**: Critical operations (`matches/dodge`, `matches/leaveMatch`, `store/buy`, `account/saveSettings`) require explicit confirmation. When executing with `?dryRun=0`, you must supply both:
  1. The HTTP header `X-Confirm: yes`
  2. The JSON field `{ "confirm": true }` in the request body

Example dry-run equip:

```bash
curl -X POST http://127.0.0.1:47800/api/account/equip \
  -H "Content-Type: application/json" \
  -d '{"card":"0819fbcd-4bd4-c379-5384-52803440f2b2"}'
```

Example confirmed write (dodge):

```bash
curl -X POST "http://127.0.0.1:47800/api/matches/dodge?dryRun=0" \
  -H "Content-Type: application/json" \
  -H "X-Confirm: yes" \
  -d '{"confirm": true}'
```

### 3. Server-Sent Events (`GET /events`)

Stream live socket frames, presence updates, and watcher events over standard Server-Sent Events (SSE).

Filter events using the `?only=` query parameter with a comma-separated list of event names:

```bash
# Stream all events
curl -sN http://127.0.0.1:47800/events

# Stream only match lifecycle events
curl -sN "http://127.0.0.1:47800/events?only=pregame,locked,started,round,ended,left"
```

#### Consuming SSE in JavaScript / Browser

```javascript
const events = new EventSource("http://127.0.0.1:47800/events?only=pregame,round");

events.addEventListener("pregame", (e) => {
  const match = JSON.parse(e.data);
  console.log("Joined pregame lobby:", match.matchId);
});

events.addEventListener("round", (e) => {
  const { round, ally, enemy } = JSON.parse(e.data);
  console.log(`Round ${round}: ${ally} vs ${enemy}`);
});
```

### 4. Interactive Dashboard & Documentation

- **`GET /`**: Serves the interactive desktop dashboard in your browser with tabs for Home, Store, Wishlist, Matches, and Friends.
- **`GET /api`**: Serves an HTML page listing all active routes, link to the OpenAPI schema, and SSE stream.
- **`GET /openapi.json`**: Generates a valid OpenAPI 3.0 specification covering every method, route parameter, and JSON Schema definitions for domain models.

---

## Security

> [!IMPORTANT]
> The Riot Client local API exposes your authenticated session and game entitlements.

The serve HTTP server implements multiple layers of defense to protect your local session from cross-site requests and DNS rebinding attacks:

1. **Loopback Binding**: By default, serve mode strictly binds to loopback (`127.0.0.1` or `localhost`). Attempting to bind non-loopback hosts without `--allow-remote` (or `allowRemote: true`) immediately throws `ForbiddenHostError`.
2. **Host Header Validation**: All incoming requests must specify a `Host` header matching `127.0.0.1:<port>`, `localhost:<port>`, or `[::1]:<port>` (unless `allowRemote` is enabled). Any unexpected host returns `403 Forbidden` (`FORBIDDEN_HOST`), preventing DNS rebinding.
3. **Origin Checking**: If an `Origin` header is present (such as in browser-initiated requests), it must strictly match `http://<host>`. Cross-origin browser requests return `403 Forbidden` (`FORBIDDEN_ORIGIN`). Non-browser clients (such as curl and scripts without an `Origin` header) remain allowed.
4. **Content-Type Enforcement on POST**: All POST requests must provide `Content-Type: application/json` (optional charset permitted). Non-JSON POST requests return `415 Unsupported Media Type` (`UNSUPPORTED_MEDIA_TYPE`). This forces browsers to send a CORS preflight for cross-site calls.
5. **No CORS Allow Headers**: The server never returns `Access-Control-Allow-Origin` or related headers, ensuring cross-site browser preflights fail.

---

## HTTP Status Codes

Serve mode maps client errors directly to standard HTTP statuses:

| Status Code                    | Condition                                  | Example                                                               |
| :----------------------------- | :----------------------------------------- | :-------------------------------------------------------------------- |
| `200 OK`                       | Successful execution                       | Payload returned as JSON                                              |
| `400 Bad Request`              | Validation failure or missing confirmation | `{ "error": { "code": "VALIDATION", "reason": "confirm-required" } }` |
| `403 Forbidden`                | Invalid Host header or foreign Origin      | `{ "error": { "code": "FORBIDDEN_HOST" } }`                           |
| `415 Unsupported Media Type`   | Non-JSON Content-Type on POST              | `{ "error": { "code": "UNSUPPORTED_MEDIA_TYPE" } }`                   |
| `502 Bad Gateway`              | Riot remote API error                      | Upstream Riot endpoint returned 4xx or 5xx                            |
| `503 Service Unavailable`      | Riot Client is closed or starting up       | `RIOT_CLIENT_NOT_RUNNING` or `RIOT_CLIENT_NOT_READY`                  |
| `500 Internal Error`           | Unexpected server exception                | Internal unhandled error                                              |
