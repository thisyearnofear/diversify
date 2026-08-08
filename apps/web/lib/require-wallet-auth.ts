/**
 * Server-side wallet-session verification for user-scoped APIs.
 * Derives the address from a signed message — never trust client userAddress.
 */

import type { NextApiRequest } from 'next';
import { ethers } from 'ethers';
import { parseWalletAuthMessage } from '@/lib/wallet-auth';

const MAX_AUTH_TTL_MS = 20 * 60 * 1000;

export function requireWalletAuth(req: NextApiRequest): string | null {
  const encodedMessage = req.headers['x-wallet-auth-message'];
  const signature = req.headers['x-wallet-auth-signature'];
  if (typeof encodedMessage !== 'string' || typeof signature !== 'string') return null;

  try {
    const message = decodeURIComponent(encodedMessage);
    const payload = parseWalletAuthMessage(message);
    if (!payload) return null;
    const issuedAt = Date.parse(payload.issuedAt);
    const expiresAt = Date.parse(payload.expiresAt);
    const now = Date.now();
    if (
      issuedAt > now + 60_000 ||
      expiresAt <= now ||
      expiresAt - issuedAt > MAX_AUTH_TTL_MS
    ) {
      return null;
    }
    const recovered = ethers.utils.verifyMessage(message, signature).toLowerCase();
    return recovered === payload.address.toLowerCase() ? recovered : null;
  } catch {
    return null;
  }
}
