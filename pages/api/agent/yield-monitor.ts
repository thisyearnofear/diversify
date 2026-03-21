import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * /api/agent/yield-monitor
 * 
 * Lightweight endpoint that returns current Celo/Mento yields from DeFiLlama.
 * Used by the Proactive Agent to monitor for yield spikes above user thresholds.
 * 
 * Core Principles:
 * - HONEST: Real DeFiLlama data, no fabricated values.
 * - DRY: Reuses the same DeFiLlama API already used in x402-gateway.
 * - PERFORMANT: Caches results for 5 minutes to avoid hammering the API.
 */

interface YieldOpportunity {
    protocol: string;
    chain: string;
    symbol: string;
    apy: number;
    tvl: number;
    pool: string;
}

// Simple in-memory cache
let cachedData: { opportunities: YieldOpportunity[]; lastFetched: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Return cached data if fresh
    if (cachedData && Date.now() - cachedData.lastFetched < CACHE_TTL) {
        return res.status(200).json(cachedData);
    }

    try {
        // Fetch real yield data from DeFiLlama
        const response = await fetch('https://yields.llama.fi/pools');
        
        if (!response.ok) {
            throw new Error(`DeFiLlama returned ${response.status}`);
        }

        const pools = await response.json();

        // Filter for Celo-related stablecoin pools with meaningful TVL
        const celoOpportunities: YieldOpportunity[] = (pools.data || [])
            .filter((pool: any) =>
                // Celo chain pools
                (pool.chain === 'Celo' || pool.chain === 'celo') &&
                // Stablecoins and known tokens
                (pool.symbol?.match(/USDC|USDT|cUSD|cEUR|EURC|DAI|G\$/i)) &&
                // Minimum TVL to filter noise
                pool.tvlUsd > 10000 &&
                // Must have positive APY
                pool.apy > 0
            )
            .sort((a: any, b: any) => b.apy - a.apy)
            .slice(0, 20)
            .map((pool: any) => ({
                protocol: pool.project,
                chain: pool.chain,
                symbol: pool.symbol,
                apy: pool.apy,
                tvl: pool.tvlUsd,
                pool: pool.pool,
            }));

        cachedData = {
            opportunities: celoOpportunities,
            lastFetched: Date.now(),
        };

        return res.status(200).json(cachedData);
    } catch (error) {
        console.error('[Yield Monitor] Error fetching data:', error);
        
        // Return stale cache if available
        if (cachedData) {
            return res.status(200).json({
                ...cachedData,
                _stale: true,
            });
        }

        return res.status(503).json({
            error: 'Yield data temporarily unavailable',
            opportunities: [],
        });
    }
}
