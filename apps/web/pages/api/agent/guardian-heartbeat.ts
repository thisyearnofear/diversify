/**
 * POST /api/agent/guardian-heartbeat
 *
 * The Guardian Heartbeat — records advisory recommendations on-chain
 * on all three chains, even when no user has opted into auto-execution.
 *
 * This creates the ongoing on-chain activity that proves the Guardian
 * is alive and monitoring markets. Recommendations are labelled
 * `ADVISORY_HEARTBEAT` to distinguish them from `AUTONOMOUS_REBALANCE`
 * (which fires when a user has an active GUARDIAN-tier permission).
 *
 * Flow:
 *   1. Fetch live market data (DeFiLlama yields, CoinGecko prices, World Bank inflation)
 *      — provenance-tracked: an unreachable provider yields `null` figures and a
 *      `live: false` flag, never a hardcoded "default price" wearing a live source
 *   2. Generate an advisory recommendation via the AI service — decided and
 *      reasoned ONLY from live observations; reasoning names each source and
 *      discloses any source unavailable this beat (no fallback figures)
 *   3. Record on the chain-aware primary ledger (Celo for savings, Arbitrum for yield)
 *      — plus an APAC-cohort savings advisory on HashKey when the rail is configured
 *      — plus a Caribbean-cohort savings advisory on Celo (cohort-labelled receipt)
 *   4. Mirror to 0G mainnet as evidence anchor
 *
 * Called by server-side cron every 30 minutes on Hetzner.
 *
 * Security: Protected by GUARDIAN_LOOP_SECRET header (same as guardian-loop).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { recommendationLedgerService, constantTimeEqual } from '@diversifi/shared';
import { recordGuardianRun } from '../../../lib/guardian-run-status';
// Phase 0 (unified Guardian reasoning): the deterministic synthesizer moved
// to @diversifi/shared so the loop, heartbeat, and marketplace agent can
// share one reasoning floor. This module re-exports it for compatibility;
// golden tests prove the shared output is byte-identical to the original
// implementation (docs/guardian-reasoning-service.md §7).
import {
  synthesizeHeartbeatAdvisory,
  type HeartbeatMarketSnapshot,
  type HeartbeatRecommendation,
} from '@diversifi/shared/src/services/guardian-reasoning';

const GUARDIAN_LOOP_SECRET = (() => {
  const secret = process.env.GUARDIAN_LOOP_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'GUARDIAN_LOOP_SECRET environment variable is required in production.',
    );
  }
  return 'dev-guardian-loop';
})();

const GUARDIAN_AGENT_ADDRESS = process.env.GUARDIAN_AGENT_ADDRESS || '0x803798fb6AC2ab3234f482350FB2aF6422b2B8f2';

// The snapshot shape moved to shared (`HeartbeatMarketSnapshot`) with the
// synthesizer; re-exported under the original names so existing importers
// (and the route's own honesty tests) keep working unchanged.
export type MarketSnapshot = HeartbeatMarketSnapshot;
export type { HeartbeatRecommendation };

/** Fetch wrapper that reports reachability instead of fabricating a body on
 *  failure. The old `|| 65000`-style defaults made an on-chain advisory read
 *  as if CoinGecko had quoted those prices — a fallback labeled as live. */
type FetchResult<T> = { ok: true; data: T } | { ok: false };

