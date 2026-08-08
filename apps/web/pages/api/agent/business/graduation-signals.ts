/**
 * GET  /api/agent/business/graduation-signals
 *   Returns the retail→business graduation signal for the requesting wallet:
 *   { shouldShow, confidence, signals: { cyclical, corridor, largerBalance, hasSavedCycle }, promptHeadline }
 *
 * POST /api/agent/business/graduation-signals
 *   Body: { action: 'dismiss' } → records dismissal in GuardianState so the
 *   prompt never reappears on subsequent requests (cross-device).
 *
 * Phase 4 graduation funnel per docs/sme-fx-implementation-plan.md.
 *
 * Per-wallet, not per-session: signals are aggregated from on-chain
 * activity (Transaction) and saved FX cycles (PurchaseCycle). 90-day
 * rolling window for deposits/withdrawals; 30-day for corridor swaps.
 *
 * Confidence weighting (max 1.0 each):
 *   - cyclical: 0.35        (≥ 3 deposits + ≥ 2 withdrawals in 90d)
 *   - corridor: 0.35        (≥ 2 local-stable → USD-stable swaps in 30d)
 *   - hasSavedCycle: 0.50   (user already entered the FX drag flow — prime
 *                            graduation target; the first place the prompt
 *                            must surface)
 *   - largerBalance: 0.20   (any single tx > $5,000 — proxy only; the
 *                            noisy signal that only fires when combined
 *                            with another)
 *
 * Should show fires when confidence ≥ 0.30. Real signals alone fire
 * (cyclical OR corridor OR hasSavedCycle each clear the threshold
 * independently); the noisy largerBalance alone doesn't.
 *
 * Non-prescriptive: the endpoint never returns a prescriptive
 * recommendation. It returns raw signal state. The frontend renders
 * neutral, evidence-based copy.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { Transaction } from '@/models/Transaction';
import { PurchaseCycle } from '@/models/PurchaseCycle';
import { GuardianState } from '@/models/GuardianState';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

// Mento regional stables (local). Map covers mainnet + sepolia naming
// variants seen across the codebase (cUSD/cEUR legacy, USDm/EURm rebranded).
// Normalized to UPPER so transaction logs that arrive as "KESM" or "KESm"
// both match. Compare with the all-upper NORMALIZED form below.
const LOCAL_STABLE_SYMBOLS = new Set<string>(
  [
    'USDm', 'EURm', 'KESm', 'GHSm', 'NGNm', 'PHPm', 'COPm', 'BRLm',
    'XOFm', 'ZARm', 'GBPm', 'CADm', 'AUDm', 'CHFm', 'JPYm', 'MXNB',
    'BRL1', 'NGN1', // legacy single-letter variants occasionally observed
  ].map((s) => s.toUpperCase()),
);

const USD_STABLE_SYMBOLS = new Set<string>(
  ['USDC', 'USDT', 'DAI', 'cUSD', 'USDm'].map((s) => s.toUpperCase()),
);

type Signals = {
  cyclical: boolean;
  corridor: boolean;
  largerBalance: boolean;
  hasSavedCycle: boolean;
};

type DismissedResponse = {
  shouldShow: boolean;
  dismissed: true;
  confidence: number;
  signals: Signals;
  promptHeadline: string;
};

type ResponseBody = {
  shouldShow: boolean;
  /** Set when the user previously dismissed the prompt. */
  dismissed?: boolean;
  confidence: number;
  signals: Signals;
  promptHeadline: string;
} | { error: string };

// The two paths (live evaluation vs dismissal short-circuit) both
// use the wider ResponseBody shape because TypeScript widens literal
// `true` to `boolean`. The runtime still emits `dismissed: true` on
// the dismissal path so the client can distinguish the two without
// parsing other fields.

const PROMPT_HEADLINE = 'Patterns in your recent activity.';

// Weight table. Each "real" signal (cyclical, corridor, hasSavedCycle)
// independently clears the 0.30 threshold — they're independent
// evidence of trader behaviour and shouldn't need to pair. The noisy
// `largerBalance` proxy stays below threshold alone; it only contributes
// when combined with another signal.
const CONFIDENCE_TABLE: Record<keyof Signals, number> = {
  cyclical: 0.35,
  corridor: 0.35,
  hasSavedCycle: 0.50,
  largerBalance: 0.20,
};

// Threshold: shouldShow fires when confidence ≥ 0.30. Real signals
// alone (cyclical OR corridor OR hasSavedCycle) each exceed this; only
// the largerBalance proxy can't fire alone.
const SHOW_THRESHOLD = 0.30;

const RATE_LIMIT = 10; // req/min/IP — the endpoint is read-mostly
const RATE_WINDOW_MS = 60_000;

function isLocalStableSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  return LOCAL_STABLE_SYMBOLS.has(symbol.toUpperCase().trim());
}

function isUsdStableSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  return USD_STABLE_SYMBOLS.has(symbol.toUpperCase().trim());
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>,
) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSec } = rateLimit(`graduation:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — try again shortly.' });
  }

  // Wallet auth is mandatory: signals are per-wallet.
  const userAddress = requireWalletAuth(req);
  if (!userAddress) {
    return res.status(401).json({ error: 'Wallet signature required' });
  }

  try {
    await dbConnect();
  } catch {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  // ── POST: dismiss + record dismissal in GuardianState ────────────────
  if (req.method === 'POST') {
    const action = req.body?.action;
    if (action !== 'dismiss') {
      return res.status(400).json({ error: 'Unsupported action' });
    }
    try {
      // Atomic upsert: set dismissal timestamp + create the GuardianState
      // row if missing. `findOneAndUpdate` is concurrent-safe; unlike
      // `create()` + catch-duplicate it doesn't race against the unique
      // index build.
      // POST response returns the dismiss shape; signals/headline are
      // deliberately omitted so future callers don't read the threshold
      // from a captured response.
      await GuardianState.findOneAndUpdate(
        { userAddress },
        { $set: { graduationPromptDismissedAt: new Date() }, $setOnInsert: { userAddress } },
        { upsert: true, new: true },
      );
      return res.status(200).json({
        shouldShow: false,
        dismissed: true,
        confidence: 0,
        signals: { cyclical: false, corridor: false, largerBalance: false, hasSavedCycle: false },
        promptHeadline: '',
      });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Dismiss failed' });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── GET: evaluate signals ────────────────────────────────────────────
  try {
    // Throttle: a dismissed user should never be re-evaluated. Return a
    // minimal response so we don't leak detection state (signals,
    // confidence, headline) to a user who explicitly opted out.
    const state = await GuardianState.findOne({ userAddress })
      .select({ graduationPromptDismissedAt: 1 })
      .lean();
    if (state?.graduationPromptDismissedAt) {
      return res.status(200).json({
        shouldShow: false,
        dismissed: true,
        confidence: 0,
        signals: { cyclical: false, corridor: false, largerBalance: false, hasSavedCycle: false },
        promptHeadline: '',
      });
    }

    const now = Date.now();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // ── Signal: cyclical deposits + withdrawals (90d) ───────────────
    // Re-uses the (userAddress, createdAt) compound index on Transaction.
    const recentActivity = await Transaction.find(
      {
        userAddress,
        createdAt: { $gte: ninetyDaysAgo },
        type: { $in: ['deposit', 'withdraw', 'swap'] },
      },
      { type: 1, tokenIn: 1, tokenOut: 1, amountUSD: 1, createdAt: 1, status: 1 },
    )
      .lean();

    // Only count confirmed balance-moving activity — `pending` or `failed`
    // transactions don't represent real trading behaviour.
    const confirmed = recentActivity.filter((t) => t.status === 'confirmed');
    const depositCount = confirmed.filter((t) => t.type === 'deposit').length;
    const withdrawCount = confirmed.filter((t) => t.type === 'withdraw').length;
    const isCyclical = depositCount >= 3 && withdrawCount >= 2;

    // ── Signal: corridor-shaped swaps (30d) ─────────────────────────
    // Local-stable → USD-stable. The signature of a trader paying a
    // supplier: convert accumulated local proceeds into a USD-pegged
    // asset just in time.
    const localToUsdSwaps = confirmed.filter(
      (t) =>
        t.type === 'swap' &&
        isLocalStableSymbol(t.tokenIn) &&
        isUsdStableSymbol(t.tokenOut),
    );
    const corridorSwapsThirtyDay = localToUsdSwaps.filter(
      (t) => new Date(t.createdAt).getTime() >= thirtyDaysAgo.getTime(),
    );
    const isCorridor = corridorSwapsThirtyDay.length >= 2;

    // ── Signal: larger balance proxy (any swap > $5,000) ────────────
    // Single-tx proxy — a true "larger balance" check would need a
    // vault balance snapshot, which we don't have here. A $5k+ swap is
    // a reasonable stand-in for non-trivial working capital.
    const isLargerBalance = confirmed.some(
      (t) => t.type === 'swap' && Number(t.amountUSD) > 5000,
    );

    // ── Signal: saved PurchaseCycle (user already exploring) ────────
    const hasSavedCycle = await PurchaseCycle.exists({ userAddress });

    const signals: Signals = {
      cyclical: isCyclical,
      corridor: isCorridor,
      largerBalance: isLargerBalance,
      hasSavedCycle: Boolean(hasSavedCycle),
    };

    const confidence =
      (signals.cyclical ? CONFIDENCE_TABLE.cyclical : 0) +
      (signals.corridor ? CONFIDENCE_TABLE.corridor : 0) +
      (signals.hasSavedCycle ? CONFIDENCE_TABLE.hasSavedCycle : 0) +
      (signals.largerBalance ? CONFIDENCE_TABLE.largerBalance : 0);

    // Cap at 1.0 for the user — anything beyond is "very high" and the
    // presentation only reads it as "should show". The internal sum is
    // only used to clear the threshold; the public value is normalized.
    const normalizedConfidence = Math.min(1, confidence);
    const shouldShow = confidence >= SHOW_THRESHOLD;

    return res.status(200).json({
      shouldShow,
      confidence: Number(normalizedConfidence.toFixed(2)),
      signals,
      promptHeadline: shouldShow ? PROMPT_HEADLINE : '',
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Signal query failed' });
  }
}
