/**
 * MCP endpoint — Streamable HTTP, stateless JSON-RPC over a single POST.
 * GET/DELETE → 405 (no SSE stream in v1).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { handleJsonRpc, parseErrorResponse, rateLimited } from '@/lib/mcp/server';
import { MCP_TOOLS, callMcpTool } from '@/lib/mcp/tools';

export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown';
  if (rateLimited(`mcp:${ip}`)) {
    return res.status(429).json(parseErrorResponse());
  }

  const body = req.body;
  if (body === undefined || body === null || typeof body === 'string') {
    return res.status(400).json(parseErrorResponse());
  }

  const response = await handleJsonRpc(body, { tools: MCP_TOOLS, callTool: callMcpTool });
  if (response === null) return res.status(202).end();
  return res.status(200).json(response);
}
