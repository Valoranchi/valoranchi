import readline from "node:readline";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { RiotClientNotRunningError } from "../src/errors.js";
import { McpServer } from "../src/mcp/McpServer.js";
import { getMcpTools } from "../src/mcp/tools.js";
import type { RiotClient } from "../src/RiotClient.js";

function createHarness(client: unknown) {
  const input = new PassThrough();
  const output = new PassThrough();
  const server = new McpServer(client as RiotClient, { input, output, version: "0.4.0" });
  void server.start();

  const queuedLines: string[] = [];
  const lineWaiters: ((line: string) => void)[] = [];

  const rl = readline.createInterface({ input: output, terminal: false });
  rl.on("line", (line) => {
    const waiter = lineWaiters.shift();
    if (waiter) {
      waiter(line);
    } else {
      queuedLines.push(line);
    }
  });

  const getNextLine = (): Promise<string> => {
    if (queuedLines.length > 0) {
      return Promise.resolve(queuedLines.shift()!);
    }
    return new Promise<string>((resolve) => {
      lineWaiters.push(resolve);
    });
  };

  const send = async (msg: Record<string, unknown>): Promise<Record<string, unknown>> => {
    input.write(`${JSON.stringify(msg)}\n`);
    const line = await getNextLine();
    return JSON.parse(line) as Record<string, unknown>;
  };

  const sendRaw = async (raw: string): Promise<Record<string, unknown>> => {
    input.write(`${raw}\n`);
    const line = await getNextLine();
    return JSON.parse(line) as Record<string, unknown>;
  };

  const close = async (): Promise<void> => {
    input.end();
    server.close();
  };

  return { input, output, server, send, sendRaw, getNextLine, close };
}

