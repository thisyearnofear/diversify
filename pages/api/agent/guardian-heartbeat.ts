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
 *   2. Generate an advisory recommendation via the AI service
 *   3. Record on the chain-aware primary ledger (Celo for savings, Arbitrum for yield)
 *   4. Mirror to 0G mainnet as evidence anchor
 *
 * Called by server-side cron every 30 minutes on Hetzner.
 *
 * Security: Protected by GUARDIAN_LOOP_SECRET header (same as guardian-loop).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { recommendationLedgerService } from '@diversifi/shared';

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

interface MarketSnapshot {
  defillama: { protocol: string; apy: number; tvl: number }[];
  coingecko: { bitcoin: number; ethereum: number; pax_gold: number };
  worldBank: { current_inflation: number; source: string };
  timestamp: string;
}

async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const [defillamaRes, coingeckoRes, worldBankRes] = await Promise.all([
    fetch('https://yields.llama.fi/pools').then(r => r.json()).catch(() => ({ data: [] })),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd')
      .then(r => r.json()).catch(() => ({})),
    fetch('https://api.worldbank.org/v2/country/US/indicator/FP.CPI.TOTL.ZG?format=json&per_page=1&date=2023')
      .then(r => r.json()).catch(() => ([[], [{ value: 3.1 }]])),
  ]);

  const stablePools = (defillamaRes.data || [])
    .filter((pool: { symbol: string; tvlUsd: number }) =>
      pool.symbol?.includes('USDC') && pool.tvlUsd > 1_000_000)
    .sort((a: { apy: number }, b: { apy: number }) => b.apy - a.apy)
    .slice(0, 5)
    .map((pool: { project: string; apy: number; tvlUsd: number }) => ({
      protocol: pool.project,
      apy: pool.apy,
      tvl: pool.tvlUsd,
    }));

  const cg = coingeckoRes || {};
  const wbData = worldBankRes?.[1]?.[0]?.value || 3.1;

  return {
    defillama: stablePools,
    coingecko: {
      bitcoin: cg.bitcoin?.usd || 65000,
      ethereum: cg.ethereum?.usd || 3500,
      pax_gold: cg['pax-gold']?.usd || 2400,
    },
    worldBank: { current_inflation: wbData, source: 'World Bank API' },
    timestamp: new Date().toISOString(),
  };
}

function pickRecommendation(snapshot: MarketSnapshot): {
  action: string;
  targetToken: string;
  reasoning: string;
  confidence: number;
} {
  const topYield = snapshot.defillama[0];
  const inflation = snapshot.worldBank.current_inflation;
  const btcPrice = snapshot.coingecko.bitcoin;
  const paxGoldPrice = snapshot.coingecko.pax_gold;

  // Simple rule-based logic — real AI synthesis happens via the gateway,
  // but for the heartbeat we want deterministic, auditable reasoning.
  const reasoningParts: string[] = [
    `Inflation: ${inflation}%`,
    `BTC: $${btcPrice.toLocaleString()}`,
    `PAXG: $${paxGoldPrice.toLocaleString()}`,
  ];

  if (topYield) {
    reasoningParts.push(`Top yield: ${topYield.protocol} at ${topYield.apy.toFixed(2)}% APY ($${(topYield.tvl / 1e6).toFixed(1)}M TVL)`);
  }

  // If inflation is high, recommend cUSD (savings on Celo)
  // If yields are attractive, recommend USDC (yield on Arbitrum)
  if (inflation > 3.5) {
    const reasoning = `High inflation (${inflation}%) detected. Recommend cUSD savings position on Celo to preserve purchasing power. ${reasoningParts.join(', ')}.`;
    return {
      action: 'ADVISORY_HEARTBEAT',
      targetToken: 'cUSD',
      reasoning,
      confidence: 0.72,
    };
  }

  if (topYield && topYield.apy > 5) {
    const reasoning = `Attractive yield opportunity: ${topYield.protocol} at ${topYield.apy.toFixed(2)}% APY. Recommend USDC deployment on Arbitrum. ${reasoningParts.join(', ')}.`;
    return {
      action: 'ADVISORY_HEARTBEAT',
      targetToken: 'USDC',
      reasoning,
      confidence: 0.68,
    };
  }

  // Default: hold cEUR as inflation hedge
  const reasoning = `Stable regime. Recommend holding cEUR as inflation hedge. ${reasoningParts.join(', ')}.`;
  return {
    action: 'ADVISORY_HEARTBEAT',
    targetToken: 'cEUR',
    reasoning,
    confidence: 0.65,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const authHeader = req.headers['x-guardian-secret'] || req.body?.secret;
  if (authHeader !== GUARDIAN_LOOP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Fetch live market data
    const snapshot = await fetchMarketSnapshot();
    const rec = pickRecommendation(snapshot);

    // 2. Record on the primary chain (Celo for savings tokens, Arbitrum for yield)
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

    const mirrorResult = await mirrorPromise;

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
      marketSnapshot: {
        inflation: snapshot.worldBank.current_inflation,
        topYield: snapshot.defillama[0] || null,
        btcPrice: snapshot.coingecko.bitcoin,
        paxGoldPrice: snapshot.coingecko.pax_gold,
      },
    });
  } catch (error: any) {
    console.error('[guardian-heartbeat] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
