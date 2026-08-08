/**
 * GET /api/healthz
 *
 * Canonical liveness/readiness probe. Designed to be hit by an external
 * monitor (UptimeRobot, BetterStack, K8s liveness probe, etc.) on a 30s
 * cadence. Returns 200 only when all checks pass; 503 on any failure so
 * alerting fires immediately.
 *
 * Checks:
 *   - mongo:  dbConnect + admin ping
 *   - venice: a real chat completion with a tiny prompt and a tight timeout
 *   - intelligence: in-process record of the last /api/agent/intelligence call
 *     (success/failure count, last timestamp, last error)
 *
 * The endpoint is intentionally cache-control:no-store so probes always
 * see fresh state. The response body is small (<1 KB) so a high-frequency
 * monitor doesn't add real load.
 *
 * The endpoint itself does NOT require auth — a probe server wouldn't have
 * the GUARDIAN_LOOP_SECRET. If exposed publicly, rate-limit at the edge.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../lib/mongodb';
import { AIService } from '@diversifi/shared';

const STARTED_AT = Date.now();
const VENICE_PROBE_TIMEOUT_MS = 6000;
const VENICE_PROMPT = 'Reply with the single word: ok';
// The current default Venice model (deepseek-v4-flash) emits chain-of-thought
// tokens before any visible content. A 5-token cap is consumed by thinking and
// the response ships as content="" with finish_reason="length", which the
// healthz probe (correctly) treats as a failure. 64 tokens is enough for
// the model to finish thinking AND emit a short answer, and at ~$1/M tokens
// the cost is well under $1/day even at 30s probe cadence.
const VENICE_PROBE_MAX_TOKENS = 64;

export type IntelligenceHealth = {
  ok: boolean;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  successCount: number;
  failureCount: number;
};

const intelligenceHealth: IntelligenceHealth = {
  // Start optimistic: no calls yet means we haven't seen a failure. A failure
  // flips this to false until the next success. The /api/healthz consumer
  // can still see `lastSuccessAt: null` and decide how to treat a fresh process.
  ok: true,
  lastSuccessAt: null,
  lastError: null,
  lastDurationMs: null,
  successCount: 0,
  failureCount: 0,
};

/**
 * Called by /api/agent/intelligence on each request. Module-scope state
 * survives across requests in the same Node process. Resets to "not ok"
 * on failure so a stalled intelligence stream surfaces here.
 */
export function recordIntelligenceSuccess(durationMs: number): void {
  intelligenceHealth.ok = true;
  intelligenceHealth.lastSuccessAt = new Date().toISOString();
  intelligenceHealth.lastDurationMs = durationMs;
  intelligenceHealth.lastError = null;
  intelligenceHealth.successCount += 1;
}

export function recordIntelligenceFailure(error: string, durationMs: number): void {
  intelligenceHealth.ok = false;
  intelligenceHealth.lastError = error;
  intelligenceHealth.lastDurationMs = durationMs;
  intelligenceHealth.failureCount += 1;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  res.setHeader('cache-control', 'no-store');

  const checks: Record<string, unknown> = {};

  // ── Mongo ──────────────────────────────────────────────────────────────
  const mongoStart = Date.now();
  try {
    await dbConnect();
    const mongoose = (await import('mongoose')).default;
    const conn = mongoose.connection;
    if (conn.readyState !== 1 || !conn.db) {
      checks.mongo = {
        ok: false,
        readyState: conn.readyState,
        latencyMs: Date.now() - mongoStart,
        error: 'Connection not established',
      };
    } else {
      const pingResult = await conn.db.admin().ping();
      checks.mongo = {
        ok: pingResult?.ok === 1,
        readyState: conn.readyState,
        latencyMs: Date.now() - mongoStart,
      };
    }
  } catch (error: any) {
    checks.mongo = {
      ok: false,
      latencyMs: Date.now() - mongoStart,
      error: error?.message ?? String(error),
    };
  }

  // ── Venice (real network call with a tight timeout) ────────────────────
  // We don't trust AIService.getStatus() alone: it reports `initialized: true`
  // after a non-network client construction. A real chat completion with
  // max_tokens=5 catches DNS / TLS / 401 / 5xx in one shot.
  const veniceStart = Date.now();
  try {
    const result = await Promise.race([
      AIService.chat(
        {
          messages: [{ role: 'user', content: VENICE_PROMPT }],
          maxTokens: VENICE_PROBE_MAX_TOKENS,
        },
        'venice'
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Venice probe timed out after ${VENICE_PROBE_TIMEOUT_MS}ms`)), VENICE_PROBE_TIMEOUT_MS)
      ),
    ]);
    const content = (result as { content?: string; data?: string }).content
      ?? (result as { data?: string }).data
      ?? '';
    checks.venice = {
      ok: typeof content === 'string' && content.length > 0,
      latencyMs: Date.now() - veniceStart,
      replyChars: typeof content === 'string' ? content.length : 0,
    };
  } catch (error: any) {
    checks.venice = {
      ok: false,
      latencyMs: Date.now() - veniceStart,
      error: error?.message ?? String(error),
    };
  }

  // ── Intelligence (in-process) ──────────────────────────────────────────
  checks.intelligence = { ...intelligenceHealth };

  const allOk = Object.values(checks).every((c: any) => c?.ok === true);
  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeMs: Date.now() - STARTED_AT,
    checks,
  });
}
