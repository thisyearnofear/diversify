/**
 * MCP server plumbing — hand-rolled JSON-RPC 2.0 for the Streamable
 * HTTP transport (single POST endpoint, stateless, no session id).
 * TODO(x402): meter anonymous calls via the credit model.
 */

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> } & Record<string, unknown>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface McpContext {
  tools: McpTool[];
  callTool: ToolHandler;
}

export const MCP_SERVER_INFO = {
  protocolVersion: '2025-03-26',
  capabilities: { tools: {} },
  serverInfo: { name: 'diversifi-guardian', version: '1.0.0' },
  instructions:
    'Read-only FX-risk intelligence: currency moments, corridor signals, token provenance, cycle reports, and the public ledger feed. The only write tool (propose_move) files a PROPOSAL into the owner\'s Guardian queue; nothing executes without the owner\'s wallet signature in the app.',
};

function result(id: JsonRpcRequest['id'], value: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result: value };
}

function error(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleOne(req: JsonRpcRequest, ctx: McpContext) {
  if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return error(req?.id ?? null, -32600, 'Invalid Request');
  }
  if (req.method.startsWith('notifications/')) return null;
  const id = req.id ?? null;
  switch (req.method) {
    case 'initialize':
      return result(id, MCP_SERVER_INFO);
    case 'ping':
      return result(id, {});
    case 'tools/list':
      return result(id, { tools: ctx.tools });
    case 'tools/call': {
      const name = req.params?.name;
      if (typeof name !== 'string' || !ctx.tools.some((t) => t.name === name)) {
        return error(id, -32602, `Unknown tool: ${String(name)}`);
      }
      try {
        const out = await ctx.callTool(name, (req.params?.arguments ?? {}) as Record<string, unknown>);
        return result(id, { content: [{ type: 'text', text: JSON.stringify(out) }] });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Tool failed';
        return result(id, {
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
          isError: true,
        });
      }
    }
    default:
      return error(id, -32601, `Method not found: ${req.method}`);
  }
}

/** Handles a single request or a batch; null → respond 202 empty. */
export async function handleJsonRpc(body: unknown, ctx: McpContext) {
  if (Array.isArray(body)) {
    if (body.length === 0) return error(null, -32600, 'Invalid Request');
    const results = await Promise.all(body.map((r) => handleOne(r, ctx)));
    const kept = results.filter((r) => r !== null);
    return kept.length > 0 ? kept : null;
  }
  return handleOne(body as JsonRpcRequest, ctx);
}

export function parseErrorResponse() {
  return error(null, -32700, 'Parse error');
}

/* Tiny per-key token bucket (60 req/min default), in-memory. */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimited(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count += 1;
  return b.count > limit;
}
