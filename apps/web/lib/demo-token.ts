/**
 * Server-issued demo session token.
 *
 * Sample mode must not consume a visitor's real daily question allowance,
 * but a client-asserted flag ("demo: true") is an honor system — anyone can
 * spoof it into unlimited paid LLM calls. So demo status is proven by a
 * short-lived HMAC token minted by this server (POST /api/agent/demo-token)
 * and carried in the advisor request body.
 *
 * Token = `<expEpochMs>.<hex hmac>` signed over the expiry and the issuing
 * client's IP prefix — verification recomputes the MAC against the *current*
 * request's prefix, so a token is softly bound to the network it was minted
 * on (tolerates IP rotation within the prefix, blocks casual sharing). It
 * never embeds the IP itself.
 *
 * Secret: DEMO_TOKEN_SECRET. In production, missing secret = fail closed
 * (no token can be minted or verified; demo requests fall back to normal
 * IP-keyed gating). Dev gets a fixed fallback so local demo mode works with
 * no env.
 */

import { createHmac } from 'crypto';
import { constantTimeEqual } from '@diversifi/shared/src/utils/security';

const DEV_FALLBACK_SECRET = 'diversifi-dev-demo-token-secret';
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function signingKey(): string | null {
  const secret = process.env.DEMO_TOKEN_SECRET;
  if (secret) return secret;
  return process.env.NODE_ENV === 'production' ? null : DEV_FALLBACK_SECRET;
}

/**
 * Coarse network bucket for soft IP binding: IPv4 /24, IPv6 /64.
 * 'unknown' (or anything unparseable) maps to itself — mint and verify
 * use the same function, so binding stays consistent.
 */
export function demoIpPrefix(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    return parts.slice(0, 3).join('.');
  }
  if (ip.includes(':')) {
    const groups = ip.toLowerCase().split(':');
    // Expand '::' shorthand so the first 4 groups are comparable.
    const gap = groups.indexOf('');
    if (gap !== -1) {
      groups.splice(gap, 1);
      while (groups.length < 8) groups.splice(gap, 0, '0');
    }
    return groups.slice(0, 4).join(':');
  }
  return ip;
}

function mac(secret: string, expEpochMs: number, ipPrefix: string): string {
  return createHmac('sha256', secret)
    .update(`exp:${expEpochMs}:${ipPrefix}`)
    .digest('hex');
}

export interface DemoTokenMint {
  token: string;
  expiresAt: string;
}

/** Mint a demo token for the requesting client. Null if production has no secret. */
export function mintDemoToken(ip: string, now: Date = new Date()): DemoTokenMint | null {
  const secret = signingKey();
  if (!secret) return null;
  const exp = now.getTime() + TOKEN_TTL_MS;
  return {
    token: `${exp}.${mac(secret, exp, demoIpPrefix(ip))}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

/** Verify a demo token against the current request's IP. */
export function verifyDemoToken(token: unknown, ip: string, now: Date = new Date()): boolean {
  if (typeof token !== 'string') return false;
  const sep = token.indexOf('.');
  if (sep <= 0) return false;
  const exp = Number.parseInt(token.slice(0, sep), 10);
  const sig = token.slice(sep + 1);
  if (!Number.isFinite(exp) || exp <= now.getTime()) return false;
  const secret = signingKey();
  if (!secret) return false;
  return constantTimeEqual(sig, mac(secret, exp, demoIpPrefix(ip)));
}

/** Allowance subject for a verified demo session — its own bucket. */
export function demoSubject(ip: string): string {
  return `demo:${demoIpPrefix(ip)}`;
}
