import type { NextApiRequest, NextApiResponse } from 'next';
import { marketPulseService } from '@diversifi/shared/src/utils/market-pulse-service';
import { IntelligenceService } from '@diversifi/shared/src/services/ai/intelligence.service';
import { inflationService, macroService } from '@diversifi/shared/src/utils/improved-data-services';
import { SynthDataService } from '@diversifi/shared/src/services/synth-data-service';

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

    const synthSettled = await Promise.allSettled([
      SynthDataService.getPredictions('BTC'),
      SynthDataService.getPredictions('ETH'),
    ]);

    const synthData = {
      BTC: synthSettled[0].status === 'fulfilled' ? synthSettled[0].value : null,
      ETH: synthSettled[1].status === 'fulfilled' ? synthSettled[1].value : null,
    };

    const insights = await IntelligenceService.generateGuardianInsights(
      pulse,
      inflationResult.data,
      macroResult.data,
      synthData
    );

    return res.status(200).json({
      pulse,
      insights,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[API Intelligence] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