async function fetchJson<T>(url: string): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false };
  }
}

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const [defillamaFetch, coingeckoFetch, worldBankFetch] = await Promise.all([
    fetchJson<{ data?: { symbol?: string; tvlUsd?: number; project?: string; apy?: number }[] }>(
      'https://yields.llama.fi/pools'),
    fetchJson<{
      bitcoin?: { usd?: number };
      'pax-gold'?: { usd?: number };
    }>('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd'),
    fetchJson<[{ value?: unknown }[], { value?: unknown }[]]>(
      'https://api.worldbank.org/v2/country/US/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2023'),
  ]);

  const stablePools = defillamaFetch.ok
    ? (defillamaFetch.data.data || [])
        .filter((pool) => pool.symbol?.includes('USDC') && (pool.tvlUsd || 0) > 1_000_000)
        .sort((a, b) => (b.apy || 0) - (a.apy || 0))
        .slice(0, 5)
        .map((pool) => ({
          protocol: pool.project || 'unknown',
          apy: pool.apy || 0,
          tvl: pool.tvlUsd || 0,
        }))
    : [];

  const cg = coingeckoFetch.ok ? coingeckoFetch.data : {};

  // A real World Bank response can also carry `value: null` (no observation
  // for the requested year) — that is not a number we may quote either.
  const wbValue = worldBankFetch.ok ? worldBankFetch.data?.[1]?.[0]?.value : undefined;
  const inflationLive =
    typeof wbValue === 'number' && Number.isFinite(wbValue);

  return {
    defillama: { live: defillamaFetch.ok, pools: stablePools },
    coingecko: {
      live: coingeckoFetch.ok,
      bitcoin: typeof cg?.bitcoin?.usd === 'number' ? cg.bitcoin.usd : null,
      pax_gold: typeof cg?.['pax-gold']?.usd === 'number' ? cg['pax-gold'].usd : null,
    },
    worldBank: {
      live: inflationLive,
      current_inflation: inflationLive ? (wbValue as number) : null,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Deterministic advisory synthesizer — now the shared implementation.
 *
 * Extracted verbatim to `@diversifi/shared/src/services/guardian-reasoning`
 * (Phase 0 of the unified reasoning service); golden tests in that package
 * prove this alias produces byte-identical output to the original inline
 * implementation across live / partial-down / all-down fixtures.
 */
export function pickRecommendation(snapshot: MarketSnapshot): HeartbeatRecommendation {
  return synthesizeHeartbeatAdvisory(snapshot);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const authHeader = req.headers['x-guardian-secret'] || req.body?.secret;
  if (typeof authHeader !== 'string' || !constantTimeEqual(authHeader, GUARDIAN_LOOP_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Recording the run outcome must never change the cron's behaviour.
  async function recordRunSafely(args: Parameters<typeof recordGuardianRun>[1]) {
    try {
      await recordGuardianRun('heartbeat', args);
    } catch (err: unknown) {
      console.warn('[guardian-heartbeat] run-status write failed:', err instanceof Error ? err.message : err);
    }
  }

  try {
    // 1. Fetch live market data
    const snapshot = await fetchMarketSnapshot();
    const rec = pickRecommendation(snapshot);

    // 2. Record on the primary chain (Celo for savings tokens, Arbitrum for
    // yield) and — when the regional ledgers are configured — the APAC-cohort
    // (HashKey) and Caribbean-cohort (Celo) savings advisories in parallel.
    // The records target different chains/contexts, so the signer's nonces
    // are independent and neither wait blocks the other. Each advisory is
    // routed via the same chain-aware logic as user recommendations and
    // self-describes its cohort in the on-chain reasoning, so the global
    // proof feed answers "why am I seeing this chain?" honestly
    // (docs/apac-rail.md, docs/caribbean-rail.md).
    const apacPromise = process.env.HASHKEY_LEDGER_CONTRACT
      ? recommendationLedgerService.recordRecommendation({
          user: GUARDIAN_AGENT_ADDRESS,
          action: 'ADVISORY_HEARTBEAT',
          targetToken: 'USDC',
          reasoning: `APAC savings advisory (Confucian/Gotong Royong cohort): hold stablecoin core on the APAC rail. ${rec.reasoning}`,
          evidenceCid: '',
          servingModel: 'guardian-heartbeat',
          confidence: Math.round(rec.confidence * 10000),
          routingContext: { philosophy: 'confucian', region: 'Asia' },
        }).catch((err: any) => {
          console.warn(`[guardian-heartbeat] APAC rail advisory failed: ${err.message}`);
          return null;
        })
      : Promise.resolve(null);

    // Caribbean cohort (Pan-Caribbean philosophy): routes to Celo via
    // chain-aware routing — the Caribbean rail has no native chain, it
    // settles savings on Celo (USD-pegged stables). Kept as its own
    // cohort-labelled receipt so the proof feed shows a live Caribbean
    // pulse alongside the APAC one (docs/caribbean-rail.md).
    const caribbeanPromise = process.env.CELO_MAINNET_LEDGER_CONTRACT
      ? recommendationLedgerService.recordRecommendation({
          user: GUARDIAN_AGENT_ADDRESS,
          action: 'ADVISORY_HEARTBEAT',
          targetToken: 'cUSD',
          reasoning: `Caribbean savings advisory (Pan-Caribbean cohort): hold USD-pegged stablecoin core on Celo. ${rec.reasoning}`,
          evidenceCid: '',
          servingModel: 'guardian-heartbeat',
          confidence: Math.round(rec.confidence * 10000),
          routingContext: { philosophy: 'pan_caribbean', region: 'Caribbean' },
        }).catch((err: any) => {
          console.warn(`[guardian-heartbeat] Caribbean rail advisory failed: ${err.message}`);
          return null;
        })
      : Promise.resolve(null);

    const primaryResult = await recommendationLedgerService.recordRecommendation({
      user: GUARDIAN_AGENT_ADDRESS,
      action: rec.action,
      targetToken: rec.targetToken,
      reasoning: rec.reasoning,
      evidenceCid: '',
      servingModel: 'guardian-heartbeat',
      confidence: Math.round(rec.confidence * 10000),
    });

    // 3. Mirror to 0G mainnet as evidence anchor (fire-and-forget)
    const mirrorPromise = recommendationLedgerService.mirrorRecommendationToZeroG({
      user: GUARDIAN_AGENT_ADDRESS,
      action: 'EVIDENCE_MIRROR',
      targetToken: rec.targetToken,
      reasoning: `Evidence anchor for heartbeat rec: ${rec.reasoning}`,
      evidenceCid: '',
      servingModel: 'guardian-heartbeat-mirror',
      settlementTxHash: primaryResult.status === 'failed' ? '' : primaryResult.txHash,
      confidence: Math.round(rec.confidence * 10000),
    }).catch((err) => {
      console.warn(`[guardian-heartbeat] 0G mirror failed: ${err.message}`);
      return null;
    });

    const [mirrorResult, apacResult, caribbeanResult] = await Promise.all([
      mirrorPromise,
      apacPromise,
      caribbeanPromise,
    ]);

    await recordRunSafely({
      status: primaryResult.status === 'failed' ? 'degraded' : 'ok',
      summary: {
        targetToken: rec.targetToken,
        confidence: rec.confidence,
        primaryStatus: primaryResult.status,
        evidenceMirror: mirrorResult?.status ?? null,
        apacRail: apacResult?.status ?? null,
        caribbeanRail: caribbeanResult?.status ?? null,
        inflationQuoted: snapshot.worldBank.current_inflation !== null,
        dataSources: {
          defillama: snapshot.defillama.live,
          coingecko: snapshot.coingecko.live,
          worldBank: snapshot.worldBank.live,
        },
      },
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      recommendation: {
        action: rec.action,
        targetToken: rec.targetToken,
        confidence: rec.confidence,
        reasoning: rec.reasoning,
      },
      primaryChain: {
        status: primaryResult.status,
        chainId: primaryResult.chainId,
        txHash: primaryResult.status === 'failed' ? undefined : primaryResult.txHash,
        explorerUrl: primaryResult.status === 'failed' ? undefined : (primaryResult as any).explorerUrl,
        id: primaryResult.status === 'anchored' ? (primaryResult as any).id : undefined,
      },
      evidenceMirror: mirrorResult ? {
        status: mirrorResult.status,
        chainId: mirrorResult.chainId,
        txHash: mirrorResult.status === 'failed' ? undefined : mirrorResult.txHash,
        explorerUrl: mirrorResult.status === 'failed' ? undefined : (mirrorResult as any).explorerUrl,
      } : null,
      apacRail: apacResult ? {
        status: apacResult.status,
        chainId: apacResult.chainId,
        txHash: apacResult.status === 'failed' ? undefined : apacResult.txHash,
        explorerUrl: apacResult.status === 'failed' ? undefined : (apacResult as any).explorerUrl,
      } : null,
      caribbeanRail: caribbeanResult ? {
        status: caribbeanResult.status,
        chainId: caribbeanResult.chainId,
        txHash: caribbeanResult.status === 'failed' ? undefined : caribbeanResult.txHash,
        explorerUrl: caribbeanResult.status === 'failed' ? undefined : (caribbeanResult as any).explorerUrl,
      } : null,
      marketSnapshot: {
        // null = source unreachable this beat, not a fabricated default.
        inflation: snapshot.worldBank.current_inflation,
        topYield: snapshot.defillama.pools[0] || null,
        btcPrice: snapshot.coingecko.bitcoin,
        paxGoldPrice: snapshot.coingecko.pax_gold,
        dataSources: {
          defillama: snapshot.defillama.live,
          coingecko: snapshot.coingecko.live,
          worldBank: snapshot.worldBank.live,
        },
      },
    });
  } catch (error: any) {
    console.error('[guardian-heartbeat] Error:', error.message);
    await recordRunSafely({
      status: 'failed',
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
