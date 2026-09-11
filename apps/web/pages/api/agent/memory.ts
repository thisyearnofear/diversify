/**
 * DELETE /api/agent/memory — forget the Guardian's long-term memory for
 * the signed-in wallet.
 *
 * Clears the server-side memory backends: the Cognee dataset
 * `user_<address>` and the Tablestore scope for the wallet. The local
 * transcript (`diversifi-conversation:<address>` in localStorage) is NOT
 * touched here — the client clears that itself as part of "New
 * conversation".
 *
 * Auth: wallet-signed via X-Wallet-Auth-Message / X-Wallet-Auth-Signature
 * (same session proof as /api/agent/business/cycles). The address is
 * recovered from the signature — never trusted from the request body.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import { cogneeMemoryService, tablestoreMemoryService } from '@diversifi/shared';

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

interface MemoryForgetResponse {
  success: boolean;
  /** true only when the backend was reached and confirmed deletion */
  cognee: boolean;
  tablestore: boolean;
  /**
   * Whether each backend is configured at all. Lets callers tell
   * "nothing to delete" (available: false, backend: false) apart from a
   * real failure (available: true, backend: false).
   */
  available: { cognee: boolean; tablestore: boolean };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MemoryForgetResponse | { error: string }>,
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { allowed, retryAfterSec } = rateLimit(`memory:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — try again shortly.' });
  }

  const userAddress = requireWalletAuth(req);
  if (!userAddress) {
    return res.status(401).json({ error: 'Wallet signature required' });
  }

  const [cognee, tablestore] = await Promise.allSettled([
    cogneeMemoryService.forget(userAddress),
    tablestoreMemoryService.forget(userAddress),
  ]);

  // 200 even when a backend is unavailable — forget() resolves
  // { success: false } when unconfigured, which means "nothing to
  // delete", not a failure. The per-backend booleans report what was
  // actually confirmed deleted; `available` distinguishes "not
  // configured" from "configured but failed".
  return res.status(200).json({
    success: true,
    cognee: cognee.status === 'fulfilled' && cognee.value.success === true,
    tablestore: tablestore.status === 'fulfilled' && tablestore.value.success === true,
    available: {
      cognee: cogneeMemoryService.isAvailable(),
      tablestore: tablestoreMemoryService.isAvailable(),
    },
  });
}
