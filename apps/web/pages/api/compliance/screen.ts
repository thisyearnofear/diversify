/**
 * GET /api/compliance/screen?address=0x… — wallet sanctions screening.
 *
 * Thin pass-through to the shared screening service (Chainalysis). The API
 * key lives server-side and is never echoed. Blocks are logged — declines
 * are recorded, not hidden.
 *
 * Rate limit: this route runs as a Vercel lambda (it isn't in the
 * next.config.js Hetzner rewrites), so the in-memory window is best-effort
 * per instance — the same caveat as /api/analytics/event. The shared
 * service's 24h result cache is the other cost guard: a flooded key still
 * can't amplify Chainalysis calls for already-screened addresses.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { screenAddress } from '@diversifi/shared/src/services/compliance/sanctions-screening.service';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute per IP

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const limit = rateLimit(`compliance-screen:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return res.status(429).json({ status: 'unavailable', reason: 'rate_limited' });
  }

  const address = typeof req.query.address === 'string' ? req.query.address : '';
  const result = await screenAddress(address);

  if (result.status === 'blocked') {
    console.warn('[compliance] sanctions_block', { address: address.toLowerCase() });
  }

  return res.status(200).json(result);
}
