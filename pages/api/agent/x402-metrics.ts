import type { NextApiRequest, NextApiResponse } from 'next';
import { listArcResearchSources, x402Analytics } from '@diversifi/shared';

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

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    transactionFrequency: {
      totalSettledPayments: dashboard.totalPayments,
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
    insights: report.insights,
    recommendations: report.recommendations,
  });
}
