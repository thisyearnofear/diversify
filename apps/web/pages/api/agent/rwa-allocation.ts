/**
 * POST /api/agent/rwa-allocation — IXS RWA vault allocation advisor.
 *
 * Free-first (SERV Hackathon Edition 01, RWA Vaults track): every caller —
 * no wallet, no keys — gets a deterministic heuristic allocation across the
 * licensed IXS vault catalog. Opt-in `serv: true` (body or ?serv=1) asks
 * SERV Reasoning to re-weight + explain, but ONLY when SERV_API_KEY is
 * configured server-side; any SERV failure (timeout, expired credits,
 * malformed output) returns the heuristic with `degradedReason` set — never
 * a 5xx for a third-party outage. Per-IP rate limit bounds the SERV spend.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getRwaAllocation, type AllocationProfile } from '@diversifi/shared/src/services/serv/rwa-allocator';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

const RATE_LIMIT = 15; // requests
const RATE_WINDOW_MS = 60_000; // per minute

const KNOWN_PHILOSOPHIES = new Set([
  'global', 'africapitalism', 'buen_vivir', 'pan_caribbean',
  'confucian', 'gotong_royong', 'islamic', 'rwa_access', 'inflation_protection',
]);
const KNOWN_RISK = new Set(['Conservative', 'Balanced', 'Aggressive']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`rwa-allocation:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  const philosophy = typeof body.philosophy === 'string' && KNOWN_PHILOSOPHIES.has(body.philosophy)
    ? body.philosophy
    : null;
  const riskTolerance = typeof body.riskTolerance === 'string' && KNOWN_RISK.has(body.riskTolerance)
    ? body.riskTolerance
    : null;
  const region = typeof body.region === 'string' && body.region.length <= 64 ? body.region : null;
  const amountUsd =
    typeof body.amountUsd === 'number' && Number.isFinite(body.amountUsd)
      ? Math.min(Math.max(body.amountUsd, 0), 1_000_000_000)
      : null;

  // Explicit opt-in only — body flag or ?serv=1.
  const servRequested = body.serv === true || req.query.serv === '1' || req.query.serv === 'true';

  const profile: AllocationProfile = { philosophy, riskTolerance, region, amountUsd };

  try {
    const result = await getRwaAllocation(profile, { servRequested });
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json(result);
  } catch (err) {
    // getRwaAllocation never throws by contract — this is belt-and-braces so a
    // caller still gets a clean heuristic-shaped failure rather than a stack.
    console.error('[api/agent/rwa-allocation] failed:', err instanceof Error ? err.message : err);
    return res.status(200).json({
      source: 'heuristic',
      allocations: [],
      summary: 'Allocation temporarily unavailable — try again.',
      degradedReason: 'internal_error',
      servRequested,
      servAvailable: false,
    });
  }
}