describe("MCP Server", () => {
  const mockWhoami = vi.fn().mockResolvedValue({
    puuid: "player-uuid",
    gameName: "Player",
    tagLine: "0001",
    region: "na",
  });

  const mockWallet = vi.fn().mockResolvedValue({
    vp: 2500,
    radianite: 120,
    freeVp: 0,
  });

  const mockMatchesList = vi.fn().mockResolvedValue([{ id: "match-1", queue: "competitive" }]);

  const mockMatchProgress = vi.fn().mockResolvedValue({
    matchId: "ec8f25d1-075d-45e5-84ae-ef3891b73827",
    agentMastery: null,
    contracts: null,
    daily: null,
  });

  const fakeClient = {
    account: {
      whoami: mockWhoami,
      wallet: mockWallet,
      agentMastery: vi.fn().mockResolvedValue([]),
      dailyCheckpoints: vi.fn().mockResolvedValue({ checkpoints: [] }),
      matchProgress: mockMatchProgress,
    },
    matches: {
      list: mockMatchesList,
    },
    official: {
      profile: vi.fn().mockResolvedValue({ account: { puuid: "p" }, rank: null }),
    },
    social: {},
    store: {},
    party: {},
  };

  it("handles initialize handshake and version negotiation", async () => {
    const harness = createHarness(fakeClient);

    const initEcho = await harness.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    });

    expect(initEcho).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: {
          name: "valoranchi-riot-client",
          version: "0.4.0",
        },
      },
    });

    const initFallback = await harness.send({
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: "2020-01-01" },
    });
    expect((initFallback.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");

    await harness.close();
  });

  it("lists tools containing account_whoami and no POST routes", async () => {
    const harness = createHarness(fakeClient);

    const res = await harness.send({
      jsonrpc: "2.0",
      id: "tools-list-id",
      method: "tools/list",
    });

    const result = res.result as {
      tools: Array<{ name: string; description: string; inputSchema: unknown }>;
    };
    expect(result.tools.length).toBeGreaterThan(0);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("account_whoami");
    expect(toolNames).toContain("account_wallet");
    expect(toolNames).toContain("matches_list");

    expect(toolNames).not.toContain("store_buy");
    expect(toolNames).not.toContain("matches_dodge");
    expect(toolNames).not.toContain("matches_leaveMatch");
    expect(toolNames).not.toContain("social_sendMessage");
    expect(toolNames).not.toContain("account_equip");
    expect(toolNames).not.toContain("account_saveSettings");

    const directTools = getMcpTools();
    expect(directTools.map((t) => t.name)).toEqual(toolNames);

    await harness.close();
  });

  it("executes tools/call account_wallet returning structured content", async () => {
    const harness = createHarness(fakeClient);

    const res = await harness.send({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "account_wallet",
        arguments: {},
      },
    });

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: 10,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({ vp: 2500, radianite: 120, freeVp: 0 }),
          },
        ],
        structuredContent: { vp: 2500, radianite: 120, freeVp: 0 },
      },
    });

    await harness.close();
  });

  it("passes arguments through to dispatchApiRoute in tools/call", async () => {
    const harness = createHarness(fakeClient);

    await harness.send({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "matches_list",
        arguments: { count: 5, queue: "competitive" },
      },
    });

    expect(mockMatchesList).toHaveBeenCalledWith({
      count: 5,
      queue: "competitive",
    });

    await harness.close();
  });

  it("formats RiotClientError as isError tool call result", async () => {
    const failingClient = {
      account: {
        wallet: vi.fn().mockRejectedValue(new RiotClientNotRunningError("Riot Client not running")),
      },
    };
    const harness = createHarness(failingClient);

    const res = await harness.send({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: { name: "account_wallet" },
    });

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: 12,
      result: {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: {
                code: "RIOT_CLIENT_NOT_RUNNING",
                message: "Riot Client not running",
              },
            }),
          },
        ],
      },
    });

    await harness.close();
  });

  it("returns -32602 on unknown tool call", async () => {
    const harness = createHarness(fakeClient);

    const res = await harness.send({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: { name: "invalid_tool_name" },
    });

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: 13,
      error: {
        code: -32602,
        message: "Unknown tool: invalid_tool_name",
      },
    });

    await harness.close();
  });

  it("returns -32601 on unknown method", async () => {
    const harness = createHarness(fakeClient);

    const res = await harness.send({
      jsonrpc: "2.0",
      id: 14,
      method: "unsupported/method",
    });

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: 14,
      error: {
        code: -32601,
        message: "Method not found: unsupported/method",
      },
    });

    await harness.close();
  });

  it("returns -32700 on invalid JSON", async () => {
    const harness = createHarness(fakeClient);

    const res = await harness.sendRaw("{ invalid json syntax");

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error",
      },
    });

    await harness.close();
  });

  it("does not reply to notifications including notifications/initialized", async () => {
    const harness = createHarness(fakeClient);

    harness.input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    harness.input.write('{"jsonrpc":"2.0","method":"custom/notify","params":{}}\n');

    const pingRes = await harness.send({
      jsonrpc: "2.0",
      id: 99,
      method: "ping",
    });

    expect(pingRes).toEqual({
      jsonrpc: "2.0",
      id: 99,
      result: {},
    });

    await harness.close();
  });

  it("exposes official tools and hides alias routes", () => {
    const names = getMcpTools().map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["official_profile", "official_summary"]));
    expect(names).not.toEqual(expect.arrayContaining(["matches_matches"]));
    expect(names).not.toContain("store_store");
    expect(names).not.toContain("party_party");
  });

  it("calls an official tool with its arguments", async () => {
    const harness = createHarness(fakeClient);
    const res = await harness.send({
      jsonrpc: "2.0",
      id: 20,
      method: "tools/call",
      params: { name: "official_profile", arguments: { riotId: "Foo#BAR", count: 5 } },
    });
    expect(fakeClient.official.profile).toHaveBeenCalledWith("Foo#BAR", { count: 5 });
    expect((res.result as { structuredContent: unknown }).structuredContent).toEqual({
      account: { puuid: "p" },
      rank: null,
    });
    await harness.close();
  });

  it("exposes the progression tools and requires the match id for matches_progress", () => {
    const tools = getMcpTools();
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["account_mastery", "account_dailies", "matches_progress"]),
    );
    expect(tools.find((t) => t.name === "matches_progress")?.inputSchema.required).toEqual([
      "matchId",
    ]);
  });

  it("calls the match progress tool with its match id", async () => {
    const matchId = "ec8f25d1-075d-45e5-84ae-ef3891b73827";
    const harness = createHarness(fakeClient);
    const res = await harness.send({
      jsonrpc: "2.0",
      id: 22,
      method: "tools/call",
      params: { name: "matches_progress", arguments: { matchId } },
    });
    expect(mockMatchProgress).toHaveBeenCalledWith(matchId);
    expect((res.result as { structuredContent: unknown }).structuredContent).toEqual({
      matchId,
      agentMastery: null,
      contracts: null,
      daily: null,
    });
    await harness.close();
  });

  it("leaves structuredContent out when a tool returns a list", async () => {
    const harness = createHarness(fakeClient);
    const res = await harness.send({
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: { name: "matches_list", arguments: {} },
    });
    expect(res.result).not.toHaveProperty("structuredContent");
    await harness.close();
  });
});
