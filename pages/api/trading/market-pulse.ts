import type { NextApiRequest, NextApiResponse } from 'next';
import { marketPulseService, type StockTrigger } from '../../../utils/market-pulse-service';

export interface MarketPulseResponse {
  success: boolean;
  pulse?: {
    sentiment: number;
    btcPrice: number;
    btcChange24h: number;
    goldPrice: number;
    goldChange24h: number;
    warRisk: number;
    aiMomentum: number;
    defenseSpending: number;
    lastUpdated: number;
  };
  triggers?: StockTrigger[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketPulseResponse>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { includeTriggers } = req.query;
    
    const pulse = await marketPulseService.getMarketPulse();
    
    const response: MarketPulseResponse = {
      success: true,
      pulse,
    };

    if (includeTriggers === 'true') {
      response.triggers = marketPulseService.generateTriggers(pulse);
    }

    res.status(200).json(response);
  } catch (error: any) {
    console.error('[Market Pulse API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market pulse',
    });
  }
}
