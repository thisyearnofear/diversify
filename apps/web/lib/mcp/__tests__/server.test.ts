import { describe, expect, it } from "vitest";
import { handleJsonRpc, MCP_SERVER_INFO, type McpContext } from "../server";

const ctx: McpContext = {
  tools: [
    {
      name: "echo",
      description: "test",
      inputSchema: { type: "object" },
    },
  ],
  callTool: async (name, args) => ({ echoed: args }),
};

describe("handleJsonRpc", () => {
  it("answers initialize with the server info", async () => {
    const res = (await handleJsonRpc(
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      ctx,
    )) as { result: typeof MCP_SERVER_INFO };
    expect(res.result.serverInfo.name).toBe("diversifi-guardian");
    expect(res.result.protocolVersion).toBe("2025-03-26");
  });

  it("lists tools", async () => {
    const res = (await handleJsonRpc(
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ctx,
    )) as { result: { tools: { name: string }[] } };
    expect(res.result.tools.map((t) => t.name)).toEqual(["echo"]);
  });

  it("returns -32601 for an unknown method", async () => {
    const res = (await handleJsonRpc(
      { jsonrpc: "2.0", id: 3, method: "bogus/method" },
      ctx,
    )) as { error: { code: number } };
    expect(res.error.code).toBe(-32601);
  });

  it("returns -32602 for an unknown tool", async () => {
    const res = (await handleJsonRpc(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope", arguments: {} } },
      ctx,
    )) as { error: { code: number } };
    expect(res.error.code).toBe(-32602);
  });

  it("calls a stubbed tool and wraps the result as text content", async () => {
    const res = (await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "echo", arguments: { hi: 1 } },
      },
      ctx,
    )) as { result: { content: { type: string; text: string }[] } };
    expect(JSON.parse(res.result.content[0].text)).toEqual({ echoed: { hi: 1 } });
  });

  it("handles a batch and drops notifications", async () => {
    const res = (await handleJsonRpc(
      [
        { jsonrpc: "2.0", id: 6, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
      ],
      ctx,
    )) as unknown[];
    expect(Array.isArray(res)).toBe(true);
    expect(res).toHaveLength(1);
  });

  it("returns null for notifications-only batches", async () => {
    const res = await handleJsonRpc(
      [{ jsonrpc: "2.0", method: "notifications/initialized" }],
      ctx,
    );
    expect(res).toBeNull();
  });
});
