import type { NextApiRequest, NextApiResponse } from 'next';
import {
  listArcResearchSources,
  x402Analytics,
  getAgentAddress,
  getAgentUSDCBalance,
  getArcSettlementStats,
} from '@diversifi/shared';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dashboard = x402Analytics.getDashboardData();
  const report = x402Analytics.getAnalyticsReport();
  const sourcePricing = listArcResearchSources().map((source) => ({
    sourceId: source.id,
    label: source.label,
    priceUSDC: parseFloat(source.price),
  }));

  const maxPerActionPrice = sourcePricing.reduce((max, item) => Math.max(max, item.priceUSDC), 0);

  // Agent wallet info — lets judges verify the on-chain settlement address
  const agentAddress = getAgentAddress();
  const agentBalance = agentAddress ? await getAgentUSDCBalance() : null;
  const chainSettlement = agentAddress
    ? await getArcSettlementStats({ agentAddress, maxRecentTransfers: 10 }).catch(() => null)
    : null;

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    transactionFrequency: {
      totalSettledPayments: chainSettlement?.transferCount ?? dashboard.totalPayments,
      evidenceSource: chainSettlement?.proofSource ?? 'in_memory_fallback',
      latestSettlementBlock: chainSettlement?.latestTransferBlock ?? null,
      successRate: dashboard.successRate,
      averagePaymentTimeMs: Math.round(dashboard.averagePaymentTime),
      topSources: dashboard.topSources,
      recentSpending: dashboard.recentSpending,
    },
    pricing: {
      maxPerActionPriceUSDC: Number(maxPerActionPrice.toFixed(6)),
      allSourcesAtOrBelowOneCent: maxPerActionPrice <= 0.01,
      sourcePricing,
    },
    arcSettlement: {
      agentAddress,
      agentUSDCBalance: agentBalance,
      recipientAddress: chainSettlement?.recipientAddress ?? null,
      tokenAddress: chainSettlement?.tokenAddress ?? null,
      totalSettledUSDC: chainSettlement?.totalSettledUSDC ?? null,
      settledTransferCount: chainSettlement?.transferCount ?? null,
      recentTransfers: chainSettlement?.recentTransfers ?? [],
      explorerBase: 'https://testnet.arcscan.app',
      agentExplorer: agentAddress ? `https://testnet.arcscan.app/address/${agentAddress}` : null,
      note: agentBalance === null
        ? 'Fund agent wallet to enable real on-chain settlement per research request'
        : chainSettlement
          ? 'Transaction counts are derived from Arc USDC Transfer logs for the agent wallet'
          : 'Agent wallet live — Arc settlement is enabled, but chain-derived proof is temporarily unavailable',
    },
    appAnalytics: {
      totalRecordedPayments: dashboard.totalPayments,
      successRate: dashboard.successRate,
      averagePaymentTimeMs: Math.round(dashboard.averagePaymentTime),
    },
    insights: report.insights,
    recommendations: report.recommendations,
  });
}
