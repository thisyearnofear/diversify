/**
 * Lightweight server-side per-IP rate limiting (in-memory, fixed window).
 *
 * Single-process (PM2) friendly. No external deps. Throttles the unauthenticated
 * money surfaces (best-yield, speak/transcribe) so one client can't flood them
 * with cost-amplifying requests. Pairs with the process-global daily budget
 * breaker in @diversifi/shared (daily-budget.ts) — this caps request RATE per
 * caller, that caps total SPEND per day. Neither is a substitute for auth.
 * A restart resets the windows (acceptable for a throttle).
 */

import type { NextApiRequest } from 'next';

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Best-effort client IP for keying limits. */
export function getClientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  return ip;
}

/**
 * Fixed-window rate limit. Returns { allowed, remaining, retryAfterSec }.
 * `key` should include the route + client IP.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const w = windows.get(key);
  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (w.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }
  w.count += 1;
  return { allowed: true, remaining: limit - w.count, retryAfterSec: 0 };
}
