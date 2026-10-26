/**
 * Server-side wallet-session verification for user-scoped APIs.
 * Derives the address from a signed message — never trust client userAddress.
 */

import type { NextApiRequest } from 'next';
import { ethers } from 'ethers';
import { parseWalletAuthMessage } from '@/lib/wallet-auth';

const MAX_AUTH_TTL_MS = 20 * 60 * 1000;

/**
 * Verify a signed wallet-auth payload. Returns the recovered lowercase
 * address, or null when the message is malformed, expired, or the
 * signature doesn't match the claimed address. Shared by the header path
 * (requireWalletAuth) and the MCP owner-only tools.
 */
export function verifyWalletAuth(
  message: string,
  signature: string,
): string | null {
  try {
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

export function requireWalletAuth(req: NextApiRequest): string | null {
  const encodedMessage = req.headers['x-wallet-auth-message'];
  const signature = req.headers['x-wallet-auth-signature'];
  if (typeof encodedMessage !== 'string' || typeof signature !== 'string') return null;
  const message = decodeURIComponent(encodedMessage);
  return verifyWalletAuth(message, signature);
}
