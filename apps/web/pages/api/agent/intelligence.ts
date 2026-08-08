import type { NextApiRequest, NextApiResponse } from 'next';
import { marketPulseService } from '@diversifi/shared/src/utils/market-pulse-service';
import { IntelligenceService } from '@diversifi/shared/src/services/ai/intelligence.service';
import { inflationService, macroService } from '@diversifi/shared/src/utils/improved-data-services';
import { recordIntelligenceSuccess, recordIntelligenceFailure } from '../healthz';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  try {
    // Optional horizon query param: "1h" for short-term spikes, "24h" for
    // longer-term risk management. Defaults to "24h" (same as the service).
    const horizon = (req.query.horizon === '1h' ? '1h' : '24h') as '1h' | '24h';
    const pulse = await marketPulseService.getMarketPulse(horizon);
    // allSettled so a single upstream failure doesn't drop the other result.
    // Both services use circuit breakers internally, so rejections are rare,
    // but the pattern is more defensive than Promise.all.
    const [inflationSettled, macroSettled] = await Promise.allSettled([
      inflationService.getInflationData(),
      macroService.getMacroData(),
    ]);
    const inflationResult = inflationSettled.status === 'fulfilled'
      ? inflationSettled.value
      : { data: { countries: [] }, source: 'fallback' };
    const macroResult = macroSettled.status === 'fulfilled'
      ? macroSettled.value
      : { data: {}, source: 'fallback' };

    const insights = await IntelligenceService.generateGuardianInsights(
      pulse,
      inflationResult.data,
      macroResult.data
    );

    // Calculate regional risk heatmap for UI (Top 1% enhancement)
    const regionalRisk: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {};
    const regions = ['Africa', 'LatAm', 'Asia', 'USA', 'Europe'];

    regions.forEach(region => {
      // Find representative inflation for region
      const countryData = inflationResult.data.countries.filter((c: any) => c.region === region || c.region === region.toLowerCase());
      // No data for a region: do NOT default to a high/critical level.
      // Absence of evidence is not evidence of hyperinflation. UI shows 'low'.
      const avgInflation = countryData.length > 0
        ? countryData.reduce((acc: number, c: any) => acc + (c.value || 0), 0) / countryData.length
        : 0;

      if (avgInflation > 30) regionalRisk[region] = 'critical';
      else if (avgInflation > 15) regionalRisk[region] = 'high';
      else if (avgInflation > 7) regionalRisk[region] = 'medium';
      else regionalRisk[region] = 'low';
    });

    recordIntelligenceSuccess(Date.now() - startedAt);
    return res.status(200).json({
      pulse,
      insights,
      regionalRisk,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[API Intelligence] Error:', error);
    recordIntelligenceFailure(error?.message ?? String(error), Date.now() - startedAt);
    return res.status(500).json({ error: error.message });
  }
}
