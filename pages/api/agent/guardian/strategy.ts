import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, formatUnits } from 'viem';
import { celo } from 'viem/chains';
import { getSession, getAllSessions } from './session';

/**
 * Guardian Rebalance Strategy Engine
 *
 * GET /api/agent/guardian/strategy?userAddress=0x...
 *   Analyze the user's portfolio against inflation data and return
 *   rebalance recommendations (or "no action needed").
 *
 * POST /api/agent/guardian/strategy
 *   Run the strategy for ALL active sessions (called by cron / polling).
 *   Returns a list of recommended actions per user.
 */

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org';
const APP_BASE = process.env.NEXT_PUBLIC_API_BASE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || 'http://localhost:3000';

const TOKENS: Record<string, { address: `0x${string}`; decimals: number; stablecoin: boolean; region?: string }> = {
  CELO:  { address: '0x471EcE3750Da237f93B8E339c536989b8978a438', decimals: 18, stablecoin: false },
  cUSD:  { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, stablecoin: true, region: 'US' },
  cEUR:  { address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73', decimals: 18, stablecoin: true, region: 'EU' },
  cREAL: { address: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787', decimals: 18, stablecoin: true, region: 'BR' },
  KESm:  { address: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0', decimals: 18, stablecoin: true, region: 'KE' },
  COPm:  { address: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA', decimals: 18, stablecoin: true, region: 'CO' },
  PHPm:  { address: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B', decimals: 18, stablecoin: true, region: 'PH' },
};

const erc20BalanceAbi = [{ inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }] as const;

// ─── Inflation thresholds ────────────────────────────────────────────────────
const HIGH_INFLATION_THRESHOLD = 6;   // % — above this, recommend diversifying away
const LOW_INFLATION_THRESHOLD = 3;    // % — below this, the currency is "safe"
const MIN_BALANCE_USD = 0.5;          // Don't recommend swaps below $0.50

export interface RebalanceRecommendation {
  action: 'swap' | 'hold';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  reason: string;
  estimatedAmountUSD: number;
  inflationData?: { country: string; rate: number };
}

interface PortfolioBalance {
  token: string;
  balance: string;
  balanceRaw: string;
  estimatedUSD: number;
}

async function getPortfolio(userAddress: string): Promise<PortfolioBalance[]> {
  const client = createPublicClient({ chain: celo, transport: http(CELO_RPC) });
  const balances: PortfolioBalance[] = [];

  // Native CELO balance
  const celoBalance = await client.getBalance({ address: userAddress as `0x${string}` });
  if (celoBalance > 0n) {
    const formatted = Number(formatUnits(celoBalance, 18));
    balances.push({
      token: 'CELO',
      balance: formatted.toFixed(4),
      balanceRaw: celoBalance.toString(),
      estimatedUSD: formatted * 0.5, // rough CELO price estimate
    });
  }

  // ERC-20 balances
  for (const [symbol, info] of Object.entries(TOKENS)) {
    if (symbol === 'CELO') continue;
    try {
      const bal = await client.readContract({
        address: info.address,
        abi: erc20BalanceAbi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });
      if (bal > 0n) {
        const formatted = Number(formatUnits(bal, info.decimals));
        balances.push({
          token: symbol,
          balance: formatted.toFixed(4),
          balanceRaw: bal.toString(),
          estimatedUSD: info.stablecoin ? formatted : formatted * 0.5,
        });
      }
    } catch {
      // Skip tokens that fail
    }
  }

  return balances;
}

async function getInflationRates(): Promise<Record<string, number>> {
  try {
    const url = APP_BASE.startsWith('http') ? APP_BASE : `https://${APP_BASE}`;
    const resp = await fetch(`${url}/api/inflation`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`Inflation API returned ${resp.status}`);
    const data = await resp.json();
    const rates: Record<string, number> = {};
    for (const entry of data.countries || []) {
      if (entry.countryCode && entry.value != null) {
        rates[entry.countryCode] = entry.value;
      }
    }
    if (Object.keys(rates).length > 0) return rates;
    throw new Error('No inflation data parsed');
  } catch {
    // Fallback static rates for demo
    return { US: 3.2, KE: 6.9, CO: 9.3, BR: 4.5, PH: 5.8, EU: 2.4 };
  }
}

function analyzePortfolio(
  balances: PortfolioBalance[],
  inflationRates: Record<string, number>,
  dailyBudgetUSD: number,
  alreadySpentUSD: number,
): RebalanceRecommendation[] {
  const recommendations: RebalanceRecommendation[] = [];
  const remainingBudget = dailyBudgetUSD - alreadySpentUSD;

  if (remainingBudget <= MIN_BALANCE_USD) return recommendations;

  for (const holding of balances) {
    const tokenInfo = TOKENS[holding.token];
    if (!tokenInfo?.region) continue; // Skip non-regional tokens
    if (holding.estimatedUSD < MIN_BALANCE_USD) continue;

    const inflation = inflationRates[tokenInfo.region];
    if (inflation == null) continue;

    if (inflation >= HIGH_INFLATION_THRESHOLD) {
      // High inflation — recommend diversifying into a lower-inflation stablecoin
      const targetToken = findBestTarget(inflationRates, tokenInfo.region);
      if (!targetToken) continue;

      // Swap up to 20% of the holding or remaining budget, whichever is smaller
      const maxSwapUSD = Math.min(holding.estimatedUSD * 0.2, remainingBudget);
      if (maxSwapUSD < MIN_BALANCE_USD) continue;

      const urgency: RebalanceRecommendation['urgency'] =
        inflation >= 10 ? 'critical' : inflation >= 8 ? 'high' : 'medium';

      recommendations.push({
        action: 'swap',
        urgency,
        tokenIn: holding.token,
        tokenOut: targetToken,
        amountIn: (maxSwapUSD / (tokenInfo.stablecoin ? 1 : 0.5)).toFixed(4),
        reason: `${tokenInfo.region} inflation at ${inflation.toFixed(1)}% — diversifying ${holding.token} into ${targetToken} for purchasing power protection`,
        estimatedAmountUSD: maxSwapUSD,
        inflationData: { country: tokenInfo.region, rate: inflation },
      });
    }
  }

  // Also check: if user holds mostly CELO and CELO is volatile, recommend partial stablecoin conversion
  const celoHolding = balances.find(b => b.token === 'CELO');
  const totalUSD = balances.reduce((sum, b) => sum + b.estimatedUSD, 0);
  if (celoHolding && totalUSD > 0) {
    const celoRatio = celoHolding.estimatedUSD / totalUSD;
    if (celoRatio > 0.7 && celoHolding.estimatedUSD > 2) {
      const swapAmount = Math.min(celoHolding.estimatedUSD * 0.15, remainingBudget);
      if (swapAmount >= MIN_BALANCE_USD) {
        recommendations.push({
          action: 'swap',
          urgency: 'medium',
          tokenIn: 'CELO',
          tokenOut: 'cUSD',
          amountIn: (swapAmount / 0.5).toFixed(4),
          reason: `Portfolio is ${(celoRatio * 100).toFixed(0)}% CELO — diversifying into cUSD for stability`,
          estimatedAmountUSD: swapAmount,
        });
      }
    }
  }

  return recommendations;
}

function findBestTarget(inflationRates: Record<string, number>, excludeRegion: string): string | null {
  // Find the stablecoin with the lowest inflation rate
  const candidates = Object.entries(TOKENS)
    .filter(([, info]) => info.stablecoin && info.region && info.region !== excludeRegion)
    .map(([symbol, info]) => ({
      symbol,
      inflation: inflationRates[info.region!] ?? 999,
    }))
    .sort((a, b) => a.inflation - b.inflation);

  return candidates.length > 0 ? candidates[0].symbol : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // Single user analysis
      const { userAddress } = req.query;
      if (!userAddress || typeof userAddress !== 'string') {
        return res.status(400).json({ error: 'Missing userAddress' });
      }

      const session = getSession(userAddress);
      const [balances, inflationRates] = await Promise.all([
        getPortfolio(userAddress),
        getInflationRates(),
      ]);

      const dailyLimit = session?.signedPermission.permission.dailyLimitUSD ?? 10;
      const spentToday = session?.spentTodayUSD ?? 0;

      const recommendations = analyzePortfolio(balances, inflationRates, dailyLimit, spentToday);

      return res.status(200).json({
        userAddress,
        hasActiveSession: !!session,
        portfolio: balances,
        inflationRates,
        recommendations,
        budget: { dailyLimitUSD: dailyLimit, spentTodayUSD: spentToday, remainingUSD: dailyLimit - spentToday },
        timestamp: new Date().toISOString(),
      });
    }

  if (req.method === 'POST') {
    // Batch analysis for all active sessions — the autonomous loop calls this
    const activeSessions = getAllSessions();
    if (activeSessions.length === 0) {
      return res.status(200).json({ actions: [], message: 'No active sessions' });
    }

    const inflationRates = await getInflationRates();
    const actions: Array<{
      userAddress: string;
      recommendations: RebalanceRecommendation[];
    }> = [];

    for (const { userAddress, session } of activeSessions) {
      const balances = await getPortfolio(session.signedPermission.permission.userAddress);
      const recs = analyzePortfolio(
        balances,
        inflationRates,
        session.signedPermission.permission.dailyLimitUSD,
        session.spentTodayUSD,
      );

      if (recs.length > 0) {
        actions.push({ userAddress, recommendations: recs });
      }
    }

    return res.status(200).json({
      activeSessions: activeSessions.length,
      actions,
      inflationRates,
      timestamp: new Date().toISOString(),
    });
  }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('Guardian strategy error:', err);
    return res.status(500).json({ error: 'Strategy analysis failed', detail: String(err) });
  }
}
