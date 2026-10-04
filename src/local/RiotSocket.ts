import { Agent, type Dispatcher, WebSocket as UndiciWebSocket } from "undici";

export type RiotEventType = "Create" | "Update" | "Delete";

export interface RiotFrame {
  uri: string;
  eventType: RiotEventType;
  data: unknown;
}

export type RiotSocketCredentials = { port: number; password: string };
export type RiotCredentialsResolver = () => RiotSocketCredentials | null;

export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener?(type: string, listener: (event: unknown) => void): void;
  removeEventListener?(type: string, listener: (event: unknown) => void): void;
  onopen?: ((event: unknown) => void) | null;
  onmessage?: ((event: { data: unknown }) => void) | null;
  onclose?: ((event: unknown) => void) | null;
  onerror?: ((event: unknown) => void) | null;
}

export type WebSocketConstructor = new (
  url: string | URL,
  options?: { dispatcher?: Dispatcher; headers?: Record<string, string> },
) => WebSocketLike;

export interface RiotSocketOptions {
  agent?: Dispatcher;
  WebSocketImpl?: WebSocketConstructor;
  reconnectMs?: number;
}

export function parseFrame(raw: string | unknown): RiotFrame | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length < 3 ||
    parsed[0] !== 8 ||
    parsed[1] !== "OnJsonApiEvent"
  ) {
    return null;
  }

  const payload = parsed[2] as
    { uri?: unknown; eventType?: unknown; data?: unknown } | null | undefined;
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (typeof payload.uri !== "string" || payload.uri.length === 0) {
    return null;
  }

  const eventType = payload.eventType;
  if (eventType !== "Create" && eventType !== "Update" && eventType !== "Delete") {
    return null;
  }

  return {
    uri: payload.uri,
    eventType,
    data: payload.data,
  };
}

export class RiotSocket {
  private readonly credentialsResolver: RiotCredentialsResolver;
  private readonly reconnectMs: number;
  private readonly webSocketImpl?: WebSocketConstructor;
  private readonly agent: Dispatcher;

  private ws: WebSocketLike | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private started = false;
  private connected = false;

  private readonly frameListeners = new Set<(frame: RiotFrame) => void>();
  private readonly statusListeners = new Set<(connected: boolean) => void>();

  constructor(
    credentialsOrPort: RiotCredentialsResolver | RiotSocketCredentials | number,
    passwordOrOptions?: string | RiotSocketOptions,
    options?: RiotSocketOptions,
  ) {
    if (typeof credentialsOrPort === "number" && typeof passwordOrOptions === "string") {
      this.credentialsResolver = () => ({ port: credentialsOrPort, password: passwordOrOptions });
      this.reconnectMs = options?.reconnectMs ?? 5000;
      this.webSocketImpl = options?.WebSocketImpl;
      this.agent = options?.agent ?? new Agent({ connect: { rejectUnauthorized: false } });
    } else {
      const opts = (passwordOrOptions as RiotSocketOptions) ?? {};
      this.credentialsResolver =
        typeof credentialsOrPort === "function"
          ? credentialsOrPort
          : () => credentialsOrPort as RiotSocketCredentials;
      this.reconnectMs = opts.reconnectMs ?? 5000;
      this.webSocketImpl = opts.WebSocketImpl;
      this.agent = opts.agent ?? new Agent({ connect: { rejectUnauthorized: false } });
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.connect();
  }

  stop(): void {
    this.started = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        ws.close();
      } catch {}
    }
    this.setConnected(false);
  }

  onFrame(listener: (frame: RiotFrame) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private connect(): void {
    if (!this.started) return;
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      try {
        oldWs.close();
      } catch {}
    }

    const creds = this.credentialsResolver();
    if (!creds) {
      this.setConnected(false);
      this.scheduleReconnect();
      return;
    }

    const auth = Buffer.from(`riot:${creds.password}`).toString("base64");
    const url = `wss://127.0.0.1:${creds.port}`;
    const Ctor = (this.webSocketImpl ?? UndiciWebSocket) as unknown as WebSocketConstructor;

    try {
      const ws = new Ctor(url, {
        dispatcher: this.agent,
        headers: { Authorization: `Basic ${auth}` },
      });
      this.ws = ws;
      this.attachHandlers(ws);
    } catch {
      this.setConnected(false);
      this.scheduleReconnect();
    }
  }

  private attachHandlers(ws: WebSocketLike): void {
    let closed = false;

    const onOpen = () => {
      if (this.ws !== ws) return;
      try {
        ws.send(JSON.stringify([5, "OnJsonApiEvent"]));
      } catch {}
      this.setConnected(true);
    };

    const onMessage = (event: { data: unknown }) => {
      if (this.ws !== ws) return;
      const raw = typeof event.data === "string" ? event.data : String(event.data ?? "");
      const frame = parseFrame(raw);
      if (!frame) return;
      for (const listener of this.frameListeners) {
        try {
          listener(frame);
        } catch {}
      }
    };

    const onCloseOrError = () => {
      if (closed) return;
      closed = true;
      if (this.ws === ws) {
        this.ws = null;
      }
      this.setConnected(false);
      this.scheduleReconnect();
    };

    if (typeof ws.addEventListener === "function") {
      ws.addEventListener("open", onOpen);
      ws.addEventListener("message", onMessage as (event: unknown) => void);
      ws.addEventListener("close", onCloseOrError);
      ws.addEventListener("error", onCloseOrError);
    } else {
      ws.onopen = onOpen;
      ws.onmessage = onMessage;
      ws.onclose = onCloseOrError;
      ws.onerror = onCloseOrError;
    }
  }

  private setConnected(next: boolean): void {
    if (this.connected === next) return;
    this.connected = next;
    for (const listener of this.statusListeners) {
      try {
        listener(next);
      } catch {}
    }
  }

  private scheduleReconnect(): void {
    if (!this.started || this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectMs);
  }
}
