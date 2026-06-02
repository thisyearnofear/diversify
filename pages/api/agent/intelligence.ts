import type { NextApiRequest, NextApiResponse } from 'next';
import { marketPulseService } from '@diversifi/shared/src/utils/market-pulse-service';
import { IntelligenceService } from '@diversifi/shared/src/services/ai/intelligence.service';
import { inflationService, macroService } from '@diversifi/shared/src/utils/improved-data-services';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pulse = await marketPulseService.getMarketPulse();
    const [inflationResult, macroResult] = await Promise.all([
      inflationService.getInflationData(),
      macroService.getMacroData(),
    ]);

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
      const avgInflation = countryData.length > 0 
        ? countryData.reduce((acc: number, c: any) => acc + (c.value || 0), 0) / countryData.length
        : (region === 'LatAm' ? 35 : region === 'Africa' ? 15 : 4);

      if (avgInflation > 30) regionalRisk[region] = 'critical';
      else if (avgInflation > 15) regionalRisk[region] = 'high';
      else if (avgInflation > 7) regionalRisk[region] = 'medium';
      else regionalRisk[region] = 'low';
    });

    return res.status(200).json({
      pulse,
      insights,
      regionalRisk,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[API Intelligence] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
